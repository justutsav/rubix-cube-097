"""Pretend to be Exotel: open the adapter's WebSocket and play a call into it.

Sends connected -> start -> media (20 ms frames, real-time paced) -> optional dtmf -> stop.
With no --wav, sends 2 s of silence.

    python tools/fake_exotel.py
    python tools/fake_exotel.py --wav some_8k_mono.wav --dtmf 1
"""

import argparse
import asyncio
import base64
import json
import wave

import websockets

FRAME = 320  # 20 ms of 8 kHz 16-bit mono


def load_pcm(path):
    if not path:
        return b"\x00" * 16000 * 2
    with wave.open(path) as w:
        if (w.getframerate(), w.getnchannels(), w.getsampwidth()) != (8000, 1, 2):
            raise SystemExit("WAV must be 8 kHz, mono, 16-bit")
        return w.readframes(w.getnframes())


async def listen(ws, got):
    """Collect what the adapter plays back: (arrival time, bytes) per media frame."""
    loop = asyncio.get_running_loop()
    async for text in ws:
        msg = json.loads(text)
        if msg.get("event") == "media":
            got.append((loop.time(), base64.b64decode(msg["media"]["payload"])))
        else:
            print("adapter sent:", msg.get("event"), msg.get("mark", ""))


async def wait_quiet(got, idle=0.5, limit=30):
    """Return once no audio has arrived for `idle` seconds (or `limit` passes)."""
    loop = asyncio.get_running_loop()
    start = loop.time()
    while loop.time() - start < limit:
        last = got[-1][0] if got else start
        if loop.time() - last > idle and (got or loop.time() - start > 2):
            return
        await asyncio.sleep(0.05)


def report(got):
    if not got:
        print("heard nothing back")
        return
    audio_s = sum(len(b) for _, b in got) / 16000
    span_s = got[-1][0] - got[0][0]
    gaps = [b[0] - a[0] for a, b in zip(got, got[1:])]
    print(f"heard {audio_s:.2f}s of audio over {span_s:.2f}s; "
          f"max gap between frames {max(gaps, default=0) * 1000:.0f} ms")


async def call(url, pcm, dtmf, fast):
    sid = "fake-stream-1"
    got = []
    async with websockets.connect(url) as ws:
        listener = asyncio.create_task(listen(ws, got))
        send = lambda m: ws.send(json.dumps(m))
        await send({"event": "connected", "protocol": "Call", "version": "1.0.0"})
        await send({"event": "start", "stream_sid": sid, "start": {
            "stream_sid": sid, "call_sid": "fake-call-1", "account_sid": "fake",
            "from": "+919999999999", "to": "+910000000000",
            "media_format": {"encoding": "audio/x-l16", "sample_rate": 8000, "channels": 1}}})
        for i in range(0, len(pcm), FRAME):
            await send({"event": "media", "stream_sid": sid, "media": {
                "chunk": str(i // FRAME), "timestamp": str(i // 16),
                "payload": base64.b64encode(pcm[i:i + FRAME]).decode()}})
            if not fast:
                await asyncio.sleep(0.02)
        if dtmf:
            await send({"event": "dtmf", "stream_sid": sid, "dtmf": {"digit": dtmf}})
        await wait_quiet(got)
        await send({"event": "stop", "stream_sid": sid,
                    "stop": {"call_sid": "fake-call-1", "reason": "callended"}})
        listener.cancel()
    report(got)


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--url", default="ws://localhost:8000/stream")
    p.add_argument("--wav")
    p.add_argument("--dtmf")
    p.add_argument("--fast", action="store_true", help="no real-time pacing")
    a = p.parse_args()
    asyncio.run(call(a.url, load_pcm(a.wav), a.dtmf, a.fast))
