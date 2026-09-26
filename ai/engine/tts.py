"""Text-to-speech: the fixed prompts (recorded once) and the live parts of a call (the result,
AI replies). TTS_PROVIDER:
  piper   (default) free, offline, on this machine; ~40x faster than real time on a laptop CPU.
          Voice PIPER_VOICE (default hi_IN-priyamvada-medium, from tools/get_piper_voice.py),
          speed PIPER_LENGTH_SCALE (1.0 normal, >1 slower). Voice licences: see
          docs/Prashant/engine/01-engine.md — confirm before any paid deployment.
  sarvam  Sarvam Bulbul (paid; SARVAM_API_KEY in ai/.env).
  gtts    Google Translate voice, no account, needs internet. Dev only.
piper and sarvam fall back to gtts on failure unless fallback=False (prompt recording).
"""

import base64
import io
import time
import logging
import os
import wave
from functools import lru_cache
from pathlib import Path

log = logging.getLogger("engine")
PROVIDER = os.environ.get("TTS_PROVIDER", "piper")
PIPER_DIR = Path(__file__).resolve().parent.parent / ".cache" / "piper"
PIPER_VOICE = os.environ.get("PIPER_VOICE", "hi_IN-priyamvada-medium")
PIPER_LENGTH_SCALE = float(os.environ.get("PIPER_LENGTH_SCALE", 1.0))   # 0.85 was too fast on real calls
SARVAM_URL = "https://api.sarvam.ai/text-to-speech"
SARVAM_MODEL = os.environ.get("SARVAM_TTS_MODEL", "bulbul:v3")      # v2 was retired in 2026
SARVAM_SPEAKER = os.environ.get("SARVAM_TTS_SPEAKER")                # unset = Sarvam's default voice
SARVAM_PACE = float(os.environ.get("SARVAM_TTS_PACE", 1.0))           # 1.2 felt too fast on a real call


@lru_cache(maxsize=256)
def synth(text: str, lang: str = "hi", rate: int = 8000, fallback: bool = True) -> bytes:
    """-> raw 16-bit mono PCM at `rate`. fallback=False (prompt recording) raises instead of
    quietly switching voice, so a prompt set is never a mix of two voices."""
    if PROVIDER == "piper":
        try:
            return _piper(text, rate)
        except Exception as e:
            if not fallback:
                raise
            log.warning("piper tts failed, falling back to gtts: %r", e)
        return _gtts(text, lang, rate)
    if PROVIDER == "sarvam":
        try:
            return _sarvam(text, lang, rate)
        except Exception as e:
            if not fallback:
                raise
            log.warning("sarvam tts failed, falling back to gtts: %r", e)
        return _gtts(text, lang, rate)
    if PROVIDER == "gtts":
        return _gtts(text, lang, rate)
    raise ValueError(f"unknown TTS_PROVIDER {PROVIDER}")


@lru_cache(maxsize=1)
def _piper_voice():
    import piper
    from piper import PiperVoice

    model = PIPER_DIR / f"{PIPER_VOICE}.onnx"
    if not model.exists():
        raise FileNotFoundError(f"{model} (run: uv run --extra piper python tools/get_piper_voice.py)")
    return PiperVoice.load(model, espeak_data_dir=Path(piper.__file__).parent / "espeak-ng-data")


def _piper(text, rate):
    import miniaudio
    from piper import SynthesisConfig

    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        _piper_voice().synthesize_wav(text, w, syn_config=SynthesisConfig(length_scale=PIPER_LENGTH_SCALE))
    # the voice speaks at 22,050 Hz; the phone line wants 8 kHz
    return miniaudio.decode(buf.getvalue(), output_format=miniaudio.SampleFormat.SIGNED16,
                            nchannels=1, sample_rate=rate).samples.tobytes()


def warm_up():
    """Load the local voice before the first caller."""
    if PROVIDER == "piper":
        try:
            _piper_voice()
        except Exception as e:
            log.warning("piper voice not loaded: %r", e)


def _sarvam(text, lang, rate):
    for attempt in range(3):                                          # 429 = rate limit: short back-off
        r = _post(text, lang, rate)
        if r.status_code != 429:
            break
        time.sleep(1 + attempt)
    r.raise_for_status()
    audio = base64.b64decode(r.json()["audios"][0])
    with wave.open(io.BytesIO(audio)) as w:                 # WAV by default
        if (w.getframerate(), w.getnchannels(), w.getsampwidth()) != (rate, 1, 2):
            raise ValueError(f"unexpected audio {w.getframerate()} Hz {w.getnchannels()} ch")
        return w.readframes(w.getnframes())


def _post(text, lang, rate):
    import httpx

    return httpx.post(SARVAM_URL, timeout=10, headers={"api-subscription-key": os.environ["SARVAM_API_KEY"]},
                   json={"text": text, "language_code": f"{'hi' if lang == 'bho' else lang}-IN",
                         "model": SARVAM_MODEL, "speech_sample_rate": rate, "pace": SARVAM_PACE}
                   | ({"speaker": SARVAM_SPEAKER} if SARVAM_SPEAKER else {}))


def _gtts(text, lang, rate):
    import miniaudio
    from gtts import gTTS

    mp3 = io.BytesIO()
    gTTS(text, lang=lang).write_to_fp(mp3)
    return miniaudio.decode(mp3.getvalue(), output_format=miniaudio.SampleFormat.SIGNED16,
                            nchannels=1, sample_rate=rate).samples.tobytes()
