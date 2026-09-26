"""Text-to-speech for the one personalised part of a call: the recommendation.

Everything else is pre-rendered from the prompt catalogue. TTS_PROVIDER:
  gtts    (default) Google Translate voice, no account, needs internet. Dev only.
  sarvam  Sarvam Bulbul (SARVAM_API_KEY in ai/.env); falls back to gtts if it fails.
"""

import base64
import io
import logging
import os
import wave
from functools import lru_cache

log = logging.getLogger("engine")
PROVIDER = os.environ.get("TTS_PROVIDER", "gtts")
SARVAM_URL = "https://api.sarvam.ai/text-to-speech"
SARVAM_MODEL = os.environ.get("SARVAM_TTS_MODEL", "bulbul:v3")      # v2 was retired in 2026
SARVAM_SPEAKER = os.environ.get("SARVAM_TTS_SPEAKER")                # unset = Sarvam's default voice


@lru_cache(maxsize=256)
def synth(text: str, lang: str = "hi", rate: int = 8000) -> bytes:
    """-> raw 16-bit mono PCM at `rate`."""
    if PROVIDER == "sarvam":
        try:
            return _sarvam(text, lang, rate)
        except Exception as e:
            log.warning("sarvam tts failed, falling back to gtts: %r", e)
        return _gtts(text, lang, rate)
    if PROVIDER == "gtts":
        return _gtts(text, lang, rate)
    raise ValueError(f"unknown TTS_PROVIDER {PROVIDER}")


def _sarvam(text, lang, rate):
    import httpx

    r = httpx.post(SARVAM_URL, timeout=10, headers={"api-subscription-key": os.environ["SARVAM_API_KEY"]},
                   json={"text": text, "language_code": f"{lang}-IN", "model": SARVAM_MODEL,
                         "speech_sample_rate": rate} | ({"speaker": SARVAM_SPEAKER} if SARVAM_SPEAKER else {}))
    r.raise_for_status()
    audio = base64.b64decode(r.json()["audios"][0])
    with wave.open(io.BytesIO(audio)) as w:                 # WAV by default
        if (w.getframerate(), w.getnchannels(), w.getsampwidth()) != (rate, 1, 2):
            raise ValueError(f"unexpected audio {w.getframerate()} Hz {w.getnchannels()} ch")
        return w.readframes(w.getnframes())


def _gtts(text, lang, rate):
    import miniaudio
    from gtts import gTTS

    mp3 = io.BytesIO()
    gTTS(text, lang=lang).write_to_fp(mp3)
    return miniaudio.decode(mp3.getvalue(), output_format=miniaudio.SampleFormat.SIGNED16,
                            nchannels=1, sample_rate=rate).samples.tobytes()
