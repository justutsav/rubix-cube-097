"""Download the small Hindi Vosk model (~42 MB, Apache-2.0, no account) into .cache/.

    uv run python tools/get_vosk_model.py
Then run the engine with ASR_PROVIDER=vosk (and `--extra vosk`).
"""

import io
import urllib.request
import zipfile
from pathlib import Path

URL = "https://alphacephei.com/vosk/models/vosk-model-small-hi-0.22.zip"
DEST = Path(__file__).resolve().parent.parent / ".cache"

if __name__ == "__main__":
    if (DEST / "vosk-model-small-hi-0.22").exists():
        print("already there")
    else:
        DEST.mkdir(exist_ok=True)
        print(f"downloading {URL}")
        with urllib.request.urlopen(URL, timeout=300) as r:
            zipfile.ZipFile(io.BytesIO(r.read())).extractall(DEST)
        print(f"-> {DEST / 'vosk-model-small-hi-0.22'}")
