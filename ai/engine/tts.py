"""Text-to-speech for the one personalised part of a call: the recommendation.

Everything else is pre-rendered from the prompt catalogue. TTS_PROVIDER:
  gtts    (default) Google Translate voice, no account, needs internet. Dev only.
  sarvam  Sarvam Bulbul (SARVAM_API_KEY in ai/.env); falls back to gtts if it fails.
"""

import base64
import io
import time
import logging
import os
import wave
from functools import lru_cache

log = logging.getLogger("engine")
PROVIDER = os.environ.get("TTS_PROVIDER", "gtts")
SARVAM_URL = "https://api.sarvam.ai/text-to-speech"
SARVAM_MODEL = os.environ.get("SARVAM_TTS_MODEL", "bulbul:v3")      # v2 was retired in 2026
SARVAM_SPEAKER = os.environ.get("SARVAM_TTS_SPEAKER")                # unset = Sarvam's default voice
SARVAM_PACE = float(os.environ.get("SARVAM_TTS_PACE", 1.2))           # 1.2: ~45% shorter than the gTTS prompts


@lru_cache(maxsize=256)
def synth(text: str, lang: str = "hi", rate: int = 8000, fallback: bool = True) -> bytes:
    """-> raw 16-bit mono PCM at `rate`. fallback=False (prompt recording) raises instead of
    quietly switching voice, so a prompt set is never a mix of two voices."""
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
