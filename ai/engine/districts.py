import json
from functools import lru_cache
from pathlib import Path

PATH = Path(__file__).resolve().parent.parent / "data" / "districts.json"


@lru_cache(maxsize=1)
def load() -> list[dict]:
    return json.loads(PATH.read_text(encoding="utf-8"))["districts"]
