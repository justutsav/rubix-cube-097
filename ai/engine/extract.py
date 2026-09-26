"""The extraction ladder: speech-to-text guesses -> one value from a closed set, with confidence.

Cheapest first (spec §2.3): DTMF is handled by the flow; here come the word list
(exact -> transliterated -> sound-alike -> fuzzy) and number patterns. The AI
classifier (llm.py) is the last resort and only runs when these find nothing.

Built to be wrong about words and right about fields: every result is confirmed
back to the caller before it is saved.
"""

import json
import re
import unicodedata
from difflib import SequenceMatcher
from functools import lru_cache
from pathlib import Path

LEX_PATH = Path(__file__).resolve().parent.parent / "data" / "lexicon.json"

# --- normalising and transliteration ----------------------------------------

_V = {"अ": "a", "आ": "aa", "इ": "i", "ई": "ii", "उ": "u", "ऊ": "uu", "ऋ": "ri", "ए": "e", "ऐ": "ai",
      "ओ": "o", "औ": "au", "ा": "aa", "ि": "i", "ी": "ii", "ु": "u", "ू": "uu", "ृ": "ri", "े": "e",
      "ै": "ai", "ो": "o", "ौ": "au", "ं": "n", "ः": "h", "ॅ": "e", "ॉ": "o"}
_C = {"क": "k", "ख": "kh", "ग": "g", "घ": "gh", "ङ": "n", "च": "ch", "छ": "chh", "ज": "j", "झ": "jh",
      "ञ": "n", "ट": "t", "ठ": "th", "ड": "d", "ढ": "dh", "ण": "n", "त": "t", "थ": "th", "द": "d",
      "ध": "dh", "न": "n", "प": "p", "फ": "ph", "ब": "b", "भ": "bh", "म": "m", "य": "y", "र": "r",
      "ल": "l", "व": "v", "श": "sh", "ष": "sh", "स": "s", "ह": "h", "ळ": "l"}
_DIGITS = str.maketrans("०१२३४५६७८९", "0123456789")


def norm(text: str) -> str:
    """Lowercase, Devanagari digits -> ASCII, drop nukta, chandrabindu -> anusvara, no punctuation."""
    t = unicodedata.normalize("NFC", text or "").lower().translate(_DIGITS)
    t = unicodedata.normalize("NFD", t).replace("़", "")          # nukta: ज़ -> ज
    t = unicodedata.normalize("NFC", t).replace("ँ", "ं")
    t = re.sub(r"[^\w\sऀ-ॿ]|[।॥]", " ", t)      # incl. "।" "॥": Sarvam ends every sentence with one
    return re.sub(r"\s+", " ", t).strip()


def translit(text: str) -> str:
    """Rough Devanagari -> Latin, so 'silai' and 'सिलाई' meet. Not a standard scheme."""
    out, chars = [], list(text)
    for i, ch in enumerate(chars):
        if ch in _C:
            out.append(_C[ch])
            nxt = chars[i + 1] if i + 1 < len(chars) else ""
            if nxt not in _V and nxt != "्" and nxt and nxt not in " " and nxt in _C:
                out.append("a")                                         # inherent vowel, mid-word
        elif ch in _V:
            out.append(_V[ch])
        elif ch == "्":
            continue
        else:
            out.append(ch)
    return "".join(out)


_KEY = [("chh", "J"), ("ch", "J"), ("sh", "S"), ("kh", "K"), ("gh", "K"), ("jh", "J"), ("th", "T"),
        ("dh", "T"), ("ph", "P"), ("bh", "P"), ("k", "K"), ("g", "K"), ("q", "K"), ("c", "K"), ("j", "J"),
        ("z", "J"), ("t", "T"), ("d", "T"), ("p", "P"), ("b", "P"), ("f", "P"), ("s", "S"), ("x", "KS"),
        ("v", "V"), ("w", "V"), ("m", "M"), ("n", "N"), ("r", "R"), ("l", "L"), ("y", "Y"),
        ("a", "A"), ("e", "A"), ("i", "A"), ("o", "A"), ("u", "A")]
MIN_KEY = 5            # shorter keys collide: "पता" and "पापड़" would sound alike


def phonetic(text: str) -> str:
    """Sound-alike key over the transliteration: consonant classes, any vowel = A, repeats collapsed."""
    t, key, i = translit(text).replace(" ", ""), [], 0
    while i < len(t):
        for src, dst in _KEY:
            if t.startswith(src, i):
                if not key or key[-1] != dst:
                    key.append(dst)
                i += len(src)
                break
        else:
            i += 1                                                     # h
    return "".join(key)


# --- the word list -------------------------------------------------------------

@lru_cache(maxsize=1)
def lexicon() -> dict:
    return json.loads(LEX_PATH.read_text(encoding="utf-8"))


class Table:
    """surface phrases -> value, pre-normalised once."""

    def __init__(self, pairs):
        self.entries = []
        for surface, value in pairs:
            n = norm(surface)
            if n:
                self.entries.append((n, translit(n), phonetic(n), len(n.split()), value))

    def scores(self, hypothesis: str) -> dict:
        """Best score per value for one hypothesis."""
        words = norm(hypothesis).split()
        best = {}
        for n, tl, key, width, value in self.entries:
            s = 0.0
            for i in range(len(words) - width + 1):
                gram = " ".join(words[i:i + width])
                if gram == n:
                    s = 1.0
                    break
                g_tl = translit(gram)
                if g_tl == tl:
                    s = max(s, 0.95)
                elif width == 1 and len(key) >= MIN_KEY and phonetic(gram) == key:   # phrases must match closer: "पता नहीं" is not "पढ़ाई नहीं"
                    s = max(s, 0.85)
                else:
                    # close spelling, on content words only: "इस ही का काम" must not
                    # look like "मिस्त्री का काम" just because both end in "का काम"
                    g_c, s_c = _content(gram), _content(n)
                    if len(s_c) >= 6:                           # short words: "नहीं" is one letter off "नवीं"
                        r = SequenceMatcher(None, g_c, s_c).ratio()
                        if r >= 0.85:
                            s = max(s, round(r * 0.9, 3))
            if s > best.get(_k(value), (0, None))[0]:
                best[_k(value)] = (s, value)
        return best


STOP = {norm(w) for w in "का की के है हैं हूँ हूं हो था थी करना करते करती करता कर में से पर को "
          "और भी ही तो मैं हम ka ki ke hai hu main".split()}


def _content(text):
    return translit(" ".join(w for w in text.split() if w not in STOP))


def _k(value):
    return json.dumps(value, sort_keys=True, ensure_ascii=False)


def best_over(table: Table, nbest: list[str]) -> list[tuple[float, object]]:
    """Scores over all hypotheses; later hypotheses count a little less. Highest first."""
    merged = {}
    for rank, hyp in enumerate(nbest[:5]):
        for k, (s, v) in table.scores(hyp).items():
            s = round(s * (1 - 0.05 * rank), 3)
            if s > merged.get(k, (0, None))[0]:
                merged[k] = (s, v)
    return sorted(merged.values(), key=lambda sv: -sv[0])


@lru_cache(maxsize=1)
def tables() -> dict:
    lex = lexicon()
    t = {
        "trade": Table((s, c["id"]) for c in lex["trades"] for s in c["surface"]),
        "yes_no": Table((s, v) for v, words in lex["yes_no"].items() for s in words),
        "education": Table((s, {k: w[k] for k in ("class", "literate", "iti") if k in w})
                           for w in lex["education"]["words"] for s in w["surface"]),
        "mobility": Table((s, v) for v, words in lex["mobility"].items() if v != "dtmf" for s in words),
        "employment_pref": Table((s, v) for v, words in lex["employment_pref"].items() if v != "dtmf"
                                 for s in words),
        "repeat": Table((s, True) for s in lex.get("repeat", [])),
    }
    try:
        from . import districts
        t["district"] = Table((s, d["id"]) for d in districts.load() for s in d["surface"])
    except FileNotFoundError:
        pass
    return t


# --- per-field extractors: nbest -> (value, confidence, method) or None ----------

MIN_CONF = 0.55


def _top(table_name, nbest):
    ranked = best_over(tables()[table_name], nbest)
    return ranked[0] if ranked and ranked[0][0] >= MIN_CONF else None


def yes_no(nbest):
    ranked = best_over(tables()["yes_no"], nbest)
    if not ranked or ranked[0][0] < MIN_CONF:
        return None
    if len(ranked) > 1 and ranked[1][0] >= ranked[0][0] - 0.05:
        return None                                   # "हाँ... नहीं" — ambiguous, ask again
    return ranked[0][1], ranked[0][0], "LEXICON"


_KEY_WORDS = {"शून्य": "0", "जीरो": "0", "ज़ीरो": "0", "एक": "1", "दो": "2", "तीन": "3", "चार": "4",
              "पांच": "5", "पाँच": "5", "छह": "6", "छः": "6", "छे": "6", "सात": "7", "आठ": "8", "नौ": "9",
              "zero": "0", "one": "1", "two": "2", "three": "3", "four": "4", "five": "5", "six": "6",
              "seven": "7", "eight": "8", "nine": "9"}


def spoken_key(nbest) -> str | None:
    """A menu number said aloud instead of pressed: 'नौ', '9', 'नंबर तीन' -> '9' / '3'."""
    words = [w for w in norm(nbest[0]).split() if w not in ("नंबर", "number", "दबाया", "वाला")] if nbest else []
    if len(words) != 1:
        return None
    w = words[0]
    if w.isdigit() and len(w) == 1:
        return w
    return {norm(k): v for k, v in _KEY_WORDS.items()}.get(w)


def leftover_confirmation(nbest) -> bool:
    """'हाँ सही है', 'जी ठीक है' at the start of a new question: an echo of the previous read-back."""
    words = norm(nbest[0]).split() if nbest else []
    return 0 < len(words) <= 4 and any(w in ("सही", "ठीक", "बिल्कुल") for w in words) and \
        (yes_no(nbest) or ("",))[0] == "yes"


@lru_cache(maxsize=1)
def _guard():
    g = json.loads((LEX_PATH.parent / "guardrails.json").read_text(encoding="utf-8"))
    return {"abuse": [norm(w) for w in g["abuse"]], "injection": [norm(w) for w in g["injection"]]}


def is_abusive(text: str) -> bool:
    """Abuse in any text we heard or would speak. Devanagari stems match inside words ("चोद");
    short Latin words only as whole words ("mc" must not hit "much")."""
    t = norm(text)
    words = set(t.split())
    for w in _guard()["abuse"]:
        if w.isascii():
            if (" " in w and w in t) or w in words:
                return True
        elif w in t:
            return True
    return False


def looks_like_injection(nbest) -> bool:
    """'ignore your instructions', 'अब तुम…', 'system prompt' — an attempt to steer the assistant."""
    t = f" {norm(nbest[0])} " if nbest else ""
    return any(f" {p} " in t for p in _guard()["injection"])       # whole words: "अब तुम्हारी" is fine


def wants_repeat(nbest) -> bool:
    """'फिर से बोलिए', 'समझ नहीं आया' … Only close matches: this skips an answer, so no guessing."""
    ranked = best_over(tables()["repeat"], nbest[:1])
    return bool(ranked) and ranked[0][0] >= 0.9


def trade(nbest):
    top = _top("trade", nbest)
    return (top[1], top[0], "LEXICON") if top else None


def trades(nbest, limit=3):
    """Several trades from one answer. The first needs the usual bar; extras need a clear hit."""
    ranked = [(s, v) for s, v in best_over(tables()["trade"], nbest) if v != "NONE"]
    if not ranked or ranked[0][0] < MIN_CONF:
        return None
    ranked = ranked[:1] + [r for r in ranked[1:] if r[0] >= 0.85]
    return [v for _, v in ranked[:limit]], min(s for s, _ in ranked[:limit]), "LEXICON"


_CLASS_CUE = r"(?:वीं|वी|वा|वाँ|th|पास|तक|क्लास|कक्षा|जमात|pass|class)"


def education(nbest):
    lex = lexicon()
    for rank, hyp in enumerate(nbest[:5]):
        n = norm(hyp)
        m = re.search(r"(\d{1,2})\s*" + _CLASS_CUE, n)
        if not m:
            for word, num in lex["numbers"].items():
                if re.search(re.escape(norm(word)) + r"\s*" + _CLASS_CUE, n) and num <= 12:
                    m = num
                    break
        else:
            m = int(m.group(1))
        if isinstance(m, int) and 0 < m <= 12:
            if m < 5:                                   # 1st-4th: reads and writes, below every NSQF cut-off
                return {"class": 0, "literate": True}, round(0.9 * (1 - 0.05 * rank), 3), "REGEX"
            return {"class": m}, round(0.9 * (1 - 0.05 * rank), 3), "REGEX"
    top = _top("education", nbest)
    return (top[1], top[0], "LEXICON") if top else None


_YEAR_CUE = r"(?:साल|वर्ष|बरस|saal|sal|years?|baras)"


def years(nbest):
    lex = lexicon()
    for rank, hyp in enumerate(nbest[:5]):
        n = norm(hyp)
        m = re.search(r"(\d{1,2})\s*" + _YEAR_CUE, n)
        if m:
            return int(m.group(1)), round(0.9 * (1 - 0.05 * rank), 3), "REGEX"
        for word, num in lex["numbers"].items():
            w = norm(word)
            if re.search(re.escape(w) + r"\s*" + _YEAR_CUE, n) or (word == "बचपन" and w in n):
                return num, round(0.8 * (1 - 0.05 * rank), 3), "REGEX"
    return None


def mobility(nbest):
    ranked = best_over(tables()["mobility"], nbest)
    ranked = [r for r in ranked if r[0] >= MIN_CONF]
    if not ranked:
        # a bare "नहीं" to "any difficulty?" means none — but only when that is all they said
        if nbest and len(norm(nbest[0]).split()) <= 2 and (yes_no(nbest) or ("",))[0] == "no":
            return "none", 0.8, "LEXICON"
        return None
    specific = [r for r in ranked if r[1] != "none" and r[0] >= ranked[0][0] - 0.15]
    s, v = specific[0] if specific else ranked[0]      # "दूर नहीं जा सकती" beats a bare "नहीं"
    return v, s, "LEXICON"


def employment_pref(nbest):
    top = _top("employment_pref", nbest)
    return (top[1], top[0], "LEXICON") if top else None


def district(nbest):
    if "district" not in tables():
        return None
    top = _top("district", nbest)
    return (top[1], top[0], "LEXICON") if top else None


def work_status(nbest, concept):
    """Q3's second half. From the concept when it implies one, else from cue words."""
    for c in lexicon()["trades"]:
        if c["id"] == concept and c.get("status"):
            return c["status"]
    pref = employment_pref(nbest)
    if pref and pref[0] in ("self", "wage"):
        return pref[0]
    return None
