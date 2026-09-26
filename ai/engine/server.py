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
import os
from typing import Literal, Union

from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field

from . import asr, extract, llm, prompts, recommend, tts
from .flow import FIELDS, Flow, Input, _field, _normalise, ai_options
from .store import Store

log = logging.getLogger("engine")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

app = FastAPI(title="PS 26097 interview engine")
STORE = Store()
asr.warm_up()                                  # models and connections ready before the first caller
tts.warm_up()
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


def _input(u, lang="hi") -> Input:
    if u.kind == "audio":
        try:
            pcm = base64.b64decode(u.data, validate=True)
        except binascii.Error:
            raise HTTPException(422, "audio.data is not base64")
        return Input("audio", nbest=asr.transcribe(pcm, u.rate, lang))
    if u.kind == "text":
        return Input("text", nbest=[u.value])
    if u.kind == "dtmf":
        return Input("dtmf", digits=u.digits)
    return Input(u.kind)


@app.post("/v1/turn")
def turn(req: TurnRequest):
    known = STORE.session(req.channel_ref)                    # the call's language picks the speech model
    lang = (known or {}).get("state", {}).get("lang", "hi")
    inp = _input(req.utterance, lang)      # speech-to-text outside the lock: calls must not queue on it
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
        if inp.nbest is not None and os.environ.get("ENGINE_LOG_TRANSCRIPTS") == "1":
            log.info("debug: heard %s (asr=%s)", inp.nbest[:3], asr.last_used())   # test calls only
        out = Flow(STORE, s, req.channel).step(inp)
        STORE.save_session(s)
        log.info("turn session=%s kind=%s -> %s", s["id"][:8], req.utterance.kind, out["state"])
        return out


class ExtractRequest(BaseModel):
    field: str = Field(pattern=r"^(q0|q1|q2|q2_years|q3|q4|q5|q6|q7|yes_no)$")
    utterance: Union[Audio, Text] = Field(discriminator="kind")
    use_ai: bool = False


@app.post("/v1/extract")
def extract_one(req: ExtractRequest):
    """Measurement only: one answer -> what the engine hears and understands, no session.
    The accuracy harness (channels/ivr/tools/accuracy.py) scores these."""
    inp = _input(req.utterance)
    if not inp.nbest:
        return {"nbest": inp.nbest, "value": None, "confidence": 0.0, "method": None,
                "asr": asr.last_used()}
    fn = extract.yes_no if req.field == "yes_no" else _field(req.field)["extract"]
    got = fn(inp.nbest)
    if not got and req.use_ai and req.field in FIELDS:                # costs an AI call: opt-in
        ai = llm.understand(prompts.catalogue("hi").get(req.field, req.field), *ai_options(req.field),
                            inp.nbest)
        if ai and ai["intent"] == "answer":
            from .flow import from_ai
            got = (from_ai(req.field, ai["value"]), 0.75, "LLM")
    value, conf, method = got if got else (None, 0.0, None)
    if got and req.field in FIELDS and method != "LLM":
        value = _normalise(req.field, value, inp.nbest)          # same shape the flow stores
    return {"nbest": inp.nbest, "value": value, "confidence": conf, "method": method,
            "asr": asr.last_used()}


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
    fallback: bool = True                  # False when recording prompts: fail instead of mixing voices


@app.post("/v1/tts")
def speak(req: TtsRequest):
    try:
        pcm = tts.synth(req.text, req.lang, req.rate, req.fallback)
    except Exception as e:
        log.warning("tts failed: %r", e)
        raise HTTPException(503, "tts unavailable")
    return Response(pcm, media_type=f"audio/l16;rate={req.rate}")


@app.get("/v1/flags")
def flags(days: int = 1):
    """Guardrail events per kind (injection, abuse, caps…) over the last `days`. Counts only."""
    return STORE.flag_counts(days)


@app.get("/health")
def health():
    return {"ok": True, "asr": asr.PROVIDER, "tts": tts.PROVIDER,
            "nqr_rows": recommend.register()["count"], "nqr_sha": recommend.register()["sha256"][:12]}
