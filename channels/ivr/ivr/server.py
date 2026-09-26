"""IVR adapter server: Exotel's Voicebot WebSocket in, ai/ turn API out.

Run:  uvicorn ivr.server:app --port 8000
"""

import hmac
import json
import logging
import os
import time
from pathlib import Path

from fastapi import BackgroundTasks, FastAPI, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse

from . import engine, exotel, prompts
from .call import Call

log = logging.getLogger("ivr")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

app = FastAPI(title="IVR adapter")
BANK = prompts.load()          # fail at startup, not mid-call, if prompts are missing
log.info("loaded %d prompts", len(BANK))


@app.get("/softphone")
def softphone():
    """Browser phone that speaks the Exotel protocol, for testing with a real voice.
    Off unless SOFTPHONE=1: it is a test tool, not something to expose."""
    if os.environ.get("SOFTPHONE") != "1":
        raise HTTPException(404)
    return FileResponse(Path(__file__).with_name("softphone.html"))


@app.get("/health")
def health():
    return {"ok": True, "prompts": len(BANK)}


# ponytail: in-memory dedupe, per process. Move to the DB if we run more than one box.
_recent_missed: dict[str, float] = {}
DEDUPE_SECONDS = 60


@app.api_route("/missed-call", methods=["GET", "POST"])
async def missed_call(request: Request, background: BackgroundTasks):
    """Exotel Passthru applet on the incoming flow. Answer at once; ring back in the background."""
    secret = os.environ.get("MISSED_CALL_SECRET", "")
    if not secret or not hmac.compare_digest(request.query_params.get("key", ""), secret):
        raise HTTPException(403)
    params = dict(request.query_params)
    if request.method == "POST":
        params.update(await request.form())
    caller = params.get("CallFrom") or params.get("From") or ""
    if not caller:
        raise HTTPException(400, "no caller number")

    h, now = engine.phone_hash(caller), time.monotonic()
    for k in [k for k, t in _recent_missed.items() if now - t > DEDUPE_SECONDS]:
        del _recent_missed[k]
    if h in _recent_missed:
        log.info("missed call deduped")
        return {"ok": True, "callback": "deduped"}
    _recent_missed[h] = now
    background.add_task(exotel.place_call, caller)
    log.info("missed call: callback queued")
    return {"ok": True, "callback": "queued"}


def _stream_allowed(ws: WebSocket) -> bool:
    """STREAM_TOKEN set -> the connection must carry it as ?token=… (Exotel allows custom query
    params on the stream URL). Unset = open, for local testing only."""
    token = os.environ.get("STREAM_TOKEN", "")
    return not token or hmac.compare_digest(ws.query_params.get("token", ""), token)


@app.websocket("/stream")
async def stream(ws: WebSocket):
    if not _stream_allowed(ws):
        await ws.close(code=1008)          # policy violation: wrong or missing token
        log.warning("stream rejected: bad token")
        return
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
