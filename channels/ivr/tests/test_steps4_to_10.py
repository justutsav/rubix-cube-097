"""Build steps 4-7 and 10: noisy audio, barge-in, keys and silence, fallback, missed call."""

import array
import asyncio
import json
import math
import random

import httpx
import pytest
from fastapi.testclient import TestClient

from conftest import voice, SILENCE, SPEECH, Line, clip, frames
from ivr import exotel, server
from ivr.vad import Endpointer

# --- step 4: end-of-speech on noisy and quiet audio --------------------------

_S = array.array("h", SPEECH)
_RMS = math.sqrt(sum(v * v for v in _S) / len(_S))


def _noise(n, snr_db, seed=1):
    r, level = random.Random(seed), _RMS / 10 ** (snr_db / 20)
    return array.array("h", [int(r.gauss(0, level)) for _ in range(n)])


def _mix(a, b):
    return array.array("h", [max(-32768, min(32767, x + y)) for x, y in zip(a, b)])


def _endpoints(pcm: array.array):
    ep, out = Endpointer(), []
    for i, f in enumerate(frames(pcm.tobytes())):
        u = ep.feed(f)
        if u:
            out.append(((i + 1) * 20, len(u) // 16))     # (ms when fired, utterance ms)
    return out


@pytest.mark.parametrize("snr_db", [30, 20, 15])
def test_endpoint_in_noise(snr_db):
    lead, tail = _noise(8000, snr_db, 2), _noise(16000, snr_db, 3)
    got = _endpoints(lead + _mix(_S, _noise(len(_S), snr_db)) + tail)
    speech_end_ms = (len(lead) + len(_S)) // 8
    assert len(got) == 1                                # one answer, not zero, not split
    assert got[0][0] - speech_end_ms <= 400             # fired soon after the caller stopped


@pytest.mark.parametrize("snr_db", [20, 10, 5])
def test_noise_alone_is_never_an_answer(snr_db):
    assert _endpoints(_noise(24000, snr_db)) == []


@pytest.mark.parametrize("gain", [0.1, 0.03])
def test_quiet_speaker_is_heard(gain):
    quiet = array.array("h", [int(v * gain) for v in _S])
    pad = array.array("h", [0] * 8000)
    assert len(_endpoints(pad + quiet + pad)) == 1


# --- step 5: barge-in ------------------------------------------------------

def test_talking_over_a_prompt_stops_it_and_counts_as_the_answer(eng):
    with TestClient(server.app).websocket_connect("/stream") as ws:
        line = Line(ws)
        line.start()
        line.audio(frames(SPEECH[:12800]))              # caller starts talking over the 2 s q1
        heard, _ = line.hear(until="clear")
        assert len(voice(heard)) < len(clip(1, ms=2000))      # q1 was cut short
        line.audio(frames(SPEECH[12800:]) + [SILENCE] * 20)
        audio, _ = line.hear()
        assert voice(audio) == clip(2)                        # the interrupting speech was the answer
    assert eng.seen[:2] == ["opened", "audio"]


def test_no_barge_in_during_the_first_seconds(eng, monkeypatch):
    """Exotel's own 'this call is being recorded' must not cut our welcome."""
    monkeypatch.setenv("BARGE_IN_GRACE_MS", "4000")
    with TestClient(server.app).websocket_connect("/stream") as ws:
        line = Line(ws)
        line.start()
        line.audio(frames(SPEECH[:12800]))            # 0.8 s of "speech" right at the start
        audio, _ = line.hear()                        # prompt plays to its end: no clear
        assert voice(audio) == clip(1, ms=2000)
    assert eng.seen == ["opened"] or eng.seen == ["opened", "hangup"]


def _scaled(pcm, gain):
    a = array.array("h", pcm)
    return array.array("h", [int(v * gain) for v in a]).tobytes()


def test_speakerphone_echo_does_not_interrupt_but_the_caller_does(eng, monkeypatch):
    monkeypatch.setenv("ECHO_LEARN_MS", "300")
    with TestClient(server.app).websocket_connect("/stream") as ws:
        line = Line(ws)
        line.start()
        echo = _scaled(SPEECH, 0.2)                      # our prompt coming back, quieter
        line.audio(frames(echo + echo))                  # ~2.4 s of echo while q1 plays
        line.audio(frames(SPEECH[:12800]))               # then the caller talks into the phone
        heard, _ = line.hear(until="clear")              # that interrupts
        assert len(voice(heard)) < len(clip(1, ms=2000))


def test_speakerphone_echo_alone_lets_the_prompt_finish(eng, monkeypatch):
    monkeypatch.setenv("ECHO_LEARN_MS", "300")
    with TestClient(server.app).websocket_connect("/stream") as ws:
        line = Line(ws)
        line.start()
        line.audio(frames(_scaled(SPEECH, 0.2) * 2))
        audio, _ = line.hear()                          # no clear: the whole q1 is heard
        assert voice(audio) == clip(1, ms=2000)


def test_echo_tail_right_after_a_prompt_is_not_an_answer(eng, monkeypatch):
    monkeypatch.setenv("POST_PROMPT_GUARD_MS", "300")
    with TestClient(server.app).websocket_connect("/stream") as ws:
        line = Line(ws)
        line.start()
        _, mark = line.hear()
        line.played(mark)
        line.audio(frames(SPEECH[:4000]) + [SILENCE] * 30)   # 250 ms tail of our own voice
        line.audio([SILENCE] * 5)
    assert eng.seen[:2] == ["opened", "hangup"] or eng.seen == ["opened"]   # no audio turn sent


def test_key_press_during_a_prompt_stops_it(eng):
    with TestClient(server.app).websocket_connect("/stream") as ws:
        line = Line(ws)
        line.start()
        line.dtmf("1")
        line.hear(until="clear")
        audio, _ = line.hear()
        assert voice(audio) == clip(2)
    assert eng.seen[:2] == ["opened", "dtmf"]


# --- step 6: silence ------------------------------------------------------

def test_silence_after_a_prompt_sends_a_timeout_turn(eng, monkeypatch):
    monkeypatch.setenv("NO_INPUT_TIMEOUT_MS", "200")   # 10 frames
    with TestClient(server.app).websocket_connect("/stream") as ws:
        line = Line(ws)
        line.start()
        _, mark = line.hear()
        line.played(mark)
        line.audio([SILENCE] * 12)
        audio, _ = line.hear()
        assert voice(audio) == clip(2)
    assert eng.seen[:2] == ["opened", "timeout"]


def test_max_call_length_says_goodbye(eng, monkeypatch):
    monkeypatch.setenv("MAX_CALL_SECONDS", "1")        # 50 frames
    with TestClient(server.app).websocket_connect("/stream") as ws:
        line = Line(ws)
        line.start()
        _, mark = line.hear()
        line.played(mark)
        line.audio([SILENCE] * 55)
        audio, mark = line.hear()
        assert voice(audio) == clip(6)                        # local goodbye, no engine needed
        line.played(mark)
        with pytest.raises(Exception):
            ws.receive_text()
    assert eng.seen == ["opened", "hangup"]            # engine still told the call ended


# --- step 7: slow or failed engine -------------------------------------------

def test_slow_engine_plays_filler(eng, monkeypatch):
    monkeypatch.setenv("FILLER_AFTER_MS", "50")
    eng.delay = 0.2
    with TestClient(server.app).websocket_connect("/stream") as ws:
        line = Line(ws)
        line.start()
        audio, _ = line.hear()
        assert voice(audio) == clip(4) + clip(1, ms=2000)     # "hmm" first, then q1


def test_engine_failure_apologises_and_hangs_up(eng):
    eng.fail_on = 1
    with TestClient(server.app).websocket_connect("/stream") as ws:
        line = Line(ws)
        line.start()
        _, mark = line.hear()
        line.played(mark)
        line.dtmf("1")
        audio, mark = line.hear()
        assert voice(audio) == clip(5)                        # "sorry, we'll call you back"
        line.played(mark)
        with pytest.raises(Exception):
            ws.receive_text()


def test_metrics_line_per_turn_without_phone_number(eng, caplog):
    caplog.set_level("INFO", logger="ivr.metrics")
    with TestClient(server.app).websocket_connect("/stream") as ws:
        line = Line(ws)
        line.start()
        _, mark = line.hear()
        line.played(mark)
        line.dtmf("1")
        line.hear()
    lines = [r.getMessage() for r in caplog.records if r.name == "ivr.metrics"]
    assert len(lines) == 2 and '"engine_ms"' in lines[0]
    assert "9999999999" not in caplog.text


# --- step 10: missed call -> callback ---------------------------------------

@pytest.fixture
def missed(monkeypatch):
    monkeypatch.setenv("MISSED_CALL_SECRET", "s3cret")
    server._recent_missed.clear()
    placed = []

    async def fake_place(to, transport=None):
        placed.append(to)
        return True

    monkeypatch.setattr(exotel, "place_call", fake_place)
    return placed


def test_missed_call_queues_one_callback(missed):
    c = TestClient(server.app)
    r = c.get("/missed-call", params={"key": "s3cret", "CallFrom": "09999999999"})
    assert r.json()["callback"] == "queued" and missed == ["09999999999"]
    r = c.post("/missed-call?key=s3cret", data={"CallFrom": "09999999999"})
    assert r.json()["callback"] == "deduped" and len(missed) == 1


def test_missed_call_rejects_wrong_or_missing_key(missed):
    c = TestClient(server.app)
    assert c.get("/missed-call", params={"CallFrom": "0999"}).status_code == 403
    assert c.get("/missed-call", params={"key": "nope", "CallFrom": "0999"}).status_code == 403
    assert missed == []


EXOTEL_ENV = {"EXOTEL_SID": "acme", "EXOTEL_API_KEY": "k", "EXOTEL_API_TOKEN": "t",
              "EXOTEL_CALLER_ID": "08000000000", "EXOTEL_STREAM_URL": "wss://bot.example/stream"}


def _exotel(monkeypatch, statuses):
    for k, v in EXOTEL_ENV.items():
        monkeypatch.setenv(k, v)
    monkeypatch.setattr(exotel, "RETRY_BASE_S", 0)
    calls = []

    def handler(req):
        calls.append(req)
        return httpx.Response(statuses[min(len(calls), len(statuses)) - 1])

    return calls, httpx.MockTransport(handler)


def test_place_call_posts_to_exotel(monkeypatch):
    calls, t = _exotel(monkeypatch, [200])
    assert asyncio.run(exotel.place_call("09999999999", transport=t))
    req = calls[0]
    assert req.url.path == "/v1/Accounts/acme/Calls/connect"
    assert b"From=09999999999" in req.content and b"CallerId=08000000000" in req.content
    assert b"StreamType=bidirectional" in req.content and b"StreamUrl=" in req.content


def test_place_call_retries_server_errors_not_client_errors(monkeypatch):
    calls, t = _exotel(monkeypatch, [503, 503, 200])
    assert asyncio.run(exotel.place_call("0999", transport=t)) and len(calls) == 3
    calls, t = _exotel(monkeypatch, [400])
    assert not asyncio.run(exotel.place_call("0999", transport=t)) and len(calls) == 1


def test_place_call_without_settings_does_nothing(monkeypatch):
    for k in EXOTEL_ENV:
        monkeypatch.delenv(k, raising=False)
    assert not asyncio.run(exotel.place_call("0999"))


def test_stream_token_required_when_set(eng, monkeypatch):
    import base64 as b64
    monkeypatch.setenv("STREAM_TOKEN", "t0ken")
    c = TestClient(server.app)

    def call(path="/stream", headers=None, params=None):
        with c.websocket_connect(path, headers=headers or {}) as ws:
            ws.send_text(json.dumps({"event": "connected"}))
            ws.send_text(json.dumps({"event": "start", "stream_sid": "s1", "start": {
                "call_sid": "c1", "from": "+911", "custom_parameters": params or {}}}))
            audio, _ = Line(ws).hear()
            return voice(audio)

    # each accepted call hears a prompt (the scripted engine moves on across calls)
    assert call("/stream?token=t0ken")                                       # query (softphone)
    assert call(headers={"authorization": "Basic " + b64.b64encode(b"x:t0ken").decode()})
    assert call(params={"token": "t0ken"})                                   # Exotel custom parameter
    for bad in ({"params": {"token": "nope"}}, {}):                          # wrong / missing
        with pytest.raises(Exception):
            call(**bad)
