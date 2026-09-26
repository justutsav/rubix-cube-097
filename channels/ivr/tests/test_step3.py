import pytest
from fastapi.testclient import TestClient

from conftest import SILENCE, SPEECH, Line, clip, frames
from ivr import engine, prompts, server
from ivr.vad import Endpointer


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
    assert prompts.resolve(bank, "q1", "bho") is not None          # no Bhojpuri q1 yet -> Hindi


def test_phone_is_hashed_not_sent_raw():
    h = engine.phone_hash("+919999999999")
    assert len(h) == 64 and "9999999999" not in h


# --- full call loop against a scripted engine -------------------------------

def test_caller_hears_q1_answers_hears_q2(eng):
    with TestClient(server.app).websocket_connect("/stream") as ws:
        line = Line(ws)
        line.start()

        audio, mark = line.hear()
        assert audio == clip(1, ms=2000)                  # q1
        line.played(mark)

        line.audio(frames(SPEECH) + [SILENCE] * 20)       # caller answers by voice
        audio, mark = line.hear()
        assert audio == clip(2)                           # q2
        line.played(mark)

        line.dtmf("1")                                    # answers by key
        audio, mark = line.hear()
        assert audio == clip(3)                           # goodbye, terminal
        line.played(mark)

        with pytest.raises(Exception):                    # adapter hangs up
            ws.receive_text()

    assert eng.seen == ["opened", "audio", "dtmf"]        # no hangup turn after a finished call
