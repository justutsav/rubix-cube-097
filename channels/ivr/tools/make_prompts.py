"""Generate PLACEHOLDER Hindi prompts and fake caller answers. Works on Linux, Windows, macOS.

Uses gTTS (Google Translate's public voice: no account, needs internet once) and
miniaudio (decodes the MP3 and resamples to 8 kHz, no ffmpeg). The output WAVs are
committed, so only run this when a prompt's text changes.

These exist only so the call loop can be built and heard before the real,
native-speaker prompts are recorded (master plan §5). Replace, never ship.

    uv run --extra prompts python tools/make_prompts.py
"""

import io
import wave
from pathlib import Path

import miniaudio
from gtts import gTTS

ROOT = Path(__file__).resolve().parent.parent

PROMPTS = {
    "welcome":  "नमस्ते। यह पीएम अजय की ओर से कौशल सहायता सेवा है।",
    "consent":  "हम आपसे कुछ सवाल पूछेंगे। क्या आप बात करने के लिए तैयार हैं? हाँ के लिए एक दबाएँ या बोलें।",
    "q1":       "आपने कहाँ तक पढ़ाई की है?",
    "q2":       "आपके परिवार का पारंपरिक काम क्या है?",
    "q3":       "अभी आप क्या काम करते हैं?",
    "q4":       "आपको कौन सा काम आता है, या क्या सीखना चाहते हैं?",
    "q5":       "क्या आने जाने में या शरीर से कोई परेशानी है?",
    "q6":       "आप अपना काम करना चाहेंगे, या नौकरी?",
    "q7":       "आपके इलाके में किस काम की ज़्यादा माँग है?",
    "ack":      "ठीक है।",
    "hmm":      "हम्म।",
    "nudge":    "क्या आप मुझे सुन पा रहे हैं?",
    "result":   "धन्यवाद। आपके लिए सही कोर्स की जानकारी जल्द मिलेगी।",
    "goodbye":  "बात करने के लिए धन्यवाद। नमस्ते।",
    "sorry":    "माफ़ कीजिए, अभी तकनीकी दिक्कत है। हम आपको थोड़ी देर में वापस कॉल करेंगे।",
}

ANSWERS = {
    "answer_tailoring": "सिलाई का काम",
    "answer_tenth":     "दसवीं पास",
}


def trim(samples, threshold=300, margin=400):
    """Cut leading/trailing silence (keep 50 ms). Leading silence is dead air the caller
    hears as lag; trailing silence delays the moment we start listening."""
    loud = [i for i, v in enumerate(samples) if abs(v) > threshold]
    if not loud:
        return samples
    return samples[max(0, loud[0] - margin):loud[-1] + margin]


def render(text, out):
    mp3 = io.BytesIO()
    gTTS(text, lang="hi").write_to_fp(mp3)
    samples = miniaudio.decode(mp3.getvalue(), output_format=miniaudio.SampleFormat.SIGNED16,
                               nchannels=1, sample_rate=8000).samples
    pcm = trim(samples).tobytes()
    out.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(out), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(8000)
        w.writeframes(pcm)


if __name__ == "__main__":
    for pid, text in PROMPTS.items():
        render(text, ROOT / "prompts" / "hi" / f"{pid}.wav")
    for name, text in ANSWERS.items():
        render(text, ROOT / "tools" / "fixtures" / f"{name}.wav")
    print(f"wrote {len(PROMPTS)} prompts, {len(ANSWERS)} answers")
