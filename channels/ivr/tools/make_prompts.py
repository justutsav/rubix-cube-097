"""Render the engine's prompt catalogue into 8 kHz WAVs. Works on Linux, Windows, macOS.

The wording lives in ai/ (GET /v1/prompts/{lang}); this only renders it for the phone.
Uses gTTS (Google Translate's public voice: no account, needs internet) and miniaudio
(decodes MP3 and resamples, no ffmpeg). Only prompts whose text changed are redone
(prompts/<lang>/manifest.json), and prompts the engine no longer has are deleted.

These are PLACEHOLDERS so the call can be built and heard. Replace with native-speaker
recordings (same file names) before any real user hears them.

    uv run uvicorn engine.server:app --port 8001          # in ai/
    uv run --extra prompts python tools/make_prompts.py   # here
"""

import argparse
import hashlib
import io
import json
import wave
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import httpx
import miniaudio
from gtts import gTTS

ROOT = Path(__file__).resolve().parent.parent

# Fake caller answers for tools/fake_exotel.py and the tests (not prompts).
ANSWERS = {
    "answer_tailoring": "सिलाई का काम",
    "answer_tenth": "दसवीं पास",
}


def trim(samples, threshold=300, margin=400):
    """Cut leading/trailing silence (keep 50 ms). Leading silence is dead air the caller
    hears as lag; trailing silence delays the moment we start listening."""
    loud = [i for i, v in enumerate(samples) if abs(v) > threshold]
    if not loud:
        return samples
    return samples[max(0, loud[0] - margin):loud[-1] + margin]


VOICE = {"bho": "hi"}      # no Bhojpuri voice in gTTS: the Hindi voice reads the Devanagari


def render(text, out, lang="hi"):
    mp3 = io.BytesIO()
    gTTS(text, lang=VOICE.get(lang, lang)).write_to_fp(mp3)
    samples = miniaudio.decode(mp3.getvalue(), output_format=miniaudio.SampleFormat.SIGNED16,
                               nchannels=1, sample_rate=8000).samples
    out.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(out), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(8000)
        w.writeframes(trim(samples).tobytes())


def sha(text):
    return hashlib.sha256(text.encode()).hexdigest()[:16]


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--engine", default="http://localhost:8001")
    p.add_argument("--lang", default="hi")
    a = p.parse_args()

    catalogue = httpx.get(f"{a.engine}/v1/prompts/{a.lang}", timeout=10).raise_for_status().json()
    folder = ROOT / "prompts" / a.lang
    manifest_path = folder / "manifest.json"
    old = json.loads(manifest_path.read_text(encoding="utf-8")) if manifest_path.exists() else {}
    todo = {pid: t for pid, t in catalogue.items()
            if old.get(pid) != sha(t) or not (folder / f"{pid}.wav").exists()}

    with ThreadPoolExecutor(8) as pool:
        list(pool.map(lambda kv: render(kv[1], folder / f"{kv[0]}.wav", a.lang), todo.items()))
        list(pool.map(lambda kv: render(kv[1], ROOT / "tools" / "fixtures" / f"{kv[0]}.wav"),
                      [kv for kv in ANSWERS.items()
                       if not (ROOT / "tools" / "fixtures" / f"{kv[0]}.wav").exists()]))

    stale = [f for f in folder.glob("*.wav") if f.stem not in catalogue]
    for f in stale:
        f.unlink()
    manifest_path.write_text(json.dumps({pid: sha(t) for pid, t in sorted(catalogue.items())},
                                        ensure_ascii=False, indent=0), encoding="utf-8")
    print(f"{len(catalogue)} prompts: {len(todo)} rendered, {len(stale)} removed")
