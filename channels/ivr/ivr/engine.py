"""Client for ai/  POST /v1/turn  (spec §1.1, build doc §5.3).

The raw phone number is HMAC'd here and never leaves the adapter.
"""

import base64
import hashlib
import hmac
import os

import httpx

URL = os.environ.get("ENGINE_URL", "http://localhost:8001")
TIMEOUT = int(os.environ.get("ENGINE_TIMEOUT_MS", 1500)) / 1000
PEPPER = os.environ.get("PHONE_PEPPER", "dev-only-pepper").encode()
TTS_TIMEOUT = int(os.environ.get("TTS_TIMEOUT_MS", 6000)) / 1000

_client = httpx.AsyncClient(base_url=URL, timeout=TIMEOUT)   # one pooled, kept-alive connection


def phone_hash(e164: str) -> str:
    return hmac.new(PEPPER, e164.encode(), hashlib.sha256).hexdigest()


async def turn(call_sid: str, phone: str, lang: str, utterance: dict) -> dict:
    r = await _client.post("/v1/turn", json={
        "channel": "ivr",
        "channel_ref": call_sid,
        "identity": {"kind": "msisdn_hash", "value": phone_hash(phone)},
        "utterance": utterance,
        "locale_hint": f"{lang}-IN",
    })
    r.raise_for_status()
    return r.json()


async def tts(text: str, lang: str) -> bytes:
    """The personalised tail (the recommendation), synthesised by ai/ at 8 kHz."""
    r = await _client.post("/v1/tts", json={"text": text, "lang": lang, "rate": 8000},
                           timeout=TTS_TIMEOUT)
    r.raise_for_status()
    return r.content


def audio(pcm: bytes) -> dict:
    return {"kind": "audio", "format": "l16", "rate": 8000, "data": base64.b64encode(pcm).decode()}


def dtmf(digit: str) -> dict:
    return {"kind": "dtmf", "digits": digit}


OPENED = {"kind": "opened"}
HANGUP = {"kind": "hangup"}
TIMEOUT = {"kind": "timeout"}     # caller said nothing for NO_INPUT_TIMEOUT_MS; ai/ picks the nudge
