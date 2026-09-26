"""The engine's HTTP API. Every channel calls the same endpoints (spec §1.1).

  POST /v1/turn            one caller turn in, what to say next out
  GET  /v1/prompts/{lang}  every fixed prompt: id -> text (channels pre-render these)
  POST /v1/tts             the personalised tail as 16-bit PCM (IVR asks for 8 kHz)
  GET  /health

Run:  uv run uvicorn engine.server:app --port 8001
"""

import base64
import binascii
import logging
from typing import Literal, Union

from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field

from . import asr, prompts, recommend, tts
from .flow import Flow, Input
from .store import Store

log = logging.getLogger("engine")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

app = FastAPI(title="PS 26097 interview engine")
STORE = Store()
if asr.PROVIDER == "vosk":
    asr.transcribe(b"\x00" * 3200, 8000)       # load the model now, not on the first caller
MAX_AUDIO_B64 = 700_000        # ~20 s of 8 kHz 16-bit audio; longer is not an answer


class Identity(BaseModel):
    kind: Literal["msisdn_hash", "device"]
    value: str = Field(min_length=8, max_length=128)


class Audio(BaseModel):
    kind: Literal["audio"]
    format: Literal["l16"] = "l16"
    rate: Literal[8000, 16000] = 8000
    data: str = Field(max_length=MAX_AUDIO_B64)


class Dtmf(BaseModel):
    kind: Literal["dtmf"]
    digits: str = Field(pattern=r"^[0-9*#]{1,8}$")


class Text(BaseModel):
    kind: Literal["text"]
    value: str = Field(max_length=500)


class Bare(BaseModel):
    kind: Literal["opened", "timeout", "hangup"]


class TurnRequest(BaseModel):
    channel: Literal["ivr", "whatsapp", "app"]
    channel_ref: str = Field(min_length=1, max_length=128)
    identity: Identity
    utterance: Union[Audio, Dtmf, Text, Bare] = Field(discriminator="kind")
    locale_hint: str = "hi-IN"


def _input(u) -> Input:
    if u.kind == "audio":
        try:
            pcm = base64.b64decode(u.data, validate=True)
        except binascii.Error:
            raise HTTPException(422, "audio.data is not base64")
        return Input("audio", nbest=asr.transcribe(pcm, u.rate))
    if u.kind == "text":
        return Input("text", nbest=[u.value])
    if u.kind == "dtmf":
        return Input("dtmf", digits=u.digits)
    return Input(u.kind)


@app.post("/v1/turn")
def turn(req: TurnRequest):
    with STORE.lock:
        s = STORE.session(req.channel_ref)
        if s is None:
            s = STORE.new_session(req.channel, req.channel_ref, req.identity.value, {"at": "NEW"})
        if req.utterance.kind == "hangup":
            if s["status"] == "ACTIVE":
                s["status"] = "RESUMABLE"
                STORE.save_session(s)
            return {"session_id": s["id"], "state": "HANGUP", "say": [], "expect": {"kind": "none"},
                    "terminal": True}
        out = Flow(STORE, s, req.channel).step(_input(req.utterance))
        STORE.save_session(s)
        log.info("turn session=%s kind=%s -> %s", s["id"][:8], req.utterance.kind, out["state"])
        return out


@app.get("/v1/prompts/{lang}")
def prompt_catalogue(lang: str):
    try:
        return prompts.catalogue(lang)
    except KeyError:
        raise HTTPException(404, f"no prompts for {lang}")


class TtsRequest(BaseModel):
    text: str = Field(min_length=1, max_length=2000)
    lang: str = "hi"
    rate: Literal[8000, 16000] = 8000


@app.post("/v1/tts")
def speak(req: TtsRequest):
    try:
        pcm = tts.synth(req.text, req.lang, req.rate)
    except Exception as e:
        log.warning("tts failed: %r", e)
        raise HTTPException(503, "tts unavailable")
    return Response(pcm, media_type=f"audio/l16;rate={req.rate}")


@app.get("/health")
def health():
    return {"ok": True, "asr": asr.PROVIDER, "tts": tts.PROVIDER,
            "nqr_rows": recommend.register()["count"], "nqr_sha": recommend.register()["sha256"][:12]}
