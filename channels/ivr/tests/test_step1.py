import json

from ivr import exotel


def test_parse_roundtrip():
    pcm = b"\x01\x02" * 160
    ev = exotel.parse(exotel.media("s1", pcm))
    assert (ev.kind, ev.stream_sid, ev.pcm) == ("media", "s1", pcm)

    ev = exotel.parse(json.dumps({"event": "start", "stream_sid": "s1", "start": {
        "call_sid": "c1", "from": "+911", "to": "+912"}}))
    assert (ev.kind, ev.call_sid, ev.caller, ev.called) == ("start", "c1", "+911", "+912")

    assert exotel.parse(json.dumps({"event": "dtmf", "dtmf": {"digit": "1"}})).digit == "1"
    assert exotel.parse(json.dumps({"event": "surprise"})).kind == "unknown"
