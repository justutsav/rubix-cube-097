import base64
import json

from fastapi.testclient import TestClient

from ivr import exotel
from ivr.server import app


def test_parse_roundtrip():
    pcm = b"\x01\x02" * 160
    ev = exotel.parse(exotel.media("s1", pcm))
    assert (ev.kind, ev.stream_sid, ev.pcm) == ("media", "s1", pcm)

    ev = exotel.parse(json.dumps({"event": "start", "stream_sid": "s1", "start": {
        "call_sid": "c1", "from": "+911", "to": "+912"}}))
    assert (ev.kind, ev.call_sid, ev.caller, ev.called) == ("start", "c1", "+911", "+912")

    assert exotel.parse(json.dumps({"event": "dtmf", "dtmf": {"digit": "1"}})).digit == "1"
    assert exotel.parse(json.dumps({"event": "surprise"})).kind == "unknown"


def test_stream_survives_a_full_call(caplog):
    caplog.set_level("INFO")
    with TestClient(app).websocket_connect("/stream") as ws:
        ws.send_text(json.dumps({"event": "connected"}))
        ws.send_text(json.dumps({"event": "start", "stream_sid": "s1",
                                 "start": {"call_sid": "c1", "from": "+919999999999"}}))
        ws.send_text("not json")                                    # dropped, not fatal
        ws.send_text(json.dumps({"event": "new-thing"}))            # unknown, not fatal
        for _ in range(50):                                         # 1 s of audio
            ws.send_text(json.dumps({"event": "media", "stream_sid": "s1", "media": {
                "payload": base64.b64encode(b"\x00" * 320).decode()}}))
        ws.send_text(json.dumps({"event": "dtmf", "stream_sid": "s1", "dtmf": {"digit": "1"}}))
        ws.send_text(json.dumps({"event": "stop", "stream_sid": "s1", "stop": {"reason": "done"}}))

    text = caplog.text
    assert "start stream=s1" in text and "digit=1" in text and "audio=1.0s" in text
    assert "9999999999" not in text                                 # raw number never logged
