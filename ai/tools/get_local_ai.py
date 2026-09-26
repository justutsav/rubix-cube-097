"""One-time: the local AI helper's model (multilingual-e5-small, MIT, ~100 languages) -> int8 ONNX.

    uv run --extra local --with onnx python tools/get_local_ai.py      # onnx: only for this one-time step

Downloads the full-precision ONNX (470 MB) once, compresses it to ~120 MB with onnxruntime's
own dynamic quantisation (runs on any CPU: Intel, AMD, Apple), keeps the tokenizer, and deletes
nothing else. Output: .cache/e5/{model.int8.onnx, tokenizer.json}.
"""

import shutil
from pathlib import Path

from huggingface_hub import hf_hub_download
from onnxruntime.quantization import QuantType, quantize_dynamic

REPO = "intfloat/multilingual-e5-small"
OUT = Path(__file__).resolve().parent.parent / ".cache" / "e5"

if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    shutil.copy(hf_hub_download(REPO, "onnx/tokenizer.json"), OUT / "tokenizer.json")
    target = OUT / "model.int8.onnx"
    if not target.exists():
        quantize_dynamic(hf_hub_download(REPO, "onnx/model.onnx"), target, weight_type=QuantType.QInt8)
    print("->", target, target.stat().st_size // 1_000_000, "MB")
