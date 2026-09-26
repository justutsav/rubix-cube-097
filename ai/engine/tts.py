"""Text-to-speech for the one personalised part of a call: the recommendation.

Everything else is pre-rendered from the prompt catalogue. TTS_PROVIDER:
  gtts  (default) Google Translate voice, no account, needs internet. Dev only.
Cloud providers (Sarvam Bulbul, Bhashini) need accounts: wired in the blocker phase.
"""

import io
import os
from functools import lru_cache

PROVIDER = os.environ.get("TTS_PROVIDER", "gtts")


@lru_cache(maxsize=256)
def synth(text: str, lang: str = "hi", rate: int = 8000) -> bytes:
    """-> raw 16-bit mono PCM at `rate`."""
    if PROVIDER != "gtts":
        raise ValueError(f"unknown TTS_PROVIDER {PROVIDER}")
    import miniaudio
    from gtts import gTTS

    mp3 = io.BytesIO()
    gTTS(text, lang=lang).write_to_fp(mp3)
    return miniaudio.decode(mp3.getvalue(), output_format=miniaudio.SampleFormat.SIGNED16,
                            nchannels=1, sample_rate=rate).samples.tobytes()
