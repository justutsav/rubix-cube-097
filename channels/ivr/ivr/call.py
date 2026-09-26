"""One live call: listen -> send a turn to ai/ -> play what it says -> listen again.

Timers count 20 ms caller frames, not wall-clock: Exotel streams audio non-stop, so a
frame count is a clock that needs no extra task and makes tests instant.
"""

import array
import asyncio
import logging
import math
import os
import re

from . import engine, exotel, metrics, prompts
from .audio import Player
from .vad import Endpointer

log = logging.getLogger("ivr")


def _ms(name, default):
    return int(os.environ.get(name, default))


def _debug_save(stream_sid, turn, pcm):
    """IVR_DEBUG_DIR set: keep each caller utterance as a WAV, for tuning on a real line.
    Off by default and for test calls only: product calls must not store audio."""
    folder = os.environ.get("IVR_DEBUG_DIR")
    if not folder:
        return
    import array
    import math
    import wave
    from pathlib import Path

    Path(folder).mkdir(parents=True, exist_ok=True)
    path = Path(folder) / f"{stream_sid[-8:]}-{turn:02d}.wav"
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(8000)
        w.writeframes(pcm)
    a = array.array("h", pcm)
    rms = math.sqrt(sum(v * v for v in a) / max(len(a), 1))
    log.info("debug: saved %s (%d ms, rms %.0f)", path.name, len(pcm) // 16, rms)


class Call:
    def __init__(self, send, bank, lang="hi"):
        self.send = send
        self.bank = bank
        self.lang = lang
        self.stream_sid = self.call_sid = self.phone = ""
        self.player: Player | None = None
        self.feeder: asyncio.Task | None = None   # queues this turn's audio into the player
        self.vad = Endpointer()
        self.busy = asyncio.Lock()     # one turn in flight at a time
        self.turn_no = 0
        self.speaking = False          # our audio is playing (until Exotel echoes the mark)
        self.barged = False            # caller interrupted the last prompt
        self.quiet = 0                 # silent frames since the prompt finished
        self.frames = 0                # caller frames since call start
        self.inbuf = b""               # Exotel's chunks can be any multiple of 320 bytes
        self.done = False              # no more input: goodbye queued
        self.engine_done = False       # ai/ itself ended the session
        self.finished = False          # goodbye heard: hang up
        self.no_input_frames = _ms("NO_INPUT_TIMEOUT_MS", 8000) // 20
        # 120 ms cut every prompt on a real line; 400 ms still cut questions on "हाँ जी"/"अच्छा",
        # which Hindi speakers say while listening. Only a real attempt to talk interrupts.
        self.barge_in_ms = _ms("BARGE_IN_SPEECH_MS", 900)
        self.filler_after = _ms("FILLER_AFTER_MS", 1000) / 1000   # Sarvam often takes 0.7-0.8 s
        # the carrier's own announcement ("this call is being recorded") must not cut the welcome
        self.barge_grace_frames = _ms("BARGE_IN_GRACE_MS", 4000) // 20
        self.max_frames = _ms("MAX_CALL_SECONDS", 600) * 50
        # speakerphone: our own voice comes back in the caller's audio
        self.echo_ratio = float(os.environ.get("BARGE_IN_ECHO_RATIO", 2.5))   # louder than the echo by this
        self.echo_floor = _ms("BARGE_IN_MIN_RMS", 300)
        self.echo_level = 0.0          # running loudness of what comes back while we speak
        self.recent_rms: list = []     # last 300 ms of caller loudness
        self.loud_ms = 0               # caller speech clearly above the echo, during a prompt
        self.guard_frames = _ms("POST_PROMPT_GUARD_MS", 250) // 20
        self.guard = 0                 # frames still ignored after a prompt ends (echo tail)
        self.echo_learn_frames = _ms("ECHO_LEARN_MS", 300) // 20
        self.echo_learn = 0            # frames left to measure the echo at the start of a prompt

    # --- events from Exotel ---------------------------------------------------

    async def on_event(self, ev: exotel.Event):
        if ev.kind == "start":
            self.stream_sid, self.call_sid, self.phone = ev.stream_sid, ev.call_sid, ev.caller
            self.player = Player(self.send, self.stream_sid)
            await self._turn(engine.OPENED)
        elif ev.kind == "media":
            self.inbuf += ev.pcm       # re-cut into the 20 ms frames the VAD and timers need
            while len(self.inbuf) >= 320:
                frame, self.inbuf = self.inbuf[:320], self.inbuf[320:]
                await self._on_audio(frame)
        elif ev.kind == "dtmf" and not self.done:
            if self.speaking:
                await self._barge_in()
            await self._turn(engine.dtmf(ev.digit))
        elif ev.kind == "mark" and ev.raw.get("mark", {}).get("name") == self._mark():
            self.speaking = False      # last clip of this turn has been heard
            self.quiet = 0
            if not self.vad.in_speech:  # caller may already have started answering
                self.vad.reset()
                self.guard = self.guard_frames      # skip the echo tail of our own prompt
            self.loud_ms = 0
            self.finished = self.done

    async def _on_audio(self, frame):
        self.frames += 1
        if self.done:
            return
        if self.frames >= self.max_frames:
            log.info("max call length stream=%s", self.stream_sid)
            await self._end("goodbye")
            return

        if self.guard:
            self.guard -= 1
            if not self.guard:
                self.vad.reset()
            return

        pcm = self.vad.feed(frame)
        if self.speaking:
            if self._louder_than_echo(frame) and self.vad.in_speech:
                self.loud_ms += 20
            else:
                self.loud_ms = max(0, self.loud_ms - 10)     # brief dips are fine, echo decays it
            if self.loud_ms >= self.barge_in_ms and self.frames > self.barge_grace_frames:
                await self._barge_in()
            return                     # an utterance that ends mid-prompt is too short to count

        if pcm:
            _debug_save(self.stream_sid, self.turn_no, pcm)
            await self._turn(engine.audio(pcm), speech_ms=len(pcm) // 16)
        elif self.vad.in_speech:
            self.quiet = 0
        else:
            self.quiet += 1
            if self.quiet >= self.no_input_frames:
                self.quiet = 0
                await self._turn(engine.TIMEOUT)

    def _louder_than_echo(self, frame) -> bool:
        """On speakerphone our prompt comes back into the call. A real interruption is the
        caller talking into the phone, clearly louder than that echo; the echo itself is not.
        Loudness is averaged over the last 300 ms (single 20 ms slices of speech swing 3-4x),
        and the first ECHO_LEARN_MS of every prompt only measure the echo."""
        a = array.array("h", frame)
        self.recent_rms = (self.recent_rms + [math.sqrt(sum(v * v for v in a) / len(a))])[-15:]
        avg = sum(self.recent_rms) / len(self.recent_rms)
        if self.echo_learn:
            self.echo_learn -= 1
            self.echo_level = avg
            return False
        loud = avg > max(self.echo_floor, self.echo_ratio * self.echo_level)
        if not loud:                   # keep following the echo, slowly
            self.echo_level = 0.95 * self.echo_level + 0.05 * avg
        return loud

    # --- actions --------------------------------------------------------------

    async def _turn(self, utterance, speech_ms=None):
        async with self.busy:
            loop = asyncio.get_running_loop()
            t0 = loop.time()
            task = asyncio.create_task(self._fetch(utterance))   # filler also covers result TTS
            filler = False
            if not (await asyncio.wait({task}, timeout=self.filler_after))[0]:
                filler = self._play([{"kind": "prerendered", "id": "hmm"}], mark=False)
            try:
                reply = await task
            except Exception as e:
                log.warning("engine failed stream=%s: %r", self.stream_sid, e)
                metrics.turn(call=self.stream_sid, turn=self.turn_no + 1, kind=utterance["kind"],
                             speech_ms=speech_ms, engine_ms=round((loop.time() - t0) * 1000),
                             filler=filler, fallback="engine_error")
                await self._end("sorry")   # never leave the caller in silence
                return
            engine_ms = round((loop.time() - t0) * 1000)
            self.lang = reply.get("lang", self.lang)           # the caller may have picked a language
            self.turn_no += 1
            self._play(reply["say"])
            self.done = self.engine_done = bool(reply.get("terminal"))
            if self.done and not self.speaking:
                self.finished = True
            metrics.turn(call=self.stream_sid, turn=self.turn_no, state=reply.get("state"),
                         kind=utterance["kind"], speech_ms=speech_ms, engine_ms=engine_ms,
                         filler=filler, barge_in=self.barged)
            self.barged = False

    async def _fetch(self, utterance):
        reply = await engine.turn(self.call_sid, self.phone, self.lang, utterance)
        reply["say"] = self._synthesise(reply.get("say", []))
        return reply

    def _synthesise(self, say):
        """Start text-to-speech for the result, one sentence per request, all in parallel.
        The first sentence is usually ready while the pre-recorded intro is still playing."""
        out = []
        for item in say:
            if item.get("kind") == "tts":
                parts = [p.strip() for p in re.split(r"(?<=[।.?!])\s+", item["text"]) if p.strip()]
                item = {"kind": "pending",
                        "tasks": [asyncio.create_task(engine.tts(p, self.lang)) for p in parts]}
            out.append(item)
        return out

    def _play(self, say, mark=True) -> bool:
        """Queue a turn's audio in order. The mark goes last, on its own, so it is sent even
        if a text-to-speech sentence fails."""
        if not say:
            return False
        if not self.speaking:
            self.echo_learn = self.echo_learn_frames     # a new prompt: measure its echo first
        self.speaking = True
        self.feeder = asyncio.create_task(self._feed(say, self._mark() if mark else None))
        return True

    async def _feed(self, say, mark):
        for item in say:
            if item.get("kind") == "prerendered":
                pcm = prompts.resolve(self.bank, item["id"], self.lang)
                if pcm is None:
                    log.warning("missing prompt %s/%s", self.lang, item["id"])
                else:
                    self.player.play(pcm)
            elif item.get("kind") == "pending":
                for t in item["tasks"]:
                    try:
                        self.player.play(await t)
                    except Exception as e:  # the result is saved in ai/; a worker can follow up
                        log.warning("tts failed stream=%s: %r", self.stream_sid, e)
        if mark:
            self.player.play(b"", mark=mark)

    async def _stop_audio(self):
        if self.feeder:
            self.feeder.cancel()
        await self.player.stop()

    async def _barge_in(self):
        self.loud_ms = 0
        await self._stop_audio()
        self.speaking = False
        self.barged = True
        self.quiet = 0
        log.info("barge-in stream=%s turn=%d", self.stream_sid, self.turn_no)

    async def _end(self, prompt_id):
        """Say one local prompt and hang up, without asking ai/."""
        self.done = True
        self.turn_no += 1
        if self.speaking:
            await self._stop_audio()
        if not self._play([{"kind": "prerendered", "id": prompt_id}]):
            self.finished = True

    def _mark(self):
        return f"turn-{self.turn_no}-end"

    async def close(self):
        if self.call_sid and not self.engine_done:
            try:
                await engine.turn(self.call_sid, self.phone, self.lang, engine.HANGUP)
            except Exception as e:     # best effort: ai/ also times sessions out
                log.warning("hangup not delivered: %r", e)
        if self.feeder:
            self.feeder.cancel()
        if self.player:
            await self.player.close()
