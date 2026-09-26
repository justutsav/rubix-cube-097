"""Download a Piper voice (~60–80 MB, no account) into .cache/piper/.

    uv run python tools/get_piper_voice.py                       # hi_IN-priyamvada-medium
    uv run python tools/get_piper_voice.py hi_IN-pratham-medium  # or pratham / rohan
    uv run python tools/get_piper_voice.py bn_BD-google-medium   # Bengali (CC BY-SA)

Licences differ per voice (priyamvada and pratham: CC BY-NC-SA 4.0 data; rohan: IIT Madras
IndicTTS licence). Fine to test; confirm before any paid deployment.
"""

import sys
import urllib.request
from pathlib import Path

BASE = "https://huggingface.co/rhasspy/piper-voices/resolve/main"
DEST = Path(__file__).resolve().parent.parent / ".cache" / "piper"

if __name__ == "__main__":
    name = sys.argv[1] if len(sys.argv) > 1 else "hi_IN-priyamvada-medium"
    speaker, quality = name.split("-")[1], name.split("-")[2]
    DEST.mkdir(parents=True, exist_ok=True)
    for ext in (".onnx", ".onnx.json", "/MODEL_CARD"):
        out = DEST / (name + (".model_card.txt" if ext == "/MODEL_CARD" else ext))
        if out.exists():
            continue
        locale = name.split("-")[0]
        url = f"{BASE}/{locale.split('_')[0]}/{locale}/{speaker}/{quality}/" + \
            ("MODEL_CARD" if ext == "/MODEL_CARD" else name + ext)
        print("downloading", url)
        urllib.request.urlretrieve(url, out)
    print(f"-> {DEST}")
