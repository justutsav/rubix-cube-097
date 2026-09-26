"""Ring a phone now through Exotel and connect it to this adapter (tests the callback leg).

    EXOTEL_SID=… EXOTEL_API_KEY=… EXOTEL_API_TOKEN=… EXOTEL_CALLER_ID=<ExoPhone> \\
    EXOTEL_STREAM_URL=wss://<tunnel>/stream?token=<STREAM_TOKEN> \\
    uv run python tools/call_me.py +91XXXXXXXXXX

On a trial account the number must be one you verified in the Exotel dashboard.
"""

import asyncio
import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from ivr import exotel      # noqa: E402

if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    ok = asyncio.run(exotel.place_call(sys.argv[1]))
    sys.exit(0 if ok else 1)
