"""The AI helper on this machine (LLM_PROVIDER=local): a small multilingual *matching* model, not a
chat model. It turns what the caller said into numbers and picks the closest item from lists we
wrote: an allowed answer, a pre-written fact, a problem topic, a question to go back to, or
repeat / help / off-topic. Same contract as llm.understand, same checks after it.

Why not a chat model: every job here is "pick from a list", which a 118 MB model does in ~20 ms on
the CPU and in ~100 languages (Hindi, Bengali, Odia, …: one set of examples serves all of them,
it matches meaning across languages). It cannot write text at all, so there is nothing to inject.

Model: intfloat/multilingual-e5-small (MIT), int8 ONNX from tools/get_local_ai.py.
Open answers: a place is matched by spelling against the 722 districts (places.py); a job the list
does not have is matched against the official course titles, which give its sectors and keywords.
"""

import json
import logging
import os
import re
from difflib import SequenceMatcher
from functools import lru_cache
from pathlib import Path

from . import extract, places
from .extract import lexicon, norm, translit

log = logging.getLogger("engine")
DIR = Path(__file__).resolve().parent.parent / ".cache" / "e5"
# Tuned on tools/eval_local_ai.py (46 sentences, hi/bn/or). Below its kind's bar -> "unclear":
# the flow then re-asks or offers the keypad, which is always safe.
BAR = {"answer": 0.86, "question": 0.92, "problem": 0.86, "goto": 0.86,
       "repeat": 0.93, "help": 0.93, "offtopic": 0.88}
ANSWER_BONUS = 0.03        # the question's own answers are the likeliest thing a caller says
GOTO_BONUS = 0.03          # …unless they said "change" / "back": then going back is
JOB_BAR = 0.85             # a job not on our list: closeness to an official course title
MARGIN = float(os.environ.get("LOCAL_AI_MARGIN", 0.01))         # best must beat the runner-up (other class) by this
CHANGE_CUES = ["बदल", "वापस", "पीछे", "गलत बता", "गलत बोल", "বদল", "ফিরে", "আগের", "ভুল বলেছি",
               "ବଦଳ", "ପଛକୁ", "ଫେରି", "ପୂର୍ବ", "ଭୁଲ କହିଲି", "change", "back"]

HELP = ["मुझे किसी इंसान से बात करनी है", "किसी अधिकारी से बात कराइए", "असली आदमी से बात करवाइए",
        "मुझे किसी साथी से बात करनी है", "कारও সঙ্গে কথা বলতে চাই", "কোনো মানুষের সঙ্গে কথা বলতে চাই",
        "ମୁଁ କାହା ସହ କଥା ହେବାକୁ ଚାହେଁ", "I want to talk to a person"]
PROBLEM_ASKS = {
    "money": ["घर चलाने के लिए पैसे नहीं बचते", "बहुत गरीबी है, दो वक्त का खाना मुश्किल है", "সংসার চালানোর টাকা নেই",
              "ଘର ଚଳାଇବାକୁ ଟଙ୍କା ନାହିଁ"],
    "health": ["मेरी तबीयत अक्सर खराब रहती है", "बीमारी की वजह से काम नहीं कर पाता", "আমার শরীর প্রায়ই খারাপ থাকে",
               "ମୋ ଦେହ ପ୍ରାୟ ଖରାପ ରହେ"],
    "travel": ["हमारे गाँव से शहर जाने का साधन नहीं है", "सेंटर बहुत दूर है, किराया नहीं है", "আমাদের গ্রাম থেকে যাতায়াতের ব্যবস্থা নেই",
               "ଆମ ଗାଁରୁ ସହରକୁ ଯିବାକୁ ଗାଡ଼ି ନାହିଁ"],
    "family": ["छोटे बच्चे हैं, उन्हें छोड़कर नहीं जा सकती", "बीमार माँ की देखभाल करनी पड़ती है", "বাচ্চাদের রেখে কোথাও যেতে পারি না",
               "ପିଲାଙ୍କୁ ଛାଡ଼ି କୁଆଡ଼େ ଯାଇପାରିବି ନାହିଁ"],
    "no_work": ["कई महीनों से कोई काम नहीं मिला", "गाँव में रोज़गार नहीं है", "অনেক দিন ধরে কোনো কাজ পাচ্ছি না",
                "ଅନେକ ଦିନ ହେଲା କାମ ମିଳୁନି"],
    "documents": ["मेरे पास आधार कार्ड नहीं है", "जाति प्रमाण पत्र नहीं बना", "राशन कार्ड खो गया", "আমার কোনো কাগজপত্র নেই",
                  "ମୋର ଆଧାର କାର୍ଡ ନାହିଁ"],
    "discrimination": ["जाति की वजह से हमारे साथ बुरा बर्ताव होता है", "हमें मंदिर में नहीं जाने देते",
                       "लोग नीची जाति का कहकर ताने मारते हैं", "জাতের জন্য আমাদের সঙ্গে খারাপ ব্যবহার করে",
                       "ଜାତି ପାଇଁ ଲୋକେ ଆମକୁ ଅଲଗା କରନ୍ତି"],
    "other": ["घर में नशे और झगड़े की परेशानी है", "मुझे किसी से डर लगता है", "বাড়িতে অশান্তি হয়", "ଘରେ ଝଗଡ଼ା ହୁଏ"],
}
OFFTOPIC = ["चुटकुला सुनाओ", "गाना सुनाओ", "कहानी सुनाओ", "आज मौसम कैसा है", "क्रिकेट का स्कोर बताओ",
            "तुम्हारी शादी हुई है", "मेरे साथ दोस्ती करोगी", "राजनीति पर बात करो", "कल किसकी सरकार बनेगी",
            "कोई फिल्म का नाम बताओ", "आईपीएल कौन जीतेगा", "অমুক খেলায় কে জিতবে", "ଆଜି ପାଗ କେମିତି", "একটা গান শোনাও",
            "একটা গল্প বলো", "ଗୋଟିଏ ଗୀତ ଶୁଣାଅ", "tell me a joke", "who will win the election"]
FACT_ASKS = {                      # ways people ask, next to each fact's own sentence
    "A1": ["आप कौन बोल रहे हैं", "यह किसका फोन है", "कौन सी सरकारी योजना है"],
    "A2": ["यह फोन क्यों किया", "इससे क्या होगा", "आप क्या करते हो"],
    "A3": ["कितने सवाल हैं", "कितना समय लगेगा", "कितनी देर लगेगी", "আর কতক্ষণ লাগবে", "ଆଉ କେତେ ସମୟ ଲାଗିବ"],
    "A4": ["मेरी आवाज़ रिकॉर्ड हो रही है क्या", "मेरा डेटा कहाँ जाएगा"],
    "A5": ["कोर्स कितने दिन का है", "कितने महीने की ट्रेनिंग है"],
    "A6": ["फीस कितनी है", "पैसे लगेंगे क्या", "सेंटर कहाँ है", "कब से शुरू होगा", "वज़ीफ़ा मिलेगा क्या",
           "কত টাকা ফি লাগবে", "টাকা দিতে হবে কি", "সেন্টার কোথায়", "ଫି କେତେ ଲାଗିବ", "ଟଙ୍କା ଦେବାକୁ ପଡ଼ିବ କି"],
    "A7": ["ट्रेनिंग में और क्या सिखाएंगे"],
    "A8": ["लोन मिलेगा क्या", "अपना काम शुरू करने के लिए पैसा मिलेगा"],
    "A9": ["औरतें भी जुड़ सकती हैं क्या", "महिलाओं के लिए है क्या", "মেয়েরা কি যোগ দিতে পারে", "ମହିଳା ଯୋଗ ଦେଇପାରିବେ କି"],
    "A10": ["नौकरी मिलेगी क्या", "ट्रेनिंग के बाद काम मिलेगा", "কাজ পাওয়া যাবে কি", "ଚାକିରି ମିଳିବ କି"],
    "A11": ["किसी से बात कैसे करूं"],
    "A12": ["पक्की नौकरी मिलेगी", "कितने पैसे मिलेंगे गारंटी है"],
}
YES_NO_ASKS = {"yes": ["हाँ, शुरू करते हैं", "ठीक है, चलिए", "जी हाँ बिल्कुल", "हाँ सही है", "हाँ कर लेते हैं",
                      "হ্যাঁ, শুরু করুন", "ঠিক আছে, চলুন", "ହଁ, ଆରମ୍ଭ କରନ୍ତୁ", "ଠିକ୍ ଅଛି, ଚାଲନ୍ତୁ"],
               "no": ["नहीं, अभी नहीं", "बाद में करेंगे", "मुझे नहीं करना", "नहीं, गलत है", "না, এখন না",
                      "পরে করব", "ନା, ଏବେ ନୁହେଁ", "ପରେ କରିବା"]}
GOTO_ASKS = {"q0": "ज़िले", "q1": "पढ़ाई", "q2": "परिवार के काम", "q2_years": "कितने साल", "q3": "अभी के काम",
             "q4": "सीखने", "q5": "परेशानी", "q6": "नौकरी या अपने काम", "q7": "इलाके की माँग"}


# --- the model ---------------------------------------------------------------------

@lru_cache(maxsize=1)
def _model():
    import onnxruntime as ort
    from tokenizers import Tokenizer

    if not (DIR / "model.int8.onnx").exists():
        raise FileNotFoundError(f"{DIR} (run: uv run --extra local --with onnx python tools/get_local_ai.py)")
    opts = ort.SessionOptions()
    opts.intra_op_num_threads = int(os.environ.get("LOCAL_AI_THREADS", 2))
    tok = Tokenizer.from_file(str(DIR / "tokenizer.json"))
    tok.enable_truncation(128)
    tok.enable_padding()
    return ort.InferenceSession(str(DIR / "model.int8.onnx"), opts, providers=["CPUExecutionProvider"]), tok


def embed(texts: list[str]):
    """-> unit vectors, one row per text (mean-pooled, as e5 is trained)."""
    import numpy as np

    session, tok = _model()
    out = []
    for i in range(0, len(texts), 64):
        enc = tok.encode_batch([f"query: {t}" for t in texts[i:i + 64]])
        ids = np.array([e.ids for e in enc], dtype=np.int64)
        mask = np.array([e.attention_mask for e in enc], dtype=np.int64)
        h = session.run(None, {"input_ids": ids, "attention_mask": mask, "token_type_ids": np.zeros_like(ids)})[0]
        v = (h * mask[..., None]).sum(1) / mask.sum(1, keepdims=True)
        out.append(v / np.linalg.norm(v, axis=1, keepdims=True))
    return np.vstack(out)


def warm_up():
    try:
        _examples()
        _courses()                          # 1,200 course titles, once (~0.5 s), not on a caller's turn
    except Exception as e:
        log.warning("local AI helper not loaded: %r", e)


# --- what it can pick ----------------------------------------------------------------

@lru_cache(maxsize=1)
def _examples():
    """(labels, vectors) for everything except a question's own answers (those change per question)."""
    from .llm import GOTO, PROBLEMS, fact_list
    lex = lexicon()
    pairs = [("repeat", p) for p in lex.get("repeat", [])] + [("help", p) for p in HELP]
    pairs += [("offtopic", p) for p in OFFTOPIC]
    for f in fact_list():
        pairs += [(f"question:{f['id']}", t) for t in [f["hi"], f["about"], *FACT_ASKS.get(f["id"], [])]]
    for topic, desc in PROBLEMS.items():
        pairs += [(f"problem:{topic}", t) for t in [desc, *lex.get("problems", {}).get(topic, []),
                                                     *PROBLEM_ASKS.get(topic, [])]]
    pairs += [("goto:prev", p) for p in lex.get("go_back", [])]
    for field, word in GOTO_ASKS.items():
        pairs += [(f"goto:{field}", f"{word} वाला जवाब बदलना है"), (f"goto:{field}", f"{word} वाले सवाल पर वापस चलो"),
                  (f"goto:{field}", GOTO[field])]
    labels = [p[0] for p in pairs]
    return labels, embed([p[1] for p in pairs])


@lru_cache(maxsize=64)
def _answers(items: tuple):
    """Vectors for one question's answers, made once per question (the options never change)."""
    pairs = _answer_texts(dict(items))
    return [p[0] for p in pairs], embed([p[1] for p in pairs])


def _answer_texts(options: dict) -> list[tuple[str, str]]:
    """Each allowed value with its description and, for known values, our word list's phrases."""
    lex = lexicon()
    extra = {t["id"]: t["surface"] + [t["hi"], t.get("bn", ""), t.get("or", "")] for t in lex["trades"]}
    extra |= {v: words + YES_NO_ASKS[v] for v, words in lex["yes_no"].items()}
    extra |= {k: w for k, w in lex["mobility"].items() if k != "dtmf"}
    extra |= {k: w for k, w in lex["employment_pref"].items() if k != "dtmf"}
    out = []
    for value, desc in options.items():
        for t in [desc, *extra.get(str(value), [])]:
            if t and not str(t).isdigit():
                out.append((f"answer:{value}", str(t)))
    return out


# --- open answers --------------------------------------------------------------------

@lru_cache(maxsize=1)
def _district_names():
    return [(d.lower(), st, d) for st, ds in places.states().items() for d in ds]


def place(heard: str):
    """A district named in the caller's words, by spelling ('खोर्धा' ~ 'Khordha').
    -> (state, district, the caller's own word for it, to read back) or None."""
    raw = [w for w in heard.split() if norm(w) and norm(w) not in extract.STOP]
    words = [norm(w) for w in raw]
    grams = [(w, r) for w, r in zip(words, raw)]
    grams += [(" ".join(words[i:i + 2]), " ".join(raw[i:i + 2])) for i in range(len(words) - 1)]
    best = (0.0, None)
    for g, said in grams:
        t = translit(g).replace("aa", "a").replace("ii", "i").replace("uu", "u")
        if len(t) < 5:
            continue
        for low, st, d in _district_names():
            # Odia and Bengali join "from"/"in" onto the name: ଗଞ୍ଜାମରୁ = Ganjam + ru
            r = 0.9 if len(low) >= 5 and t.startswith(low) and len(t) - len(low) <= 4 else \
                SequenceMatcher(None, t, low).ratio()
            if r > best[0]:
                best = (r, (st, d, re.sub(r"[।॥,.?!\"']", "", said)))   # the flow cleans it again
    return best[1] if best[0] >= 0.85 else None


@lru_cache(maxsize=1)
def _courses():
    from .recommend import register
    rows = [r for r in register()["rows"] if r.get("title") and r.get("sector") and r.get("level") and r["level"] <= 4]
    return rows, embed([r["title"] for r in rows])


def job(heard: str, sectors: list[str], q=None, beat: float = 0.0):
    """A job not on our list -> (label, sectors, keywords) from the closest official course titles.
    `beat`: the best answer's closeness; a course title must be closer (solar panels are not tailoring)."""
    rows, vecs = _courses()
    sims = vecs @ (embed([heard])[0] if q is None else q)
    top = sims.argsort()[::-1][:5]
    if sims[top[0]] < max(JOB_BAR, beat):
        return None
    secs = [s for s in dict.fromkeys(rows[i]["sector"] for i in top) if s in sectors][:3]
    keys = re.findall(r"[a-z]{4,}", rows[top[0]]["title"].lower())[:5]
    label = heard_label(heard)
    return (label, secs, keys) if secs and label else None


def heard_label(heard: str) -> str:
    """The caller's own words for the job, minus filler: read back as 'you said …'."""
    words = [w for w in heard.split() if norm(w) not in extract.STOP]
    return " ".join(words[:3])


# --- the one entry point ---------------------------------------------------------------

def understand(question, options, heard, describe=None, open_kind=None, sectors=None, lang="hi"):
    """Same answer shape as llm.understand."""
    import numpy as np

    text = heard[0][:300]
    labels, vecs = _examples()
    if not describe and options:
        a_labels, a_vecs = _answers(tuple(options.items()))
        labels, vecs = labels + a_labels, np.vstack([vecs, a_vecs])
    q = embed([text])[0]
    sims = vecs @ q
    cue = any(c in text.lower() for c in CHANGE_CUES)           # "go back" needs a word that says so
    best = {}
    for label, s in zip(labels, sims):
        if label.startswith("goto") and not cue:
            continue
        s = float(s) + (ANSWER_BONUS if label.startswith("answer") else GOTO_BONUS if label.startswith("goto") else 0.0)
        best[label] = max(best.get(label, -1.0), s)
    ranked = sorted(best.items(), key=lambda kv: -kv[1])
    (top, s1) = ranked[0]
    kind = top.partition(":")[0]
    # the runner-up that matters is another *kind* (a problem vs an answer); two close answers are
    # fine, the read-back settles which
    s2 = next((v for k, v in ranked[1:] if k.partition(":")[0] != kind), 0.0)
    out = {"intent": "unclear", "value": None, "fact": None, "problem": None, "goto": None, "score": round(s1, 3)}
    if open_kind == "place":
        hit = place(text)
        if hit:
            return out | {"intent": "answer", "value": "PLACE", "state": hit[0], "district": hit[1], "hi": hit[2]}
    if s1 < BAR[kind] or s1 - s2 < MARGIN:
        if open_kind == "trade" and not top.startswith(("question", "problem", "goto", "help", "offtopic")):
            got = job(text, sectors or [], q)
            if got:
                return out | {"intent": "answer", "value": "NEW", "label": got[0], "sectors": got[1], "keywords": got[2]}
        return out
    arg = top.partition(":")[2]
    if kind == "answer" and open_kind == "trade" and arg not in ("NONE", "OTHER", "LABOUR"):
        got = job(text, sectors or [], q, beat=s1 - ANSWER_BONUS)   # an official course title closer than our trade
        if got:
            return out | {"intent": "answer", "value": "NEW", "label": got[0], "sectors": got[1], "keywords": got[2]}
    if kind == "answer":
        return out | {"intent": "answer", "value": next(k for k in options if str(k) == arg)}
    if kind == "question":
        return out | {"intent": "question", "fact": arg}
    if kind == "problem":
        return out | {"intent": "problem", "problem": arg}
    if kind == "goto":
        return out | {"intent": "goto", "goto": arg}
    return out | {"intent": kind}
