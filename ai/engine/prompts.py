"""Every fixed thing the engine can say: prompt id -> text, per language.

The engine only ever returns ids (spec §1.1). Channels render the ids once into their
own format (8 kHz WAV for IVR, …) from GET /v1/prompts/{lang}, so there is exactly one
copy of the wording, here. Value clips ("सिलाई", "दसवीं") and menus are generated from
the word list so a new trade is one lexicon entry, not a code change.
"""

from functools import lru_cache

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
    "progress_half": "आधे सवाल हो गए, बस थोड़े और।",
    "progress_last": "बस यह आख़िरी सवाल।",
    "reask_gentle": "कोई बात नहीं, आराम से बताइए। या नीचे दिए नंबर दबाइए।",
    "is_right_short": "सही है?",
    "welcome": "नमस्ते! पीएम-अजय कौशल सहायता सेवा में आपका स्वागत है। किसी साथी से बात करनी हो, तो कभी भी हैश दबाइए।",
    "lang_select": "हिंदी के लिए एक दबाइए। भोजपुरी खातिर दू दबाईं।",
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


def trade_menu_hi() -> str:
    items = sorted((c for c in lexicon()["trades"] if c.get("dtmf")), key=lambda c: c["dtmf"])
    return " ".join(f"{c['hi']} के लिए {_NUM_HI[c['dtmf']]}।" for c in items) + " " + BASE_HI["menu_other"]


def district_menu_hi() -> str:
    return " ".join(f"{d['hi']} के लिए {_NUM_HI[d['dtmf']]}।" for d in districts()) + " दूसरे ज़िले के लिए नौ।"


@lru_cache(maxsize=None)
def catalogue(lang: str = "hi") -> dict:
    """Hindi: every prompt. Other languages: only what differs; channels fall back to Hindi."""
    if lang == "bho":
        return dict(BASE_BHO)
    if lang != "hi":
        raise KeyError(lang)                 # new language = a BASE_<lang> dict + lexicon surfaces
    c = dict(BASE_HI)
    for t in lexicon()["trades"]:
        c[f"v-trade-{t['id'].lower()}"] = t["hi"]
    for d in districts():
        c[f"v-dist-{d['id'].lower()}"] = f"{d['hi']} ज़िला"      # "गया" alone also means "went"
    c["v-dist-other"] = "दूसरा ज़िला"
    for y in range(0, 41):
        c[f"v-years-{y}"] = "एक साल से कम" if y == 0 else f"{y} साल"
    c["q0_menu"] = district_menu_hi()
    from .llm import fact_list                     # side-question answers are pre-recorded too
    for f in fact_list():
        c[f"fact-{f['id']}"] = f["hi"]
    for q in ("q2", "q3", "q4", "q7"):
        c[f"{q}_menu"] = trade_menu_hi()
    return c
