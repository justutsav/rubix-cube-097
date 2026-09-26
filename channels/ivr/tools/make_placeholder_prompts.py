"""Generate PLACEHOLDER Hindi prompts with the macOS `say` voice (Lekha).

These exist only so the call loop can be built and heard before the real,
native-speaker prompts are recorded (master plan §5). Replace, never ship.
Also writes two fake caller answers into tools/fixtures/ for fake_exotel.py.

    python tools/make_placeholder_prompts.py        # macOS only
"""

import subprocess
from pathlib import Path

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
    "result":   "धन्यवाद। आपके लिए सही कोर्स की जानकारी जल्द मिलेगी।",
    "goodbye":  "बात करने के लिए धन्यवाद। नमस्ते।",
}

ANSWERS = {
    "answer_tailoring": "सिलाई का काम",
    "answer_tenth":     "दसवीं पास",
}


def render(text, out):
    out.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(["say", "-v", "Lekha", "-o", str(out),
                    "--file-format=WAVE", "--data-format=LEI16@8000", text], check=True)


if __name__ == "__main__":
    for pid, text in PROMPTS.items():
        render(text, ROOT / "prompts" / "hi" / f"{pid}.wav")
    for name, text in ANSWERS.items():
        render(text, ROOT / "tools" / "fixtures" / f"{name}.wav")
    print(f"wrote {len(PROMPTS)} prompts, {len(ANSWERS)} answers")
