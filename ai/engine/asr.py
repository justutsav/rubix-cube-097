"""Speech-to-text behind one interface. ASR_PROVIDER picks the engine:

  none    no speech-to-text: spoken answers go straight to the keypad menu
  vosk    offline, free, no account (uv run --extra vosk; model from tools/get_vosk_model.py)
  sarvam  Sarvam cloud (SARVAM_API_KEY in ai/.env). On error or > ASR_TIMEOUT_MS it falls
          back to Vosk if installed, else returns None and the flow uses the keypad.

Returns up to 5 guesses, best first, or None when nothing could transcribe.
`last_used()` says which engine produced the most recent result on this thread.
"""

import io
import json
import logging
import os
import threading
import wave
from functools import lru_cache
from pathlib import Path

log = logging.getLogger("engine")
PROVIDER = os.environ.get("ASR_PROVIDER", "none")
TIMEOUT = int(os.environ.get("ASR_TIMEOUT_MS", 2000)) / 1000
SARVAM_URL = "https://api.sarvam.ai/speech-to-text"
SARVAM_MODEL = os.environ.get("SARVAM_STT_MODEL", "saarika:v2.5")
_local = threading.local()


def last_used() -> str | None:
    return getattr(_local, "used", None)


def transcribe(pcm: bytes, rate: int, lang: str = "hi") -> list[str] | None:
    _local.used = None
    if PROVIDER == "none":
        return None
    if PROVIDER == "sarvam":
        try:
            out = _sarvam(pcm, rate, lang)
            _local.used = "sarvam"
            return out
        except Exception as e:                     # timeout, HTTP error, bad key: keep the call going
            log.warning("sarvam asr failed, falling back: %r", e)
        return _vosk_or_none(pcm, rate)
    if PROVIDER == "vosk":
        return _vosk_or_none(pcm, rate)
    raise ValueError(f"unknown ASR_PROVIDER {PROVIDER}")


# --- Sarvam ---------------------------------------------------------------------

@lru_cache(maxsize=1)
def _client():
    import httpx
    return httpx.Client(timeout=TIMEOUT, headers={"api-subscription-key": os.environ["SARVAM_API_KEY"]})


def warm_up():
    """Open the connection before the first caller: a cold TLS handshake can eat the 2 s budget."""
    if PROVIDER == "sarvam":
        try:
            _client().get("https://api.sarvam.ai/", timeout=5)
        except Exception as e:
            log.warning("sarvam warm-up failed: %r", e)
    if PROVIDER in ("vosk", "sarvam"):
        _vosk_or_none(b"\x00" * 3200, 8000)            # load the fallback model now too


def _wav(pcm, rate):
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(pcm)
    return buf.getvalue()


def _sarvam(pcm, rate, lang):
    r = _client().post(SARVAM_URL, files={"file": ("answer.wav", _wav(pcm, rate), "audio/wav")},
                       data={"model": SARVAM_MODEL, "language_code": f"{lang}-IN"})
    r.raise_for_status()
    text = (r.json().get("transcript") or "").strip()
    return [text] if text else []


# --- Vosk -------------------------------------------------------------------------

def _vosk_or_none(pcm, rate):
    try:
        out = _vosk(pcm, rate)
        _local.used = "vosk"
        return out
    except Exception as e:                         # not installed / no model: keypad it is
        log.warning("vosk unavailable: %r", e)
        return None


@lru_cache(maxsize=1)
def _vosk_model():
    from vosk import Model, SetLogLevel

    SetLogLevel(-1)
    default = Path(__file__).resolve().parent.parent / ".cache" / "vosk-model-small-hi-0.22"
    path = os.environ.get("VOSK_MODEL", str(default))
    if not Path(path).exists():
        raise FileNotFoundError(path)
    return Model(path)


def _vosk(pcm, rate):
    from vosk import KaldiRecognizer

    rec = KaldiRecognizer(_vosk_model(), rate)
    rec.SetMaxAlternatives(5)
    rec.AcceptWaveform(pcm)
    alts = json.loads(rec.FinalResult()).get("alternatives", [])
    return [a["text"] for a in alts if a.get("text")]
