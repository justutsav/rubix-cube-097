"""Text-to-speech: the fixed prompts (recorded once) and the live parts of a call (the result,
AI replies). TTS_PROVIDER:
  piper   (default) free, offline, on this machine, CPU only. One voice per language (VOICES):
            hi  Piper hi_IN-priyamvada-medium (PIPER_VOICE)     tools/get_piper_voice.py
            bn  Piper bn_BD-google-medium (Indian + Bangladeshi Bengali, CC BY-SA)
            or  Meta MMS Odia, converted once to ONNX              tools/export_mms_tts.py
          Speed PIPER_LENGTH_SCALE (1.0 normal, >1 slower). English words inside a Bengali or Odia
          sentence (course titles) are read by the Hindi voice: the MMS Odia voice has no Latin
          letters. Voice licences: docs/Prashant/engine/01-engine.md — confirm before paid use.
  sarvam  Sarvam Bulbul (paid; SARVAM_API_KEY in ai/.env).
  gtts    Google Translate voice, no account, needs internet. Dev only.
piper and sarvam fall back to gtts on failure unless fallback=False (prompt recording).
"""

import base64
import io
import json
import re
import time
import logging
import os
import wave
from functools import lru_cache
from pathlib import Path

log = logging.getLogger("engine")
PROVIDER = os.environ.get("TTS_PROVIDER", "piper")
PIPER_DIR = Path(__file__).resolve().parent.parent / ".cache" / "piper"
PIPER_VOICE = os.environ.get("PIPER_VOICE", "hi_IN-priyamvada-medium")
PIPER_BN_SPEAKER = int(os.environ.get("PIPER_BN_SPEAKER", 0))           # the Bengali voice has 16 speakers
MMS_DIR = Path(__file__).resolve().parent.parent / ".cache" / "mms"
VOICES = {"hi": ("piper", PIPER_VOICE), "bho": ("piper", PIPER_VOICE),
          "bn": ("piper", os.environ.get("PIPER_VOICE_BN", "bn_BD-google-medium")),
          "or": ("mms", "ory")}
LATIN = re.compile(r"[A-Za-z][A-Za-z0-9&/().'\- ]*[A-Za-z0-9)]|[A-Za-z]")
PIPER_LENGTH_SCALE = float(os.environ.get("PIPER_LENGTH_SCALE", 1.0))   # 0.85 was too fast on real calls
SARVAM_URL = "https://api.sarvam.ai/text-to-speech"
SARVAM_MODEL = os.environ.get("SARVAM_TTS_MODEL", "bulbul:v3")      # v2 was retired in 2026
SARVAM_SPEAKER = os.environ.get("SARVAM_TTS_SPEAKER")                # unset = Sarvam's default voice
SARVAM_PACE = float(os.environ.get("SARVAM_TTS_PACE", 1.0))           # 1.2 felt too fast on a real call


@lru_cache(maxsize=256)
def synth(text: str, lang: str = "hi", rate: int = 8000, fallback: bool = True) -> bytes:
    """-> raw 16-bit mono PCM at `rate`. fallback=False (prompt recording) raises instead of
    quietly switching voice, so a prompt set is never a mix of two voices."""
    if PROVIDER == "piper":
        try:
            return _local(text, lang, rate)
        except Exception as e:
            if not fallback:
                raise
            log.warning("piper tts failed, falling back to gtts: %r", e)
        return _gtts(text, lang, rate)
    if PROVIDER == "sarvam":
        try:
            return _sarvam(text, lang, rate)
        except Exception as e:
            if not fallback:
                raise
            log.warning("sarvam tts failed, falling back to gtts: %r", e)
        return _gtts(text, lang, rate)
    if PROVIDER == "gtts":
        return _gtts(text, lang, rate)
    raise ValueError(f"unknown TTS_PROVIDER {PROVIDER}")


def _local(text, lang, rate):
    """The language's own voice; English runs (course titles) in the Hindi voice."""
    kind, name = VOICES.get(lang, VOICES["hi"])
    if lang in ("hi", "bho"):
        return _piper(text, name, rate)
    out = b""
    pos = 0
    for m in list(LATIN.finditer(text)) + [None]:
        chunk = text[pos:m.start() if m else len(text)]
        if re.search(r"\w", chunk):
            out += _piper(chunk, name, rate) if kind == "piper" else _mms(chunk, name, rate)
        if m:
            out += _piper(m.group(), VOICES["hi"][1], rate)
            pos = m.end()
    return out


@lru_cache(maxsize=None)
def _piper_voice(name=PIPER_VOICE):
    import piper
    from piper import PiperVoice

    model = PIPER_DIR / f"{name}.onnx"
    if not model.exists():
        raise FileNotFoundError(f"{model} (run: uv run --extra piper python tools/get_piper_voice.py {name})")
    return PiperVoice.load(model, espeak_data_dir=Path(piper.__file__).parent / "espeak-ng-data")


def _piper(text, name, rate):
    from piper import SynthesisConfig

    voice = _piper_voice(name)
    speaker = PIPER_BN_SPEAKER if voice.config.num_speakers > 1 else None
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        voice.synthesize_wav(text, w, syn_config=SynthesisConfig(length_scale=PIPER_LENGTH_SCALE, speaker_id=speaker))
    return _resample(buf.getvalue(), rate)          # the voice speaks at 22,050 Hz; the phone line wants 8 kHz


def _resample(wav_bytes, rate):
    import miniaudio

    return miniaudio.decode(wav_bytes, output_format=miniaudio.SampleFormat.SIGNED16,
                            nchannels=1, sample_rate=rate).samples.tobytes()


@lru_cache(maxsize=None)
def _mms_model(name):
    import onnxruntime as ort

    d = MMS_DIR / name
    if not (d / "model.onnx").exists():
        raise FileNotFoundError(f"{d} (run tools/export_mms_tts.py {name}, see its docstring)")
    opts = ort.SessionOptions()
    opts.intra_op_num_threads = 4
    return (ort.InferenceSession(str(d / "model.onnx"), opts, providers=["CPUExecutionProvider"]),
            json.loads((d / "vocab.json").read_text(encoding="utf-8")),
            json.loads((d / "check.json").read_text(encoding="utf-8"))["rate"])


def _mms(text, name, rate):
    """MMS (VITS) voice: characters -> ids with a blank between each, as its tokenizer does."""
    import numpy as np

    session, vocab, voice_rate = _mms_model(name)
    toks = [vocab[c] for c in text.lower() if c in vocab]
    if not toks:
        return b""
    ids = [0] * (2 * len(toks) + 1)
    ids[1::2] = toks
    wav = session.run(None, {"input_ids": np.array([ids], dtype=np.int64),
                             "speaking_rate": np.array(1 / PIPER_LENGTH_SCALE, dtype=np.float32)})[0][0]
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(voice_rate)
        w.writeframes((np.clip(wav, -1, 1) * 32767).astype(np.int16).tobytes())
    return _resample(buf.getvalue(), rate)


def warm_up():
    """Load the local voice before the first caller."""
    if PROVIDER == "piper":
        for lang in os.environ.get("ENGINE_LANGS", "hi").split(","):
            try:
                kind, name = VOICES.get(lang, VOICES["hi"])
                _piper_voice(name) if kind == "piper" else _mms_model(name)
            except Exception as e:
                log.warning("voice for %s not loaded: %r", lang, e)


def _sarvam(text, lang, rate):
    for attempt in range(3):                                          # 429 = rate limit: short back-off
        r = _post(text, lang, rate)
        if r.status_code != 429:
            break
        time.sleep(1 + attempt)
    r.raise_for_status()
    audio = base64.b64decode(r.json()["audios"][0])
    with wave.open(io.BytesIO(audio)) as w:                 # WAV by default
        if (w.getframerate(), w.getnchannels(), w.getsampwidth()) != (rate, 1, 2):
            raise ValueError(f"unexpected audio {w.getframerate()} Hz {w.getnchannels()} ch")
        return w.readframes(w.getnframes())


def _post(text, lang, rate):
    import httpx

    return httpx.post(SARVAM_URL, timeout=10, headers={"api-subscription-key": os.environ["SARVAM_API_KEY"]},
                   json={"text": text, "language_code": f"{'hi' if lang == 'bho' else lang}-IN",
                         "model": SARVAM_MODEL, "speech_sample_rate": rate, "pace": SARVAM_PACE}
                   | ({"speaker": SARVAM_SPEAKER} if SARVAM_SPEAKER else {}))


def _gtts(text, lang, rate):
    import miniaudio
    from gtts import gTTS

    mp3 = io.BytesIO()
    gTTS(text, lang=lang).write_to_fp(mp3)
    return miniaudio.decode(mp3.getvalue(), output_format=miniaudio.SampleFormat.SIGNED16,
                            nchannels=1, sample_rate=rate).samples.tobytes()
