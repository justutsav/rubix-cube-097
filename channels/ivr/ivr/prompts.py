"""Prompt id -> raw 8 kHz PCM, all loaded into memory at startup (no disk on the hot path).

Files live at prompts/<lang>/<id>.wav, 8 kHz, mono, 16-bit. An id in `say[]` like
"q4" or "q4.hi" resolves against the call's language.
"""

import wave
from pathlib import Path

DIR = Path(__file__).resolve().parent.parent / "prompts"


def load(root: Path = DIR) -> dict[tuple[str, str], bytes]:
    out = {}
    for f in sorted(root.glob("*/*.wav")):
        with wave.open(str(f)) as w:
            if (w.getframerate(), w.getnchannels(), w.getsampwidth()) != (8000, 1, 2):
                raise ValueError(f"{f}: prompts must be 8 kHz mono 16-bit")
            out[(f.parent.name, f.stem)] = w.readframes(w.getnframes())
    if not out:
        raise FileNotFoundError(f"no prompts under {root}")
    return out


def resolve(bank: dict, prompt_id: str, lang: str) -> bytes | None:
    """'q4' or 'q4.hi' or 'q4.bho.v3' -> PCM (Hindi if that language lacks it); None if missing."""
    parts = prompt_id.split(".")
    if len(parts) > 1 and len(parts[1]) in (2, 3):
        lang = parts[1]
    # a language records only what differs from Hindi; everything else plays in Hindi
    return bank.get((lang, parts[0])) or bank.get(("hi", parts[0]))
