"""Every fixed thing the engine can say: prompt id -> text, per language.

The engine only ever returns ids (spec §1.1). Channels render the ids once into their
own format (8 kHz WAV for IVR, …) from GET /v1/prompts/{lang}, so there is exactly one
copy of the wording, here. Value clips ("सिलाई", "दसवीं") and menus are generated from
the word list so a new trade is one lexicon entry, not a code change.
"""

import json
import os
from functools import lru_cache
from pathlib import Path

from .districts import load as districts
from .extract import lexicon

BASE_HI = {
    "stay_on_topic": "मैं सिर्फ़ आपके लिए सही कोर्स ढूँढने में मदद कर सकती हूँ। चलिए, आगे बढ़ते हैं।",
    "abuse_warning": "कृपया सम्मान से बात कीजिए। मैं आपकी मदद के लिए ही हूँ।",
    "abuse_bye": "माफ़ कीजिए, इस तरह बात आगे नहीं बढ़ सकती। जब चाहें, दोबारा फ़ोन कीजिए। नमस्ते।",
    "call_limit": "आज इस नंबर से बहुत बार फ़ोन आ चुका है। कृपया कल फिर कोशिश कीजिए। धन्यवाद।",
    "v-dist-told": "आपका बताया हुआ ज़िला",
    "q0_again": "अपने ज़िले का नाम बताइए, जैसे, गया, बिहार।",
    "ack_got_it": "जी, समझ गई।",
    "ack_thanks": "धन्यवाद।",
    "ack_good": "अच्छा।",
    "emp_no_school": "कोई बात नहीं। कई कोर्स ऐसे हैं, जिनके लिए पढ़ाई ज़रूरी नहीं होती।",
    "emp_experience": "बहुत अच्छा। इतना अनुभव आपके बहुत काम आएगा।",
    "emp_no_work": "कोई बात नहीं। इसीलिए तो हम आपके लिए सही काम ढूँढ रहे हैं।",
    "emp_difficulty": "समझ सकती हूँ। हम ऐसे कोर्स देखेंगे, जो आपके लिए आसान हों।",
    # a problem the caller shared: acknowledge it, say what we will do (only true things), carry on
    "prob-money": "समझ सकती हूँ, पैसों की तंगी बहुत मुश्किल होती है। इसीलिए हम ऐसा हुनर ढूँढ रहे हैं, जिससे आपकी कमाई बढ़ सके।",
    "prob-health": "यह सुनकर दुख हुआ। अपनी सेहत का ध्यान रखिए। हम ऐसे कोर्स देखेंगे, जो आपके लिए आसान हों।",
    "prob-travel": "समझ गई, दूर आना-जाना मुश्किल है। हम कम समय वाले कोर्स पहले रखेंगे।",
    "prob-family": "समझ सकती हूँ, घर की ज़िम्मेदारी भी ज़रूरी है। हम कम समय वाले कोर्स पहले रखेंगे।",
    "prob-no_work": "काम न मिलना बहुत परेशानी की बात है। इसीलिए यह बातचीत है, ताकि आपके लिए सही हुनर ढूँढा जा सके।",
    "prob-documents": "कागज़ों की दिक्कत मैंने ज़िले के साथियों के लिए लिख ली है। चाहें तो हैश दबाइए, वे आपको फ़ोन करेंगे।",
    "prob-discrimination": "यह सुनकर बहुत दुख हुआ। ऐसा बर्ताव ठीक नहीं है। मैंने यह बात लिख ली है, और ज़िले के साथी आपको फ़ोन करेंगे।",
    "prob-other": "समझ सकती हूँ। आपकी बात मैंने ज़िले के साथियों के लिए लिख ली है।",
    "prob_noted": "जी, यह बात मैंने लिख ली है।",
    "back_to_q": "चलिए, अब यह बताइए।",
    "go_back_ok": "ठीक है, उस सवाल पर वापस चलते हैं।",
    "go_back_first": "यह पहला ही सवाल है।",
    "you_told_earlier": "आपने पहले बताया था,",
    # reasoning out loud, from answers already confirmed (flow._after_answer)
    "reason_same_trade": "यानी आप परिवार का हुनर ही आगे बढ़ा रहे हैं, यह बहुत अच्छी बात है।",
    "reason_demand_match": "अच्छी बात है, आप जो सीखना चाहते हैं, उसकी आपके इलाके में माँग भी है।",
    "reason_skill_to_business": "आपके पास पहले से हुनर है, अपना काम शुरू करने में यह बहुत काम आएगा।",
    "progress_half": "आधे सवाल हो गए, बस थोड़े और।",
    "progress_last": "बस यह आख़िरी सवाल।",
    "reask_gentle": "कोई बात नहीं, आराम से बताइए। या नीचे दिए नंबर दबाइए।",
    "is_right_short": "सही है?",
    "welcome": "नमस्ते! पीएम-अजय कौशल सहायता सेवा में आपका स्वागत है। किसी साथी से बात करनी हो, तो कभी भी हैश दबाइए, और पिछले सवाल पर लौटना हो, तो स्टार।",
    "help_queued": "ज़रूर। हमारे साथी आपको जल्द फ़ोन करेंगे। तब तक चाहें, तो बात जारी रखिए।",
    "consent": "हम आपसे कुछ छोटे सवाल पूछेंगे, ताकि सही कोर्स ढूँढ सकें। आपकी आवाज़ रिकॉर्ड नहीं होगी। क्या शुरू करें? हाँ या नहीं बोलिए, या एक या दो दबाइए।",
    "close_polite": "कोई बात नहीं। जब चाहें, दोबारा फ़ोन कीजिए। धन्यवाद!",
    "resume_offer": "आपकी पिछली बातचीत अधूरी है। क्या वहीं से आगे बढ़ें? हाँ या नहीं बोलिए, या एक या दो दबाइए।",
    "resume_ok": "ठीक है, वहीं से आगे बढ़ते हैं।",
    "new_start": "ठीक है, नई शुरुआत करते हैं।",
    "q0": "आप किस ज़िले से बोल रहे हैं?",
    "q1": "आपने कहाँ तक पढ़ाई की है?",
    "q2": "आपके परिवार का पुश्तैनी काम क्या है?",
    "q2_years": "यह काम आप कितने साल से कर रहे हैं?",
    "q3": "अभी आप क्या काम करते हैं?",
    "q4": "आप कौन सा काम सीखना चाहेंगे?",
    "q5": "क्या आने-जाने में, शरीर से, या घर की ज़िम्मेदारी की वजह से कोई परेशानी है?",
    "q5_guardian": "क्या आपके साथ कोई घरवाले हैं, जो आपकी ओर से हाँ कह सकें? हाँ या नहीं बोलिए, या एक या दो दबाइए।",
    "q6": "आप अपना काम शुरू करना चाहेंगे, या नौकरी?",
    "q7": "आपके इलाके में किस काम की सबसे ज़्यादा माँग है?",
    "reask": "माफ़ कीजिए, ठीक से सुनाई नहीं दिया। एक बार फिर बताइए।",
    "nudge": "क्या आप लाइन पर हैं?",
    "you_said": "आपने कहा,",
    "is_right": "सही है? हाँ या नहीं बोलिए, या एक या दो दबाइए।",
    "ack": "ठीक है।",
    "deferred": "कोई बात नहीं, आगे बढ़ते हैं।",
    "readback_intro": "एक बार आपके जवाब दोहरा देती हूँ।",
    "readback_confirm": "क्या सब सही है? हाँ या नहीं बोलिए, या एक या दो दबाइए।",
    "readback_pick": "कौन सा सवाल बदलना है? एक से सात तक, उसका नंबर दबाइए।",
    "label_q1": "पढ़ाई:",
    "label_q2": "परिवार का काम:",
    "label_q3": "अभी का काम:",
    "label_q4": "रुचि:",
    "label_q5": "परेशानी:",
    "label_q6": "पसंद:",
    "label_q7": "इलाके की माँग:",
    "v-deferred": "बाद में",
    "recommend_intro": "धन्यवाद! आपके जवाबों के हिसाब से,",
    "goodbye": "कोई भी सवाल हो, तो इसी नंबर पर दोबारा फ़ोन कीजिए। धन्यवाद, नमस्ते!",
    "hmm": "हम्म।",
    "sorry": "माफ़ कीजिए, अभी तकनीकी दिक्कत है। हम आपको थोड़ी देर में फ़ोन करेंगे।",
    "menu_other": "कुछ और हो तो शून्य दबाइए।",
    "v-edu-0": "पढ़ाई नहीं की",
    "v-edu-literate": "पढ़ना लिखना आता है",
    "v-edu-5": "पाँचवीं तक",
    "v-edu-8": "आठवीं तक",
    "v-edu-9": "नौवीं तक",
    "v-edu-10": "दसवीं पास",
    "v-edu-11": "ग्यारहवीं तक",
    "v-edu-12": "बारहवीं पास",
    "v-edu-iti": "आईटीआई या डिप्लोमा",
    "v-edu-15": "कॉलेज",
    "q1_menu": ("पढ़ाई नहीं की तो एक। पाँचवीं तक दो। आठवीं तक तीन। दसवीं चार। "
                "बारहवीं या आईटीआई पाँच। कॉलेज छह।"),
    "v-mob-none": "कोई परेशानी नहीं",
    "v-mob-distance": "दूर जाने में परेशानी",
    "v-mob-physical": "शरीर से परेशानी",
    "v-mob-care_duty": "घर की ज़िम्मेदारी",
    "v-mob-cognitive": "समझने में परेशानी",
    "q5_menu": "कोई परेशानी नहीं तो एक। दूर जाने में दिक्कत दो। शरीर से दिक्कत तीन। घर की ज़िम्मेदारी चार।",
    "v-pref-self": "अपना काम",
    "v-pref-wage": "नौकरी",
    "v-pref-either": "दोनों में से कुछ भी",
    "q6_menu": "अपना काम तो एक। नौकरी दो। कुछ भी चलेगा तो तीन।",
    "q2_years_menu": "एक साल से कम तो एक। एक दो साल तो दो। तीन चार साल तो तीन। पाँच से नौ साल चार। दस साल से ज़्यादा पाँच।",
    "v-trade-other": "कुछ और",
}

# Bhojpuri: DRAFT wording, to be checked and re-recorded by a native speaker before any
# real caller hears it. Anything missing here is played in Hindi (the IVR falls back).
BASE_BHO = {
    "welcome": "प्रणाम। ई पीएम अजय के ओर से हुनर सहायता सेवा बा। कबो साथी से बात करे खातिर हैश दबाईं।",
    "consent": ("हमनी रउआ से रउआ काम आ पढ़ाई के बारे में सात गो सवाल पूछब, ताकि सही कोर्स बता सकीं। "
                "रउआ आवाज़ रिकॉर्ड ना रखल जाई। का रउआ तइयार बानी? हँ भा ना बोलीं, भा एक भा दू दबाईं।"),
    "q0": "रउआ कवना ज़िला से बोलत बानी?",
    "q1": "रउआ कहाँ ले पढ़ाई कइले बानी?",
    "q2": "रउआ परिवार के पुश्तैनी काम का ह?",
    "q2_years": "ई काम रउआ केतना साल से करत बानी?",
    "q3": "अभी रउआ का काम करत बानी?",
    "q4": "रउआ कवन काम आवेला, भा का सीखे के चाहत बानी?",
    "q5": "आवे-जाए में, भा देह से, कवनो दिक्कत बा? भा घर के कवनो जिम्मेदारी?",
    "q6": "रउआ आपन काम शुरू करे के चाहब, भा नौकरी?",
    "q7": "रउआ इलाका में कवना काम के सबसे ज्यादा माँग बा?",
    "reask": "माफ करीं, हम ठीक से ना समझनी। एक बेर फेर से बताईं।",
    "you_said": "रउआ कहनी,",
    "is_right": "ठीक बा? हँ भा ना बोलीं, भा एक भा दू दबाईं।",
    "is_right_short": "ठीक बा?",
    "ack": "ठीक बा।",
    "help_queued": "ठीक बा, हमनी के साथी रउआ के जल्दी फोन करिहें। तब ले चाहीं त बात जारी राखीं।",
    "goodbye": "कवनो सवाल खातिर एही नंबर पर फेर फोन करीं। प्रणाम।",
}

YEARS_DTMF = {"1": 0, "2": 2, "3": 4, "4": 5, "5": 10}
_NUM_HI = ["शून्य", "एक", "दो", "तीन", "चार", "पाँच", "छह", "सात", "आठ", "नौ"]


# --- other languages ------------------------------------------------------------------
# Bengali, Odia, …: one data file each (data/prompts_<lang>.json, DRAFT until a native speaker
# checks it) holding every Hindi prompt plus the pieces the catalogue and the result are built from.
DATA = Path(__file__).resolve().parent.parent / "data"
LANGS = os.environ.get("ENGINE_LANGS", "hi").split(",")      # the language menu, in this order
FULL = ("hi", "bn", "or")                                    # complete catalogues (bho: a few drafts)
ORDER = ("hi", "bn", "or", "bho")                            # menu position for a language not in LANGS


def _position(lang):
    return (LANGS if lang in LANGS else ORDER).index(lang) + 1

HI_PACK = {
    "lang_pick": "हिंदी के लिए {num} दबाइए।",
    "district_other": "दूसरा ज़िला", "years": "{n} साल", "year_less": "एक साल से कम",
    "menu_item": "{name} के लिए {num}।", "district_menu_other": "दूसरे ज़िले के लिए नौ।",
    "spoken": {
        "none": "अभी आपके जवाबों से मेल खाता कोई कोर्स नहीं मिला। हमारे ज़िले के साथी आपसे संपर्क करेंगे।",
        "count": "आपके लिए {n} कोर्स हैं।", "ordinals": ["पहला", "दूसरा", "तीसरा"],
        "item": "{ord}: {title}, लेवल {level}{dur}। {reason}।", "duration": ", करीब {m} महीने का",
        "near": "{title} के लिए आपको {gap} चाहिए।", "gap_years": "{n} साल और अनुभव",
        "gap_class": "एक और कक्षा की पढ़ाई", "gap_other": "थोड़ी और तैयारी",
        "finance": "हर कोर्स में पैसों के हिसाब किताब की ट्रेनिंग भी मिलती है।",
        "self": "अपना काम शुरू करने के लिए पीएम अजय से, बैंक लोन के साथ, पचास हज़ार रुपये तक की मदद मिल सकती है।",
        "halves": {}},
    "reasons": {
        "skill_transfer": "यह आपके परिवार या अभी के काम से जुड़ा है",
        "aspiration": "यह वही काम है जो आप सीखना चाहते हैं",
        "disability_sector": "यह कोर्स दिव्यांग साथियों के लिए बनाया गया है",
        "local_demand": "आपके इलाके में इस काम की माँग है",
        "fit": "यह आपकी पढ़ाई और अनुभव के हिसाब से सही है"},
    "why": {
        "build_on_family_skill": "आपके परिवार के काम का अनुभव आपकी ताक़त है, इसलिए उसी हुनर को आगे बढ़ाने वाले कोर्स पहले रखे हैं।",
        "grow_current_work": "आप जो काम अभी करते हैं, उसी को बेहतर करने वाले कोर्स पहले रखे हैं।",
        "local_match": "आप जो सीखना चाहते हैं, उसकी आपके इलाके में माँग भी है, इसलिए उसे पहले रखा है।",
        "local_differs": "आपकी रुचि और इलाके की माँग अलग-अलग है, इसलिए दोनों तरह के कोर्स रखे हैं।",
        "short": "आने-जाने और घर की ज़िम्मेदारी देखते हुए, कम समय वाले कोर्स पहले रखे हैं।",
        "pwd": "दिव्यांग साथियों के लिए बने कोर्स भी रखे हैं।"},
}


@lru_cache(maxsize=None)
def pack(lang: str) -> dict:
    """Everything language-specific for `lang`; Hindi for anything a pack leaves out."""
    if lang == "hi":
        return HI_PACK
    f = DATA / f"prompts_{lang}.json"
    return {**HI_PACK, **json.loads(f.read_text(encoding="utf-8"))} if f.exists() else HI_PACK


def number(n: int, lang: str = "hi") -> str:
    """A number as the voice should say it: digits in Hindi (the voice reads them), words
    elsewhere (the Odia voice cannot read digits)."""
    words = lexicon().get("number_words", {}).get(lang)
    return words[n] if words and 0 <= n < len(words) else str(n)


def _menu_num(n: int, lang: str) -> str:
    return _NUM_HI[n] if lang == "hi" else number(n, lang)


def _name(item: dict, lang: str) -> str:
    return item.get(lang) or item["hi"]


def trade_menu(lang: str = "hi") -> str:
    p = pack(lang)
    items = sorted((c for c in lexicon()["trades"] if c.get("dtmf")), key=lambda c: c["dtmf"])
    return " ".join(p["menu_item"].format(name=_name(c, lang), num=_menu_num(c["dtmf"], lang))
                    for c in items) + " " + catalogue_base(lang)["menu_other"]


def district_menu(lang: str = "hi") -> str:
    p = pack(lang)
    names = p.get("districts", {})
    return " ".join(p["menu_item"].format(name=names.get(d["id"], d["hi"]).removesuffix(" ज़िला"),
                                          num=_menu_num(d["dtmf"], lang)) for d in districts()) \
        + " " + p["district_menu_other"]


def catalogue_base(lang: str) -> dict:
    return BASE_HI if lang == "hi" else pack(lang).get("prompts", {})


@lru_cache(maxsize=None)
def catalogue(lang: str = "hi") -> dict:
    """hi, bn, or: every prompt. bho: only what differs; channels fall back to Hindi."""
    if lang == "bho":
        c = dict(BASE_BHO)
        c["lang_pick"] = "भोजपुरी खातिर {num} दबाईं।".format(num=_menu_num(_position(lang), "hi"))
        return c
    if lang not in FULL:
        raise KeyError(lang)                 # new language = data/prompts_<lang>.json + lexicon surfaces
    p = pack(lang)
    c = dict(catalogue_base(lang))
    for t in lexicon()["trades"]:
        c[f"v-trade-{t['id'].lower()}"] = _name(t, lang)
    names = p.get("districts", {})
    for d in districts():
        c[f"v-dist-{d['id'].lower()}"] = names.get(d["id"]) or f"{d['hi']} ज़िला"   # "गया" alone also means "went"
    c["v-dist-other"] = p["district_other"]
    for y in range(0, 41):
        c[f"v-years-{y}"] = p["year_less"] if y == 0 else p["years"].format(n=number(y, lang))
    c["q0_menu"] = district_menu(lang)
    from .llm import fact_list                     # side-question answers are pre-recorded too
    facts = p.get("facts", {})
    for f in fact_list():
        c[f"fact-{f['id']}"] = facts.get(f["id"]) or f["hi"]
    for q in ("q2", "q3", "q4", "q7"):
        c[f"{q}_menu"] = trade_menu(lang)
    # "বাংলার জন্য দুই টিপুন", in that language's voice: the menu is one clip per language
    c["lang_pick"] = p["lang_pick"].format(num=_menu_num(_position(lang), lang))
    return c
