"""One-time: Meta's MMS voice for a language -> ONNX, so the engine speaks it with onnxruntime
alone (no PyTorch at run time). Used for Odia, which has no Piper voice.

    uv run --no-project --with torch --with transformers --with onnx --with onnxscript \
        python tools/export_mms_tts.py ory

Writes .cache/mms/<lang>/{model.onnx, vocab.json, tokenizer_config.json, check.json}.
Model licence: CC-BY-NC 4.0 (fine for the hackathon and a government pilot; confirm before paid use).
"""

import json
import shutil
import sys
from pathlib import Path

import torch
from huggingface_hub import hf_hub_download
from transformers import AutoTokenizer, VitsModel

lang = sys.argv[1] if len(sys.argv) > 1 else "ory"
repo = f"facebook/mms-tts-{lang}"
out = Path(__file__).resolve().parent.parent / ".cache" / "mms" / lang
out.mkdir(parents=True, exist_ok=True)

model = VitsModel.from_pretrained(repo).eval()
tok = AutoTokenizer.from_pretrained(repo)


class Wave(torch.nn.Module):
    def __init__(self, m):
        super().__init__()
        self.m = m

    def forward(self, input_ids, speaking_rate):
        self.m.speaking_rate = speaking_rate           # traced as an input: slower/faster at run time
        return self.m(input_ids=input_ids).waveform


sample = {"ory": "ନମସ୍କାର, ଆପଣ କେମିତି ଅଛନ୍ତି?"}.get(lang, "test")
ids = tok(sample, return_tensors="pt").input_ids
torch.onnx.export(Wave(model), (ids, torch.tensor(1.0)), out / "model.onnx",
                  input_names=["input_ids", "speaking_rate"], output_names=["waveform"],
                  dynamic_axes={"input_ids": {1: "n"}, "waveform": {1: "t"}}, opset_version=17, dynamo=False)
for f in ("vocab.json", "tokenizer_config.json"):
    shutil.copy(hf_hub_download(repo, f), out / f)
(out / "check.json").write_text(json.dumps({"text": sample, "ids": ids[0].tolist(),
                                            "rate": model.config.sampling_rate}, ensure_ascii=False))
print("->", out, (out / "model.onnx").stat().st_size // 1_000_000, "MB")
