"""The AI helper: last rung of the extraction ladder (spec §2.3, master plan §3).

Only called when the word list and number patterns found nothing. It may only pick a
value the field already allows, and the caller still confirms it. With no provider
configured (the default) it returns None and the flow falls back to re-ask / keypad.

Providers need an account and are wired in the blocker phase: LLM_PROVIDER=none|…
"""

import os

PROVIDER = os.environ.get("LLM_PROVIDER", "none")


def classify(field: str, nbest: list[str]):
    """-> (value, confidence, "LLM") or None."""
    if PROVIDER == "none":
        return None
    raise NotImplementedError(f"LLM_PROVIDER={PROVIDER} not wired yet")
