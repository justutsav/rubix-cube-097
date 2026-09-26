"""Speech-to-text behind one interface. ASR_PROVIDER picks the engine:

  none    no speech-to-text: spoken answers go straight to the keypad menu
  vosk    offline, free, no account (uv run --extra vosk; model from tools/get_vosk_model.py)
  local   on this machine, CPU only: AI4Bharat IndicConformer (hi, bn, or, … MIT), ONNX,
          ~0.5 GB per language (~0.15 GB with LOCAL_ASR_QUANT=int8), only the ENGINE_LANGS ones
          (uv run --extra local; models download once from Hugging Face, no account)
  sarvam  Sarvam cloud (SARVAM_API_KEY in ai/.env). On error or > ASR_TIMEOUT_MS it falls
          back to local if installed, else Vosk (Hindi only), else None and the flow uses the keypad.

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
LOCAL_REPO = os.environ.get("LOCAL_ASR_REPO", "OpenVoiceOS/ai4bharat-indicconformer-{lang}-onnx")
# full precision by default: on the laptop it was both faster (38 vs 65 ms) and better in noise
# (84 vs 71% on the worst line) than int8, for ~360 MB more per language. int8 = half the memory.
LOCAL_QUANT = os.environ.get("LOCAL_ASR_QUANT", "")
LOCAL_THREADS = int(os.environ.get("ASR_THREADS", 4))      # leave cores for the other calls
SARVAM_LANG = {"or": "od"}                                 # Sarvam's code for Odia
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
        return _fallback(pcm, rate, lang)
    if PROVIDER == "local":
        return _fallback(pcm, rate, lang)
    if PROVIDER == "vosk":
        return _vosk_or_none(pcm, rate, lang)
    raise ValueError(f"unknown ASR_PROVIDER {PROVIDER}")


def _fallback(pcm, rate, lang):
    """local IndicConformer if installed, then Vosk (Hindi only), then None (keypad)."""
    try:
        out = _local_asr(pcm, rate, lang)
        _local.used = "local"
        return out
    except Exception as e:
        log.warning("local asr unavailable: %r", e)
    return _vosk_or_none(pcm, rate, lang)


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
    if PROVIDER in ("local", "sarvam"):
        for lang in os.environ.get("ENGINE_LANGS", "hi").split(","):
            try:
                _local_model(lang)                      # download (first time) + load, before the first caller
            except Exception as e:
                log.warning("local asr for %s unavailable: %r", lang, e)
    if PROVIDER in ("vosk", "sarvam", "local"):
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
                       data={"model": SARVAM_MODEL, "language_code": f"{SARVAM_LANG.get(lang, lang)}-IN"})
    r.raise_for_status()
    text = (r.json().get("transcript") or "").strip()
    return [text] if text else []


# --- local: IndicConformer (ONNX, CPU) ---------------------------------------------

@lru_cache(maxsize=None)
def _local_model(lang):
    import onnx_asr
    import onnxruntime as ort

    opts = ort.SessionOptions()
    opts.intra_op_num_threads = LOCAL_THREADS
    return onnx_asr.load_model(LOCAL_REPO.format(lang=lang), quantization=LOCAL_QUANT or None, sess_options=opts,
                               providers=["CPUExecutionProvider"])        # same on Linux, Windows, Mac


def _local_asr(pcm, rate, lang):
    import numpy as np

    audio = np.frombuffer(pcm, dtype=np.int16).astype(np.float32) / 32768
    text = (_local_model(lang).recognize(audio, sample_rate=rate) or "").strip()
    return [text] if text else []


# --- Vosk -------------------------------------------------------------------------

def _vosk_or_none(pcm, rate, lang="hi"):
    if lang != "hi":                               # the small Vosk model is Hindi: never guess another language
        return None
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
