import base64
import json
import wave
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from ivr import engine, prompts, server
from ivr.vad import Endpointer

FIX = Path(__file__).resolve().parent.parent / "tools" / "fixtures"
SPEECH = wave.open(str(FIX / "answer_tailoring.wav")).readframes(10 ** 6)
SILENCE = b"\x00" * 320


def frames(pcm):
    pcm += b"\x00" * (-len(pcm) % 320)
    return [pcm[i:i + 320] for i in range(0, len(pcm), 320)]


# --- VAD ------------------------------------------------------------------

def test_endpoint_fires_once_after_speech_then_silence():
    ep = Endpointer()
    out = [ep.feed(f) for f in frames(SPEECH) + [SILENCE] * 50]
    got = [u for u in out if u]
    assert len(got) == 1
    assert len(got[0]) >= len(SPEECH) * 0.6          # most of the answer kept


def test_silence_and_a_click_are_not_answers():
    ep = Endpointer()
    assert not any(ep.feed(SILENCE) for _ in range(100))
    click = frames(SPEECH)[10:14]                     # 80 ms of speech
    assert not any(ep.feed(f) for f in click + [SILENCE] * 50)


# --- prompts --------------------------------------------------------------

def test_prompt_bank_loads_and_resolves():
    bank = prompts.load()
    assert prompts.resolve(bank, "q1", "hi")
    assert prompts.resolve(bank, "q1.hi.v3", "en") == prompts.resolve(bank, "q1", "hi")
    assert prompts.resolve(bank, "nope", "hi") is None


def test_phone_is_hashed_not_sent_raw():
    h = engine.phone_hash("+919999999999")
    assert len(h) == 64 and "9999999999" not in h


# --- full call loop against a scripted engine -------------------------------

@pytest.fixture
def scripted(monkeypatch):
    """Tiny prompts (fast to 'play') and an in-process engine that records what it got."""
    clip = lambda n: bytes([n]) * 640                # 40 ms, distinct per prompt
    monkeypatch.setattr(server, "BANK", {("hi", "q1"): clip(1), ("hi", "q2"): clip(2),
                                          ("hi", "bye"): clip(3)})
    seen = []
    script = [["q1"], ["q2"], ["bye"]]

    async def turn(call_sid, phone, lang, utt):
        seen.append(utt["kind"])
        i = len([k for k in seen if k != "hangup"]) - 1
        return {"state": f"S{i}", "say": [{"kind": "prerendered", "id": p} for p in script[i]],
                "terminal": i == len(script) - 1}

    monkeypatch.setattr(engine, "turn", turn)
    return seen


def hear_until_mark(ws):
    audio = b""
    while True:
        msg = json.loads(ws.receive_text())
        if msg["event"] == "media":
            audio += base64.b64decode(msg["media"]["payload"])
        elif msg["event"] == "mark":
            return audio, msg["mark"]


def test_caller_hears_q1_answers_hears_q2(scripted):
    with TestClient(server.app).websocket_connect("/stream") as ws:
        send = lambda m: ws.send_text(json.dumps(m))
        send({"event": "start", "stream_sid": "s1", "start": {"call_sid": "c1", "from": "+911"}})

        audio, mark = hear_until_mark(ws)
        assert audio == bytes([1]) * 640                              # q1
        send({"event": "mark", "stream_sid": "s1", "mark": mark})     # Exotel: q1 played

        for f in frames(SPEECH) + [SILENCE] * 20:                     # caller answers by voice
            send({"event": "media", "stream_sid": "s1",
                  "media": {"payload": base64.b64encode(f).decode()}})
        audio, mark = hear_until_mark(ws)
        assert audio == bytes([2]) * 640                              # q2
        send({"event": "mark", "stream_sid": "s1", "mark": mark})

        send({"event": "dtmf", "stream_sid": "s1", "dtmf": {"digit": "1"}})   # answers by key
        audio, mark = hear_until_mark(ws)
        assert audio == bytes([3]) * 640                              # goodbye, terminal
        send({"event": "mark", "stream_sid": "s1", "mark": mark})

        with pytest.raises(Exception):                                # adapter hangs up
            ws.receive_text()

    assert scripted == ["opened", "audio", "dtmf"]                    # no hangup turn after a finished call


def test_audio_during_a_prompt_is_ignored(scripted):
    with TestClient(server.app).websocket_connect("/stream") as ws:
        send = lambda m: ws.send_text(json.dumps(m))
        send({"event": "start", "stream_sid": "s1", "start": {"call_sid": "c1"}})
        hear_until_mark(ws)                                           # mark NOT echoed yet: still playing
        for f in frames(SPEECH) + [SILENCE] * 20:
            send({"event": "media", "stream_sid": "s1",
                  "media": {"payload": base64.b64encode(f).decode()}})
        send({"event": "stop", "stream_sid": "s1", "stop": {}})
    assert scripted == ["opened", "hangup"]                           # talk-over not taken as an answer (barge-in: step 5)
