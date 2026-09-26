"""Interview engine. Loads ai/.env (KEY=VALUE lines) into the environment at import, without
overriding anything already set, so secrets never go in code or on the command line.
A key repeated in the file: the later line wins, as with every other .env reader."""

import os
from pathlib import Path

_ENV = Path(__file__).resolve().parent.parent / ".env"
if _ENV.exists():
    _vals = {}
    for _line in _ENV.read_text(encoding="utf-8").splitlines():
        _k, _, _v = _line.strip().partition("=")
        if _k and not _k.startswith("#") and _v:
            _vals[_k.strip()] = _v.strip().strip('"').strip("'")
    for _k, _v in _vals.items():
        os.environ.setdefault(_k, _v)
