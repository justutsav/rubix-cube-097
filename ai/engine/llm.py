"""The AI helper: handles whatever the fixed script and word list cannot (master plan §3).

The main route stays hard-coded for speed. This runs only when the cheap layers fail, and
it may only:
  - pick a value the current question already allows          (intent "answer")
  - answer a side question, from data/facts_hi.md only         (intent "question")
  - notice "please repeat" or "I want a person"                (intents "repeat", "help")
It can never skip consent, add a question, or name a course. Answers it picks are still
read back to the caller; anything off the allowed list is thrown away.

LLM_PROVIDER: sarvam (default when SARVAM_API_KEY is set) | none.
"""

import json
import logging
import os
from functools import lru_cache
from pathlib import Path

log = logging.getLogger("engine")
PROVIDER = os.environ.get("LLM_PROVIDER") or ("sarvam" if os.environ.get("SARVAM_API_KEY") else "none")
MODEL = os.environ.get("SARVAM_LLM_MODEL", "sarvam-105b-conversations")
TIMEOUT = int(os.environ.get("LLM_TIMEOUT_MS", 2500)) / 1000
URL = "https://api.sarvam.ai/v1/chat/completions"
INTENTS = {"answer", "question", "repeat", "help", "unclear"}
DONT_KNOW = "यह जानकारी हमारे ज़िले के साथी देंगे।"


@lru_cache(maxsize=1)
def facts() -> str:
    text = (Path(__file__).resolve().parent.parent / "data" / "facts_hi.md").read_text(encoding="utf-8")
    return "\n".join(l for l in text.splitlines() if l.startswith("- "))


SYSTEM = """तुम पीएम-अजय कौशल सहायता सेवा की फ़ोन सहायिका हो। कॉल पर अभी यह सवाल पूछा गया था:
"{question}"
कॉलर ने जो कहा (बोली को मशीन ने लिखा है, गलतियाँ हो सकती हैं), उसे समझकर सिर्फ़ JSON दो:
{{"intent": "answer" | "question" | "repeat" | "help" | "unclear", "value": <नीचे की सूची में से एक, या null>, "reply": <छोटा जवाब या null>}}

- answer: कॉलर ने सवाल का जवाब दिया। value में नीचे की सूची की key ठीक वैसी ही लिखो। सूची से बाहर कुछ मत लिखो; पक्का न हो तो unclear।
{options}
  संख्या या कक्षा बीच में पड़े (जैसे "तीसरी-चौथी तक"), तो उससे कम वाला सबसे नज़दीकी विकल्प चुनो, बड़ा कभी नहीं।
- question: कॉलर ने कुछ और पूछा। reply में ज़्यादा से ज़्यादा दो छोटे, विनम्र हिंदी वाक्य (कुल 30 शब्द तक), सिर्फ़ इन तथ्यों से, और आख़िर में कोई सवाल मत पूछना:
{facts}
  इनमें जवाब न हो तो reply ठीक यही: "{dont_know}" कोई वादा, रकम या तारीख़ अपनी तरफ़ से मत बताना। कोर्स का नाम मत बताना।
- repeat: कॉलर सवाल दोबारा सुनना चाहता है।
- help: कॉलर किसी इंसान से बात करना चाहता है।
- unclear: कुछ समझ नहीं आया, शोर है, या बात सवाल से जुड़ी नहीं।"""


def understand(question: str, options: dict, heard: list[str], describe: str | None = None) -> dict | None:
    """-> {"intent", "value", "reply"} with value guaranteed in `options`, or None (off / failed).
    `options`: allowed value -> short Hindi description, e.g. {"yes": "हाँ", "no": "नहीं"}.
    `describe`: shown instead of listing the options (for long ranges like 0-40 years)."""
    if PROVIDER == "none" or not heard:
        return None
    try:
        raw = _sarvam(SYSTEM.format(
            question=question,
            options=describe or "\n".join(f"  {k}: {v}" for k, v in options.items()),
            facts=facts(), dont_know=DONT_KNOW), heard[0])
        out = json.loads(raw)
    except Exception as e:                       # slow, down, or not JSON: the script carries on
        log.warning("llm failed: %r", e)
        return None
    intent = out.get("intent") if out.get("intent") in INTENTS else "unclear"
    value = out.get("value")
    if intent == "answer":
        value = _match_option(value, options)
        if value is None:
            intent = "unclear"                   # a value we did not offer is not an answer
    reply = _short(out.get("reply") or "") if intent == "question" else None
    if intent == "question" and not reply:
        reply = DONT_KNOW
    return {"intent": intent, "value": value, "reply": reply}


def _short(text, limit=200):
    """Keep whole sentences within `limit` characters: never stop mid-word on a phone line."""
    text = text.strip()
    if len(text) <= limit:
        return text
    cut = max(text.rfind(p, 0, limit) for p in "।.?!")
    return text[:cut + 1] if cut > 0 else DONT_KNOW


def _match_option(value, options):
    if value is None:
        return None
    for k in options:
        if str(k) == str(value).strip():
            return k
    return None


def _sarvam(system: str, user: str) -> str:
    key = os.environ["SARVAM_API_KEY"]
    r = _client().post(URL, headers={"api-subscription-key": key, "Authorization": f"Bearer {key}"}, json={
        "model": MODEL, "temperature": 0.1, "max_tokens": 200,
        "response_format": {"type": "json_object"},
        "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}]})
    r.raise_for_status()
    return r.json()["choices"][0]["message"]["content"]


@lru_cache(maxsize=1)
def _client():
    import httpx
    return httpx.Client(timeout=TIMEOUT)
