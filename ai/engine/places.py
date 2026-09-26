"""Every Indian state and district, to check a place the caller names (q0).

Matching is by close spelling on the English names; the AI helper supplies English names
for whatever the caller said ("भुवनेश्वर" -> Khordha, Odisha).
"""

import json
from difflib import get_close_matches
from functools import lru_cache
from pathlib import Path

PATH = Path(__file__).resolve().parent.parent / "data" / "india_districts.json"


@lru_cache(maxsize=1)
def states() -> dict:
    return {s["state"]: s["districts"] for s in json.loads(PATH.read_text(encoding="utf-8"))["states"]}


def _close(name, choices):
    if not name:
        return None
    by_low = {c.lower(): c for c in choices}
    hit = get_close_matches(name.strip().lower(), list(by_low), n=1, cutoff=0.75)
    return by_low[hit[0]] if hit else None


ALIASES = {"orissa": "Odisha", "uttaranchal": "Uttarakhand", "pondicherry": "Puducherry",
           "bengal": "West Bengal", "up": "Uttar Pradesh", "mp": "Madhya Pradesh", "jk": "Jammu and Kashmir"}


def check(state: str | None, district: str | None):
    """-> (official state, official district or the given name if unlisted), or None when the
    state is not an Indian state/UT."""
    st = _close(ALIASES.get((state or "").strip().lower(), state), states())
    if not st:
        return None
    dist = _close(district, states()[st])
    return st, dist or (district.strip().title() if district else None)
