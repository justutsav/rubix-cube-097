"""IVR adapter server. Build step 1: accept Exotel's stream and log every event.

Run:  uvicorn ivr.server:app --port 8000
"""

import json
import logging

from fastapi import FastAPI, WebSocket, WebSocketDisconnect

from . import exotel

log = logging.getLogger("ivr")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

app = FastAPI(title="IVR adapter")


@app.get("/health")
def health():
    return {"ok": True}


@app.websocket("/stream")
async def stream(ws: WebSocket):
    await ws.accept()
    stream_sid = ""
    media_bytes = 0
    try:
        while True:
            try:
                ev = exotel.parse(await ws.receive_text())
            except (json.JSONDecodeError, ValueError) as e:
                log.warning("bad frame dropped: %s", e)
                continue

            if ev.kind == "start":
                stream_sid = ev.stream_sid
                # never log the raw number
                log.info("start stream=%s call=%s", stream_sid, ev.call_sid)
            elif ev.kind == "media":
                media_bytes += len(ev.pcm)
            elif ev.kind == "dtmf":
                log.info("dtmf stream=%s digit=%s", stream_sid, ev.digit)
            elif ev.kind == "stop":
                log.info("stop stream=%s reason=%s audio=%.1fs",
                         stream_sid, ev.reason, media_bytes / 16000)
                break
            else:
                log.info("%s event stream=%s", ev.kind, stream_sid)
    except WebSocketDisconnect:
        # socket closed without a stop frame: same as a hang-up
        log.info("disconnect stream=%s audio=%.1fs", stream_sid, media_bytes / 16000)
