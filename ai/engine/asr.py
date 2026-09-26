"""Speech-to-text behind one interface. ASR_PROVIDER picks the engine:

  none  (default) no speech-to-text: spoken answers go straight to the keypad menu
  vosk  offline, free, no account (uv run --extra vosk; model from tools/get_vosk_model.py)

Cloud providers (Sarvam, Bhashini) need accounts: wired in the blocker phase.
Returns up to 5 guesses, best first, or None when no provider can transcribe.
"""

import json
import os
from functools import lru_cache

PROVIDER = os.environ.get("ASR_PROVIDER", "none")


def transcribe(pcm: bytes, rate: int, lang: str = "hi") -> list[str] | None:
    if PROVIDER == "none":
        return None
    if PROVIDER == "vosk":
        return _vosk(pcm, rate)
    raise ValueError(f"unknown ASR_PROVIDER {PROVIDER}")


@lru_cache(maxsize=1)
def _vosk_model():
    from vosk import Model, SetLogLevel

    SetLogLevel(-1)
    return Model(os.environ.get("VOSK_MODEL", str(_default_model_dir())))


def _default_model_dir():
    from pathlib import Path
    return Path(__file__).resolve().parent.parent / ".cache" / "vosk-model-small-hi-0.22"


def _vosk(pcm, rate):
    from vosk import KaldiRecognizer

    rec = KaldiRecognizer(_vosk_model(), rate)
    rec.SetMaxAlternatives(5)
    rec.AcceptWaveform(pcm)
    alts = json.loads(rec.FinalResult()).get("alternatives", [])
    return [a["text"] for a in alts if a.get("text")]
