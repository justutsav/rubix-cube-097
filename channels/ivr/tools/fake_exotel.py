"""Pretend to be Exotel + a caller: open the adapter's WebSocket and hold a call.

Like real Exotel it streams caller audio non-stop (silence between answers, 20 ms frames,
real-time paced) and echoes each `mark` back once the audio before it has been played.
Like a caller, it answers after every prompt, cycling through the --answers WAVs.

Reports, per turn, the silence the caller heard: end of their answer -> first reply audio.

    python tools/fake_exotel.py                                   # uses tools/fixtures answers
    python tools/fake_exotel.py --answers my.wav --dtmf 1 --max-turns 3
    python tools/fake_exotel.py --dtmf 1 --barge-in               # caller talks over prompts
"""

import argparse
import asyncio
import base64
import json
import wave
from itertools import cycle
from pathlib import Path

import websockets

FRAME = 320                         # 20 ms of 8 kHz 16-bit mono
SILENCE = b"\x00" * FRAME
FIXTURES = Path(__file__).resolve().parent / "fixtures"


def load_pcm(path):
    with wave.open(str(path)) as w:
        if (w.getframerate(), w.getnchannels(), w.getsampwidth()) != (8000, 1, 2):
            raise SystemExit(f"{path}: WAV must be 8 kHz, mono, 16-bit")
        return w.readframes(w.getnframes())


class FakeCall:
    def __init__(self, ws, answers, dtmf, max_turns, barge_in):
        self.ws, self.answers, self.dtmf, self.max_turns = ws, answers, dtmf, max_turns
        self.barge_in = barge_in          # answer 0.5 s into each prompt instead of waiting
        self.prompt_started = False
        self.sid = "fake-stream-1"
        self.outgoing: list[bytes] = []   # caller frames waiting to be streamed
        self.answer_ended_at = None
        self.silences = []                # ms of silence heard per turn
        self.turns = 0

    async def send(self, msg):
        await self.ws.send(json.dumps(msg))

    async def mic(self):
        """Stream caller audio forever, like a phone line: answer frames, else silence."""
        loop = asyncio.get_running_loop()
        t, n = loop.time(), 0
        while True:
            frame = self.outgoing.pop(0) if self.outgoing else SILENCE
            await self.send({"event": "media", "stream_sid": self.sid, "media": {
                "chunk": str(n), "timestamp": str(n * 20),
                "payload": base64.b64encode(frame).decode()}})
            if not self.outgoing and frame is not SILENCE and self.answer_ended_at is None:
                self.answer_ended_at = loop.time()
            n += 1
            t += 0.02
            await asyncio.sleep(max(0, t - loop.time()))

    async def speaker(self):
        """Hear the adapter: time the first reply frame, echo marks, then answer."""
        loop = asyncio.get_running_loop()
        async for text in self.ws:
            msg = json.loads(text)
            ev = msg.get("event")
            if ev == "media" and self.answer_ended_at is not None:
                self.silences.append((loop.time() - self.answer_ended_at) * 1000)
                self.answer_ended_at = None
            if ev == "media" and self.barge_in and not self.prompt_started and self.turns >= 1:
                self.prompt_started = True
                loop.call_later(0.5, lambda: self.outgoing.extend(chunks(next(self.answers))))
                print("  talking over the prompt")
            elif ev == "clear":
                print("  adapter stopped its prompt (barge-in)")
                self.prompt_started = False          # the reply to our answer is a new prompt
            elif ev == "mark":
                await asyncio.sleep(0.1)            # adapter sends ~100 ms ahead of playback
                await self.send({"event": "mark", "stream_sid": self.sid, "mark": msg["mark"]})
                print(f"heard prompt set, mark={msg['mark']['name']}")
                self.turns += 1
                if self.turns > self.max_turns:
                    print("max turns reached, hanging up")
                    return
                self.prompt_started = False
                if self.barge_in and self.turns >= 2:
                    continue                         # already answered over the prompt
                await asyncio.sleep(0.4)            # a human pauses before answering
                if self.dtmf and self.turns == 1:
                    await self.send({"event": "dtmf", "stream_sid": self.sid,
                                     "dtmf": {"digit": self.dtmf}})
                    print(f"  pressed {self.dtmf}")
                else:
                    self.outgoing += [p for p in chunks(next(self.answers))]
                    print("  answered")
        print("adapter closed the call")

    async def run(self):
        await self.send({"event": "connected", "protocol": "Call", "version": "1.0.0"})
        await self.send({"event": "start", "stream_sid": self.sid, "start": {
            "stream_sid": self.sid, "call_sid": "fake-call-1", "account_sid": "fake",
            "from": "+919999999999", "to": "+910000000000",
            "media_format": {"encoding": "audio/x-l16", "sample_rate": 8000, "channels": 1}}})
        mic = asyncio.create_task(self.mic())
        try:
            await self.speaker()
            await self.send({"event": "stop", "stream_sid": self.sid,
                             "stop": {"call_sid": "fake-call-1", "reason": "callended"}})
        except websockets.ConnectionClosed:
            pass
        finally:
            mic.cancel()


def chunks(pcm):
    pcm += b"\x00" * (-len(pcm) % FRAME)
    return [pcm[i:i + FRAME] for i in range(0, len(pcm), FRAME)]


async def main(a):
    files = a.answers or sorted(FIXTURES.glob("*.wav"))
    answers = cycle([load_pcm(f) for f in files])
    async with websockets.connect(a.url) as ws:
        call = FakeCall(ws, answers, a.dtmf, a.max_turns, a.barge_in)
        await call.run()
    s = sorted(call.silences)
    if s:
        print(f"{len(s)} replies; silence after answer p50 {s[len(s) // 2]:.0f} ms, "
              f"max {s[-1]:.0f} ms")


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--url", default="ws://localhost:8000/stream")
    p.add_argument("--answers", nargs="*", type=Path)
    p.add_argument("--dtmf", help="press this key instead of speaking on the first turn")
    p.add_argument("--max-turns", type=int, default=20)
    p.add_argument("--barge-in", action="store_true", help="interrupt every prompt after the first two")
    asyncio.run(main(p.parse_args()))
