"""One live call: listen -> send a turn to ai/ -> play what it says -> listen again.

Build step 3 scope: basic loop only. Barge-in (step 5), no-input timers (step 6) and
fallback when ai/ fails (step 7) come next; until then the caller's audio is ignored
while a prompt is playing.
"""

import asyncio
import logging

from . import engine, exotel, prompts
from .audio import Player
from .vad import Endpointer

log = logging.getLogger("ivr")


class Call:
    def __init__(self, send, bank, lang="hi"):
        self.send = send
        self.bank = bank
        self.lang = lang
        self.stream_sid = self.call_sid = self.phone = ""
        self.player: Player | None = None
        self.vad = Endpointer()
        self.speaking = False          # our prompt is playing (until Exotel echoes the mark)
        self.turn_no = 0
        self.busy = asyncio.Lock()     # one turn in flight at a time
        self.done = False              # ai/ said terminal: take no more input
        self.finished = False          # ...and the goodbye has been heard: hang up

    async def on_event(self, ev: exotel.Event):
        if ev.kind == "start":
            self.stream_sid, self.call_sid, self.phone = ev.stream_sid, ev.call_sid, ev.caller
            self.player = Player(self.send, self.stream_sid)
            await self._turn(engine.OPENED)
        elif ev.kind == "media" and not self.speaking and not self.done:
            pcm = self.vad.feed(ev.pcm)
            if pcm:
                await self._turn(engine.audio(pcm))
        elif ev.kind == "dtmf" and not self.done:
            await self._turn(engine.dtmf(ev.digit))
        elif ev.kind == "mark" and ev.raw.get("mark", {}).get("name") == self._mark():
            self.speaking = False      # last clip of this turn has been heard
            self.vad.reset()
            self.finished = self.done

    async def _turn(self, utterance):
        async with self.busy:
            reply = await engine.turn(self.call_sid, self.phone, self.lang, utterance)
            self.turn_no += 1
            log.info("turn %d stream=%s state=%s", self.turn_no, self.stream_sid, reply.get("state"))
            self._play(reply.get("say", []))
            self.done = bool(reply.get("terminal"))

    def _play(self, say):
        clips = []
        for item in say:
            if item.get("kind") == "prerendered":
                pcm = prompts.resolve(self.bank, item["id"], self.lang)
                if pcm is None:
                    log.warning("missing prompt %s/%s", self.lang, item["id"])
                else:
                    clips.append(pcm)
            else:
                log.warning("tts not wired yet: %r", item.get("text", "")[:40])
        if not clips:
            self.finished = self.done
            return
        self.speaking = True
        for i, pcm in enumerate(clips):
            self.player.play(pcm, mark=self._mark() if i == len(clips) - 1 else None)

    def _mark(self):
        return f"turn-{self.turn_no}-end"

    async def close(self):
        if self.call_sid and not self.done:
            try:
                await engine.turn(self.call_sid, self.phone, self.lang, engine.HANGUP)
            except Exception as e:     # best effort: ai/ also times sessions out
                log.warning("hangup not delivered: %s", e)
        if self.player:
            await self.player.close()
