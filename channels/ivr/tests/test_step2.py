import asyncio
import base64
import json
import time

from fastapi.testclient import TestClient

from ivr import audio
from ivr.server import app


def test_frames_are_20ms():
    parts = list(audio.frames(b"\x00" * 1000))
    assert [len(p) for p in parts] == [320, 320, 320, 40]


def test_player_paces_to_real_time_and_marks_the_end():
    async def run():
        sent = []
        loop = asyncio.get_running_loop()

        async def send(text):
            sent.append((loop.time(), json.loads(text)))

        p = audio.Player(send, "s1")
        p.play(b"\x00" * 16000, mark="q1.end")      # 1 s clip
        start = loop.time()
        while not sent or sent[-1][1]["event"] != "mark":
            await asyncio.sleep(0.01)
        await p.close()
        return start, sent

    start, sent = asyncio.run(run())
    media = [t for t, m in sent if m["event"] == "media"]
    assert len(media) == 50
    assert sent[-1][1]["mark"]["name"] == "q1.end"
    # all sent within the lead window of real time: not dumped at once, not late
    assert 0.85 <= media[-1] - start <= 1.0


def test_echo_returns_the_same_audio_paced():
    pcm = bytes(range(256)) * 62 + b"\x00" * 128        # 16000 bytes = 1 s
    with TestClient(app).websocket_connect("/stream") as ws:
        ws.send_text(json.dumps({"event": "start", "stream_sid": "s1", "start": {}}))
        t0 = time.monotonic()
        for f in audio.frames(pcm):                     # sent fast, not paced
            ws.send_text(json.dumps({"event": "media", "stream_sid": "s1",
                                     "media": {"payload": base64.b64encode(f).decode()}}))
        back = b""
        while len(back) < len(pcm):
            msg = json.loads(ws.receive_text())
            back += base64.b64decode(msg["media"]["payload"])
        elapsed = time.monotonic() - t0
        ws.send_text(json.dumps({"event": "stop", "stream_sid": "s1", "stop": {}}))

    assert back == pcm
    assert elapsed >= 0.85          # paced by the adapter, not bounced straight back
