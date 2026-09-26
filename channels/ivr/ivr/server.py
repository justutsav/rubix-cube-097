"""IVR adapter server: Exotel's Voicebot WebSocket in, ai/ turn API out.

Run:  uvicorn ivr.server:app --port 8000
"""

import json
import logging

from fastapi import FastAPI, WebSocket, WebSocketDisconnect

from . import exotel, prompts
from .call import Call

log = logging.getLogger("ivr")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

app = FastAPI(title="IVR adapter")
BANK = prompts.load()          # fail at startup, not mid-call, if prompts are missing
log.info("loaded %d prompts", len(BANK))


@app.get("/health")
def health():
    return {"ok": True, "prompts": len(BANK)}


@app.websocket("/stream")
async def stream(ws: WebSocket):
    await ws.accept()
    call = Call(ws.send_text, BANK)
    media_bytes = 0
    try:
        while not call.finished:
            try:
                ev = exotel.parse(await ws.receive_text())
            except (json.JSONDecodeError, ValueError) as e:
                log.warning("bad frame dropped: %s", e)
                continue

            if ev.kind == "media":
                media_bytes += len(ev.pcm)
            elif ev.kind == "start":
                log.info("start stream=%s call=%s", ev.stream_sid, ev.call_sid)   # never log the number
            elif ev.kind == "dtmf":
                log.info("dtmf stream=%s digit=%s", call.stream_sid, ev.digit)
            elif ev.kind == "stop":
                log.info("stop stream=%s reason=%s audio=%.1fs",
                         call.stream_sid, ev.reason, media_bytes / 16000)
                break
            elif ev.kind != "mark":
                log.info("%s event stream=%s", ev.kind, call.stream_sid)
            await call.on_event(ev)
        if call.finished:
            log.info("finished stream=%s turns=%d", call.stream_sid, call.turn_no)
            await ws.close()   # Exotel moves on to the next applet (hang-up)
    except WebSocketDisconnect:
        # socket closed without a stop frame: same as a hang-up
        log.info("disconnect stream=%s audio=%.1fs", call.stream_sid, media_bytes / 16000)
    finally:
        await call.close()
