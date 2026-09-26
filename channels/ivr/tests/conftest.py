"""Shared test helpers: fixture audio, a scripted in-process engine, a fake-Exotel socket."""

import asyncio
import base64
import json
import wave
from pathlib import Path

import pytest

from ivr import engine, server

FIX = Path(__file__).resolve().parent.parent / "tools" / "fixtures"
with wave.open(str(FIX / "answer_tailoring.wav")) as _w:
    SPEECH = _w.readframes(_w.getnframes())
SILENCE = b"\x00" * 320


def frames(pcm):
    pcm += b"\x00" * (-len(pcm) % 320)
    return [pcm[i:i + 320] for i in range(0, len(pcm), 320)]


def voice(audio):
    """Played audio without the silence Exotel's 3,200-byte chunks are padded with."""
    return audio.replace(b"\x00", b"")


def clip(n, ms=40):
    """A fake prompt: `ms` of one repeated byte, so tests can tell prompts apart."""
    return bytes([n]) * (ms * 16)


class Line:
    """The Exotel side of the WebSocket, for tests."""

    def __init__(self, ws):
        self.ws = ws

    def send(self, m):
        self.ws.send_text(json.dumps(m))

    def start(self):
        self.send({"event": "start", "stream_sid": "s1",
                   "start": {"call_sid": "c1", "from": "+919999999999"}})

    def audio(self, pcm_frames):
        for f in pcm_frames:
            self.send({"event": "media", "stream_sid": "s1",
                       "media": {"payload": base64.b64encode(f).decode()}})

    def dtmf(self, d):
        self.send({"event": "dtmf", "stream_sid": "s1", "dtmf": {"digit": d}})

    def hear(self, until="mark"):
        """Collect played audio until an event of kind `until`; returns (audio, that message)."""
        audio = b""
        while True:
            msg = json.loads(self.ws.receive_text())
            if msg["event"] == "media":
                audio += base64.b64decode(msg["media"]["payload"])
            if msg["event"] == until:
                return audio, msg

    def played(self, msg):
        """Echo a mark back, as Exotel does once the audio before it has been played."""
        self.send({"event": "mark", "stream_sid": "s1", "mark": msg["mark"]})


class ScriptedEngine:
    """In-process stand-in for ai/: plays script[i] on the i-th non-hangup turn."""

    def __init__(self, script):
        self.script, self.seen, self.delay, self.fail_on = script, [], 0.0, None

    async def turn(self, call_sid, phone, lang, utt):
        self.seen.append(utt["kind"])
        i = len([k for k in self.seen if k != "hangup"]) - 1
        if self.delay:
            await asyncio.sleep(self.delay)
        if self.fail_on == i:
            raise RuntimeError("engine down")
        i = min(i, len(self.script) - 1)
        return {"state": f"S{i}", "say": [{"kind": "prerendered", "id": p} for p in self.script[i]],
                "terminal": i == len(self.script) - 1}


@pytest.fixture(autouse=True)
def _no_local_env(monkeypatch):
    """Tests must not depend on a developer's channels/ivr/.env (e.g. a live STREAM_TOKEN)."""
    for k in ("STREAM_TOKEN", "MISSED_CALL_SECRET"):
        monkeypatch.delenv(k, raising=False)
    monkeypatch.setenv("BARGE_IN_GRACE_MS", "0")      # tests interrupt the very first prompt
    monkeypatch.setenv("BARGE_IN_SPEECH_MS", "400")   # tests check the mechanism, not the tuned value


@pytest.fixture
def eng(monkeypatch):
    """Scripted engine + small distinct prompts: q1 (long, so it can be interrupted),
    q2, bye, hmm, sorry, goodbye."""
    monkeypatch.setattr(server, "BANK", {
        ("hi", "q1"): clip(1, ms=2000), ("hi", "q2"): clip(2), ("hi", "bye"): clip(3),
        ("hi", "hmm"): clip(4), ("hi", "sorry"): clip(5), ("hi", "goodbye"): clip(6)})
    e = ScriptedEngine([["q1"], ["q2"], ["bye"]])
    monkeypatch.setattr(engine, "turn", e.turn)
    return e
