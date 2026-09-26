"""Accuracy harness: word error rate next to answer accuracy, per line condition.

The key chart (samples/README.md): the words come out wrong, the answers come out right.
Runs every answer through the real path the phone takes:

  audio -> phone_line.degrade (condition) -> VAD endpointing (ivr/vad.py)
        -> ai/ POST /v1/extract (speech-to-text + understanding) -> compare

Sets:
  samples/synthetic.csv   field,text,expected — audio from the engine's TTS voice (made once
                          into samples/raw/synthetic/, gitignored). Clean computer voice:
                          good for comparing versions, NOT real-world accuracy.
  samples/manifest.csv    the real recordings, same columns + file (8 kHz WAV). Use --set.

    uv run --extra dev python tools/accuracy.py --engine http://localhost:8001
    uv run --extra dev python tools/accuracy.py --set ../../samples/manifest.csv --out report.md
"""

import argparse
import base64
import csv
import hashlib
import json
import re
import sys
import unicodedata
import wave
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from ivr.vad import Endpointer                      # noqa: E402  (the adapter's own VAD)
from tools.phone_line import CONDITIONS, degrade    # noqa: E402

REPO = Path(__file__).resolve().parents[3]
SYNTH = REPO / "samples" / "synthetic.csv"
CACHE = REPO / "samples" / "raw" / "synthetic"


def words(text):
    t = unicodedata.normalize("NFD", (text or "").lower()).replace("़", "")
    t = unicodedata.normalize("NFC", t).replace("ँ", "ं")
    return re.sub(r"[^\w\s]", " ", t).split()


def wer(ref, hyp):
    r, h = words(ref), words(hyp)
    d = list(range(len(h) + 1))
    for i, rw in enumerate(r, 1):
        prev, d[0] = d[0], i
        for j, hw in enumerate(h, 1):
            prev, d[j] = d[j], min(d[j] + 1, d[j - 1] + 1, prev + (rw != hw))
    return d[len(h)], max(len(r), 1)


def audio_for(row, engine):
    if row.get("file"):
        with wave.open(str(Path(row["file"]))) as w:
            assert (w.getframerate(), w.getnchannels(), w.getsampwidth()) == (8000, 1, 2), row["file"]
            return w.readframes(w.getnframes())
    CACHE.mkdir(parents=True, exist_ok=True)
    f = CACHE / (hashlib.sha256(row["text"].encode()).hexdigest()[:16] + ".pcm")
    if not f.exists():
        r = httpx.post(f"{engine}/v1/tts", json={"text": row["text"], "rate": 8000}, timeout=60)
        r.raise_for_status()
        f.write_bytes(r.content)
    return f.read_bytes()


def endpoint(pcm):
    """What the adapter would send: the utterance its VAD cuts out of the call."""
    ep = Endpointer()
    padded = b"\x00" * 8000 + pcm + b"\x00" * 16000               # 0.5 s before, 1 s after
    for i in range(0, len(padded) - 319, 320):
        u = ep.feed(padded[i:i + 320])
        if u:
            return u
    return None


def run(rows, engine, conditions):
    results = {c: [] for c in conditions}
    with httpx.Client(base_url=engine, timeout=30) as c:
        for row in rows:
            clean = audio_for(row, engine)
            expected = json.loads(row["expected"])
            for cond in conditions:
                pcm = degrade(clean, seed=hash(row["text"]) & 0xFFFF, **CONDITIONS[cond])
                utt = endpoint(pcm)
                if utt is None:
                    results[cond].append(dict(row, heard=None, value=None, ok=False, errs=len(words(row["text"])),
                                              n=len(words(row["text"])), vad_miss=True))
                    continue
                j = c.post("/v1/extract", json={"field": row["field"], "utterance": {
                    "kind": "audio", "rate": 8000, "data": base64.b64encode(utt).decode()}}).json()
                heard = (j.get("nbest") or [""])[0]
                errs, n = wer(row["text"], heard)
                results[cond].append(dict(row, heard=heard, value=j["value"], ok=j["value"] == expected,
                                          errs=errs, n=n, vad_miss=False))
    return results


def report(results):
    lines = ["| Line condition | Word error rate | Answer understood | VAD missed the answer |",
             "|---|---|---|---|"]
    for cond, rs in results.items():
        w = sum(r["errs"] for r in rs) / max(sum(r["n"] for r in rs), 1)
        acc = sum(r["ok"] for r in rs) / max(len(rs), 1)
        miss = sum(r["vad_miss"] for r in rs)
        lines.append(f"| {cond} | {w:.0%} | {acc:.0%} ({sum(r['ok'] for r in rs)}/{len(rs)}) | {miss} |")
    fails = [r for r in results[list(results)[-1]] if not r["ok"]]
    if fails:
        lines += ["", f"Misses under `{list(results)[-1]}`:", ""]
        lines += [f"- `{r['field']}` said *{r['text']}* → heard *{r['heard']}* → {r['value']}" for r in fails]
    return "\n".join(lines)


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--engine", default="http://localhost:8001")
    p.add_argument("--set", type=Path, default=SYNTH)
    p.add_argument("--conditions", default=",".join(CONDITIONS))
    p.add_argument("--out", type=Path, help="also write the markdown table here")
    p.add_argument("--json", type=Path, help="also write every row's result here")
    a = p.parse_args()
    rows = list(csv.DictReader(a.set.open(encoding="utf-8")))
    res = run(rows, a.engine, a.conditions.split(","))
    md = report(res)
    print(md)
    if a.out:
        a.out.write_text(md + "\n", encoding="utf-8")
    if a.json:
        a.json.write_text(json.dumps(res, ensure_ascii=False, indent=1), encoding="utf-8")
