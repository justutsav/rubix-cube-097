"""The interview: a fixed state machine (spec §2.2). Not an agent (decisions.md).

  NEW ─▶ RESUME ("continue the previous conversation?" — same phone, unfinished) ─┐
   └──▶ CONSENT ─▶ q0 district ─▶ q1 … q7 ─▶ READBACK ─▶ RECOMMEND ─▶ DONE
                               (q2 ─▶ q2_years;  q5 cognitive ─▶ GUARDIAN)

Every field runs the same sub-machine:
  ask ──answer──▶ confirm ──yes──▶ next field
   │  no match ×2 ──▶ menu (keypad) ──no match ×2 / silence ×2──▶ DEFER (skip, resumable)
Keypad answers need no confirmation: they are exact. Speech is always read back.
The AI helper (llm.py) runs only when the word list finds nothing: it may pick an allowed
value (still read back), answer a side question from the fact sheet, or spot "repeat" /
"I want a person". Capped per call (LLM_MAX_PER_CALL) to keep cost down.
"""

import os
import re
from dataclasses import dataclass

from . import extract, llm, places, prompts, recommend
from .districts import load as districts
from .extract import lexicon
from .prompts import YEARS_DTMF
from .store import Store

FIELDS = ["q0", "q1", "q2", "q2_years", "q3", "q4", "q5", "q6", "q7"]
READBACK = ["q1", "q2", "q3", "q4", "q5", "q6", "q7"]
MAX_ASK = 2            # spoken attempts before the keypad menu
MAX_MENU = 2           # keypad attempts before deferring
MAX_SILENCE = 2
YES_NO_DTMF = {"1": "yes", "2": "no"}
TIMEOUT_MS = 6000
LANGS = os.environ.get("ENGINE_LANGS", "hi").split(",")      # e.g. "hi,bho": asks at the start
LANG_DTMF = {str(i + 1): lang for i, lang in enumerate(LANGS)}
HELP_KEY = "#"          # any time: ask for a person to call back (0 and 9 are menu choices)
AI_PER_CALL = int(os.environ.get("LLM_MAX_PER_CALL", 6))     # cost cap: then menus/keypad only
MAX_ASIDES = 2          # side questions per question before we steer to the menu
PROGRESS = {"q4": "progress_half", "q7": "progress_last"}
ACKS = ["ack", "ack_got_it", "ack_thanks", "ack_good"]      # rotate, so it does not sound like a machine
YES_NO_STATES = {"CONSENT": "consent", "RESUME": "resume_offer", "READBACK": "readback_confirm",
                 "GUARDIAN": "q5_guardian"}


@dataclass
class Input:
    kind: str                       # opened | audio | text | dtmf | timeout
    digits: str = ""
    nbest: list | None = None       # None = speech could not be transcribed at all (no ASR)


# --- field definitions -------------------------------------------------------------

def _trade_dtmf():
    m = {str(c["dtmf"]): c["id"] for c in lexicon()["trades"] if c.get("dtmf")}
    return m | {"0": "OTHER"}


def _trade_clip(v):
    """Known trade -> its recorded clip; a job the caller named in their own words -> spoken live."""
    if isinstance(v, dict):
        return {"kind": "tts", "text": v["label"]}
    return f"v-trade-{v.lower()}"


def _place_clips(v):
    if v.get("id"):
        return [f"v-dist-{v['id'].lower()}"]
    return [{"kind": "tts", "text": v.get("hi") or v.get("district") or "दूसरा ज़िला"}]


def _pilot_place(pid):
    """Pilot district id (word list / keypad) -> the stored place."""
    if pid == "OTHER":
        return {"id": "OTHER"}
    d = next(x for x in districts() if x["id"] == pid)
    return {"id": pid, "district": d["name"], "state": d["state"], "hi": d["hi"]}


def _edu_clip(v):
    if v.get("iti"):
        return ["v-edu-iti"]
    if v.get("literate") and not v["class"]:
        return ["v-edu-literate"]
    return [f"v-edu-{v['class']}"]


def _field(name):
    lex = lexicon()
    trade_dtmf = _trade_dtmf()
    return {
        "q0": dict(extract=extract.district,
                   dtmf={str(d["dtmf"]): d["id"] for d in districts()} | {"9": "OTHER"},
                   clips=_place_clips),
        "q1": dict(extract=extract.education,
                   dtmf={k: {"class": c} for k, c in lex["education"]["dtmf"].items()},
                   clips=_edu_clip),
        "q2": dict(extract=extract.trade, dtmf=trade_dtmf, clips=lambda v: [_trade_clip(v)]),
        "q2_years": dict(extract=extract.years, dtmf=YEARS_DTMF, clips=lambda v: [f"v-years-{min(v, 40)}"]),
        "q3": dict(extract=extract.trade, dtmf=trade_dtmf, clips=lambda v: [_trade_clip(v["concept"])]),
        "q4": dict(extract=extract.trades, dtmf={k: [v] for k, v in trade_dtmf.items()},
                   clips=lambda v: [_trade_clip(x) for x in v] or ["v-trade-other"]),
        "q5": dict(extract=extract.mobility, dtmf=lex["mobility"]["dtmf"], clips=lambda v: [f"v-mob-{v}"]),
        "q6": dict(extract=extract.employment_pref, dtmf=lex["employment_pref"]["dtmf"],
                   clips=lambda v: [f"v-pref-{v}"]),
        "q7": dict(extract=extract.trades, dtmf={k: [v] for k, v in trade_dtmf.items()},
                   clips=lambda v: [_trade_clip(x) for x in v] or ["v-trade-other"]),
    }[name]


def ai_options(field):
    """(allowed values -> Hindi label, compact description or None) the AI may choose from."""
    lex = lexicon()
    trades = {c["id"]: c["hi"] for c in lex["trades"]} | {"NEW": "सूची में नहीं: नया काम (नीचे देखो)"}
    return {
        "q0": ({}, "  (कोई सूची नहीं: भारत की कोई भी जगह)"),
        "q1": ({"0": "कभी नहीं पढ़े", "literate": "थोड़ा-बहुत पढ़े, पढ़ना-लिखना आता है, या कक्षा साफ़ न बताएँ",
                "5": "पाँचवीं तक",
                "8": "आठवीं तक", "9": "नौवीं", "10": "दसवीं", "11": "ग्यारहवीं", "12": "बारहवीं",
                "iti": "आईटीआई या डिप्लोमा", "15": "कॉलेज, ग्रेजुएट या उससे ज़्यादा"}, None),
        "q2": (trades, None), "q3": (trades, None), "q4": (trades, None), "q7": (trades, None),
        "q2_years": ({str(n): "" for n in range(61)}, "  0 से 60 तक, कितने साल (सिर्फ़ संख्या, जैसे \"12\")"),
        "q5": ({"none": "कोई परेशानी नहीं", "distance": "दूर आने-जाने में परेशानी",
                "physical": "शरीर से परेशानी या दिव्यांगता", "care_duty": "घर या बच्चों की ज़िम्मेदारी",
                "cognitive": "समझने या याद रखने में परेशानी"}, None),
        "q6": ({"self": "अपना काम", "wage": "नौकरी", "either": "कुछ भी"}, None),
    }[field]


OPEN_KIND = {"q0": "place", "q2": "trade", "q3": "trade", "q4": "trade", "q7": "trade"}


def open_value(field, ai):
    """An open answer from the AI (any place, any job) -> stored value, or None if it fails the checks."""
    if OPEN_KIND.get(field) == "place":
        ok = places.check(ai.get("state"), ai.get("district"))
        if not ok:
            return None
        state, district = ok
        return {"id": None, "district": district, "state": state,
                "hi": re.sub(r"[^\u0900-\u097F ,]", "", str(ai.get("hi") or ""))[:60] or None}
    label = re.sub(r"[^\u0900-\u097F ]", "", str(ai.get("label") or "")).strip()[:30]
    if not label:
        return None
    known = recommend.sectors()
    custom = {"id": "CUSTOM", "label": label,
              "sectors": [x for x in (ai.get("sectors") or []) if x in known][:3],
              "keywords": [k for k in (re.sub(r"[^a-z ]", "", str(k).lower()).strip()
                                       for k in (ai.get("keywords") or [])) if 2 < len(k) < 25][:5]}
    return [custom] if field in ("q4", "q7") else custom


def from_ai(field, value):
    """AI option key -> the value the flow stores for that field."""
    if field == "q1":
        return {"literate": {"class": 0, "literate": True}, "iti": {"class": 12, "iti": True}}.get(
            value, {"class": int(value)})
    if field == "q2_years":
        return int(value)
    if field in ("q4", "q7"):
        return [value] if value != "OTHER" else []
    return value


YES_NO = ({"yes": "हाँ, सहमति", "no": "नहीं, असहमति"}, None)


def _normalise(field, value, nbest=None):
    """Shape a raw extracted/keyed value into what is stored."""
    if field == "q0" and isinstance(value, str):
        return _pilot_place(value)
    if field == "q3":
        return {"concept": value, "status": extract.work_status(nbest or [], value)}
    if field in ("q4", "q7") and value == ["OTHER"]:
        return []
    return value


# --- the machine -----------------------------------------------------------------

class Flow:
    def __init__(self, store: Store, session: dict, channel: str):
        self.st, self.s, self.channel = store, session, channel
        self.state = session["state"]
        self.say: list = []
        self.expect: dict = {"kind": "free", "timeout_ms": TIMEOUT_MS}
        self.terminal = False
        self.resumed_from = None

    @property
    def bid(self):
        return self.s["beneficiary_id"]

    # entry point ---------------------------------------------------------------
    def step(self, inp: Input) -> dict:
        at = self.state.get("at", "NEW")
        if inp.kind == "opened" and at != "NEW":
            self._repeat()                         # channel reconnected: say the current prompt again
        elif (inp.kind in ("audio", "text") and inp.nbest and at not in ("NEW", "DONE", "CLOSED")
              and extract.wants_repeat(inp.nbest)):
            self._repeat()                         # "फिर से बोलिए": same question, no try used up
        elif inp.kind == "dtmf" and HELP_KEY in inp.digits and self.bid and at not in ("DONE", "CLOSED"):
            self._help()
        else:
            if self._yes_no_state() and inp.kind in ("audio", "text") and inp.nbest and not self._yes_no(inp):
                if self._is_echo(inp):
                    return self._listen_again()
                handled, inp = self._ai_yes_no(inp)
                if handled:
                    return self._reply()
            getattr(self, "_" + at.lower())(inp)
        return self._reply()

    def _listen_again(self):
        """Nothing to say: we heard ourselves. Same state, same 'last said', no try used."""
        self.say = []
        self.state["last_said_keep"] = True
        return self._reply()

    # AI helper -----------------------------------------------------------------------
    def _yes_no_state(self):
        at = self.state.get("at")
        return at in YES_NO_STATES or (at == "FIELD" and self.state.get("mode") == "confirm")

    def _ai(self, inp, question_id, options, describe=None, open_kind=None):
        """Ask the AI, within the per-call budget. None = not asked / no help."""
        heard = inp.nbest or []
        words = extract.norm(heard[0]).split() if heard else []
        used = self.state.get("ai_used", 0)
        if len(words) < 2 or used >= AI_PER_CALL:          # noise, a lone word, or out of budget
            return None
        self.state["ai_used"] = used + 1
        return llm.understand(prompts.catalogue("hi").get(question_id, question_id), options, heard, describe,
                              open_kind, recommend.sectors() if open_kind == "trade" else None)

    def _ai_yes_no(self, inp):
        """Yes/no question, word list failed. -> (handled, input to pass on)."""
        at = self.state["at"]
        qid = YES_NO_STATES.get(at, "is_right")
        if at == "FIELD":                                  # a spoken correction is not a yes/no
            if _field(self.state["field"])["extract"](inp.nbest):
                return False, inp
        ai = self._ai(inp, qid, *YES_NO)
        if not ai:
            return False, inp
        if ai["intent"] == "answer":
            return False, Input("text", nbest=["हाँ" if ai["value"] == "yes" else "नहीं"])
        return self._ai_other(ai), inp

    def _ai_other(self, ai) -> bool:
        """Side question / help / repeat. True if handled (the turn is over)."""
        if ai["intent"] == "question" and self.state.get("asides", 0) < MAX_ASIDES:
            self.state["asides"] = self.state.get("asides", 0) + 1
            self.say = [{"kind": "tts", "text": ai["reply"]}]
            self._repeat()                                 # answer, then the same question again
            return True
        if ai["intent"] == "help":
            self._help()
            return True
        if ai["intent"] == "repeat":
            self._repeat()
            return True
        return False

    def _help(self):
        self.st.callback_request(self.bid, self.s["id"], self.state.get("at"))
        self.say = ["help_queued"]
        self._repeat()                                     # then carry on where they were

    def _is_echo(self, inp) -> bool:
        """Speakerphone: the caller's audio can carry our own last prompt back to us. If what was
        'heard' is mostly words we just said (and nothing else understood it), ignore it."""
        heard = extract.norm(inp.nbest[0]).split() if inp.nbest else []
        if len(heard) < 3:
            return False
        cat = prompts.catalogue("hi")
        said = set(extract.norm(" ".join(cat.get(i, i) for i in self.state.get("last_said", []))).split())
        return bool(said) and sum(w in said for w in heard) / len(heard) >= 0.7

    def _reply(self):
        st = self.state
        if not st.pop("last_said_keep", False):
            st["last_said"] = [x for x in self.say if isinstance(x, str)]   # for the echo check next turn
        return {"session_id": self.s["id"],
                "state": ":".join(filter(None, (st.get("at"), st.get("field"), st.get("mode")))),
                "resumed_from": self.resumed_from, "lang": self.state.get("lang", "hi"),
                "say": [x if isinstance(x, dict) else {"kind": "prerendered", "id": x} for x in self.say],
                "expect": self.expect, "turn_budget_ms": 1800, "terminal": self.terminal}

    def _go(self, at, **kw):
        keep = {k: self.state[k] for k in ("lang", "taught", "ai_used") if k in self.state}   # survive every step
        self.state = {"at": at, **kw, **keep}
        self.s["state"] = self.state

    # NEW / RESUME / CONSENT ------------------------------------------------------
    def _new(self, inp):
        if len(LANGS) > 1:
            self._go("LANG", tries=0)
            self.say = ["lang_select"]
            self.expect = {"kind": "enum", "dtmf_map": LANG_DTMF, "timeout_ms": TIMEOUT_MS}
            return
        self._begin()

    def _lang(self, inp):
        key = inp.digits[-1:] if inp.kind == "dtmf" else (extract.spoken_key(inp.nbest) or "")
        if key in LANG_DTMF or self.state["tries"] >= 1:        # second miss: default language
            self.state["lang"] = LANG_DTMF.get(key, LANGS[0])
            return self._begin()
        self.state["tries"] += 1
        self.say = ["lang_select"]
        self.expect = {"kind": "enum", "dtmf_map": LANG_DTMF, "timeout_ms": TIMEOUT_MS}

    def _begin(self):
        prev = self.st.resumable(self.s["phone_hash"])
        if prev and self.st.answers(prev["id"]):
            # same phone, unfinished interview: ask, don't assume (it may be someone else on it)
            self._go("RESUME", target=prev["id"], tries=0)
            self.say = ["resume_offer"]
            self.expect = {"kind": "enum", "options": ["yes", "no"], "dtmf_map": YES_NO_DTMF,
                           "timeout_ms": TIMEOUT_MS}
        else:
            self._start_new(["welcome", "consent"])

    def _start_new(self, say):
        self.s["beneficiary_id"] = self.st.new_beneficiary(self.s["phone_hash"])
        self._go("CONSENT", tries=0)
        self.say = say
        self.expect = {"kind": "enum", "options": ["yes", "no"], "dtmf_map": YES_NO_DTMF, "timeout_ms": TIMEOUT_MS}

    def _resume(self, inp):
        """'Continue the previous conversation?' 1/yes = continue, 2/no = start fresh."""
        ans = self._yes_no(inp)
        if ans == "yes":
            self.s["beneficiary_id"] = self.state["target"]
            self.say = ["resume_ok"]
            self.resumed_from = self._next_field(None) or "READBACK"
            return self._advance(None)
        if ans == "no" or self.state["tries"] >= 1:           # unclear twice: fresh start, never stuck
            return self._start_new(["new_start", "consent"])
        self.state["tries"] += 1
        self.say = ["nudge" if inp.kind == "timeout" else "reask", "resume_offer"]
        self.expect = {"kind": "enum", "options": ["yes", "no"], "dtmf_map": YES_NO_DTMF, "timeout_ms": TIMEOUT_MS}

    def _consent(self, inp):
        ans = self._yes_no(inp)
        if ans == "yes":
            self.st.set_beneficiary(self.bid, consent_state="GIVEN")
            self.st.consent(self.bid, "DTMF_YES" if inp.kind == "dtmf" else "SPOKEN_YES", self.channel)
            self.say = ["ack"]
            return self._advance(None)
        if ans == "no":
            return self._close("close_polite")
        self.state["tries"] += 1
        if self.state["tries"] >= 2:
            return self._close("close_polite")
        self.say = (["nudge"] if inp.kind == "timeout" else ["reask"]) + ["consent"]
        self.expect = {"kind": "enum", "options": ["yes", "no"], "dtmf_map": YES_NO_DTMF, "timeout_ms": TIMEOUT_MS}

    # fields -------------------------------------------------------------------------
    def _next_field(self, after):
        done = {k for k, a in self.st.answers(self.bid).items() if a["confirmed_at"]}
        start = FIELDS.index(after) + 1 if after else 0
        return next((f for f in FIELDS[start:] if f not in done), None)

    def _advance(self, after):
        """Move to the next unconfirmed field, or to the read-back when none is left."""
        if self.state.get("editing"):
            return self._readback_start()
        nxt = self._next_field(after)
        if nxt is None:
            return self._readback_start()
        self._ask(nxt)

    def _ask(self, field, editing=False):
        self._go("FIELD", field=field, mode="ask", tries=0, silence=0, cand=None, editing=editing)
        if not editing and field in PROGRESS:
            self.say.append(PROGRESS[field])               # "आधे सवाल हो गए…" / "बस आख़िरी सवाल"
        self.say.append(field)
        self.expect = {"kind": "free", "dtmf_map": _field(field)["dtmf"], "timeout_ms": TIMEOUT_MS}

    def _menu(self, prefix=()):
        st = self.state
        st["mode"] = "menu"
        self.say += [*prefix, f"{st['field']}_menu"]
        self.expect = {"kind": "enum", "dtmf_map": _field(st["field"])["dtmf"], "timeout_ms": TIMEOUT_MS}

    def _field(self, inp):
        st = self.state
        field, spec = st["field"], _field(st["field"])

        if st["mode"] == "confirm":
            return self._confirming(inp, field, spec)

        if inp.kind == "timeout":
            st["silence"] += 1
            if st["silence"] >= MAX_SILENCE:
                return self._defer()
            if st["mode"] == "menu":
                return self._menu(["nudge"])
            self.say = ["nudge", field]
            return

        if inp.kind == "dtmf":
            key = inp.digits[-1:]
            if key in spec["dtmf"]:
                return self._accept(_normalise(field, spec["dtmf"][key]), 1.0, "DTMF")
            st["tries"] += 1
            return self._defer() if st["tries"] >= MAX_ASK + MAX_MENU else self._menu()

        # speech (audio or text)
        if inp.nbest is None:                                  # no speech-to-text available
            return self._menu()
        if st["mode"] == "menu":                               # "नौ" said instead of pressing 9
            key = extract.spoken_key(inp.nbest)
            if key is not None:
                return self._field(Input("dtmf", digits=key))
        got = spec["extract"](inp.nbest) if inp.nbest else None
        if (got is None and st["mode"] == "ask" and inp.nbest and extract.leftover_confirmation(inp.nbest)):
            self.say = []                                  # "हाँ, सही है" said twice to the last read-back:
            self.state["last_said_keep"] = True            # not an answer to this question, keep listening
            return
        if (got is None and st["mode"] == "ask" and inp.nbest and extract.yes_no(inp.nbest)
                and len(extract.norm(inp.nbest[0]).split()) <= 3):
            # a bare "हाँ"/"नहीं" to an open question ("what do you want to learn?") is not a wrong
            # answer, it means "I didn't catch the question": offer the choices, no scolding, no try used
            return self._menu()
        if got is None and inp.nbest and self._is_echo(inp):
            self.say = []                                  # our own prompt came back: listen again
            self.state["last_said_keep"] = True
            return
        if got is None and inp.nbest:
            ai = self._ai(inp, field, *ai_options(field), open_kind=OPEN_KIND.get(field))
            if ai and ai["intent"] == "answer":
                opened = ai["value"] in ("PLACE", "NEW")
                value = open_value(field, ai) if opened else from_ai(field, ai["value"])
                if value is not None:
                    got = (value, 0.75, "LLM")
            elif ai and self._ai_other(ai):
                return
        if got:
            value, conf, method = got
            if field == "q5" and value == "none" and extract.yes_no(inp.nbest):
                # "कोई परेशानी है?" → "नहीं" is already a direct answer; reading it back
                # ("…नहीं, सही है?" → "नहीं") turned into a double negative on real calls
                return self._accept(value, conf, method)
            cand = {"value": _normalise(field, value, inp.nbest), "conf": conf, "method": method}
            if field == "q2" and value not in ("NONE", "OTHER"):
                yrs = extract.years(inp.nbest)                 # "बारह साल से बुनाई" answers two fields
                if yrs:
                    cand["years"] = yrs[0]
            return self._confirm(cand)
        st["tries"] += 1
        if st["tries"] >= MAX_ASK + MAX_MENU:
            return self._defer()
        if st["tries"] >= MAX_ASK or st["mode"] == "menu":
            return self._menu(["reask_gentle"])
        self.say = ["reask", field]

    def _confirm(self, cand):
        st = self.state
        st.update(mode="confirm", cand=cand)
        clips = _field(st["field"])["clips"](cand["value"])
        if "years" in cand:
            clips = clips + [f"v-years-{min(cand['years'], 40)}"]
        self.say += ["you_said", *clips, "is_right_short" if st.get("taught") else "is_right"]
        st["taught"] = True                            # the "हाँ या नहीं, या 1 या 2" line once is enough
        self.expect = {"kind": "enum", "options": ["yes", "no"], "dtmf_map": YES_NO_DTMF, "timeout_ms": TIMEOUT_MS}

    def _confirming(self, inp, field, spec):
        st = self.state
        ans = self._yes_no(inp)
        if ans != "yes" and inp.kind in ("audio", "text") and inp.nbest:
            got = spec["extract"](inp.nbest)                   # "नहीं, आठवीं" — a correction, not just a no
            if got and _normalise(field, got[0], inp.nbest) != st["cand"]["value"]:
                return self._confirm({"value": _normalise(field, got[0], inp.nbest),
                                      "conf": got[1], "method": got[2]})
        if ans == "yes":
            c = st["cand"]
            if "years" in c:
                self.st.put_answer(self.bid, "q2_years", c["years"], c["conf"], c["method"], self.s["id"])
            return self._accept(c["value"], c["conf"], c["method"])
        if ans is None and inp.kind != "timeout":
            self.say = ["is_right"]
            return
        st["tries"] += 1                                       # "no", or silence while confirming
        st.update(mode="ask", cand=None)
        if st["tries"] >= MAX_ASK + MAX_MENU:
            return self._defer()
        if st["tries"] >= MAX_ASK:
            return self._menu(["reask_gentle"])
        self.say = ["reask", field]
        self.expect = {"kind": "free", "dtmf_map": spec["dtmf"], "timeout_ms": TIMEOUT_MS}

    def _accept(self, value, conf, method):
        field = self.state["field"]
        self.st.put_answer(self.bid, field, value, conf, method, self.s["id"])
        if field == "q0":
            where = value.get("id") if value.get("id") and value["id"] != "OTHER" else \
                ", ".join(x for x in (value.get("district"), value.get("state")) if x) or "OTHER"
            self.st.set_beneficiary(self.bid, district=where)
        if field == "q2" and value in ("NONE", "OTHER"):
            self.st.put_answer(self.bid, "q2_years", 0, 1.0, "IMPLIED", self.s["id"])
        self.say.append(self._after_answer(field, value))
        if field == "q5" and value == "cognitive":
            self._go("GUARDIAN", tries=0, editing=self.state.get("editing"))
            self.say.append("q5_guardian")
            self.expect = {"kind": "enum", "options": ["yes", "no"], "dtmf_map": YES_NO_DTMF, "timeout_ms": TIMEOUT_MS}
            return
        self._advance(field)

    def _after_answer(self, field, value):
        """What a person would say back: a varied thanks, or a warm line where the answer calls
        for one. Only true statements (NSQF levels 1-2 need no schooling; experience counts)."""
        if field == "q1" and isinstance(value, dict) and not value.get("class") and not value.get("literate"):
            return "emp_no_school"
        if field == "q2_years" and isinstance(value, int) and value >= 5:
            return "emp_experience"
        if field == "q3" and isinstance(value, dict) and value.get("concept") in ("NONE", "LABOUR"):
            return "emp_no_work"
        if field == "q5" and value in ("distance", "physical", "care_duty", "cognitive"):
            return "emp_difficulty"
        return ACKS[FIELDS.index(field) % len(ACKS)]

    def _defer(self):
        field = self.state["field"]
        self.st.put_answer(self.bid, field, None, 0.0, "DEFER", self.s["id"], confirmed=False)
        self.say.append("deferred")
        self._advance(field)

    def _guardian(self, inp):
        ans = self._yes_no(inp)
        if ans == "yes":
            self.st.set_beneficiary(self.bid, consent_state="GUARDIAN_GIVEN")
            self.st.consent(self.bid, "GUARDIAN_YES", self.channel)
            self.say = ["ack"]
            return self._advance("q5")
        if ans == "no" or self.state["tries"] >= 1:
            self.st.set_beneficiary(self.bid, consent_state="GUARDIAN_PENDING")
            return self._close("close_polite", completed=False)
        self.state["tries"] += 1
        self.say = ["q5_guardian"]
        self.expect = {"kind": "enum", "options": ["yes", "no"], "dtmf_map": YES_NO_DTMF, "timeout_ms": TIMEOUT_MS}

    # read-back, edit, result -----------------------------------------------------------
    def _readback_start(self):
        answers = self.st.answers(self.bid)
        self._go("READBACK", silence=0)
        self.say.append("readback_intro")
        for f in READBACK:
            a = answers.get(f)
            self.say.append(f"label_{f}")
            if a and a["confirmed_at"]:
                self.say += _field(f)["clips"](a["value"])
                if f == "q2" and answers.get("q2_years", {}).get("confirmed_at") and a["value"] not in ("NONE", "OTHER"):
                    self.say.append(f"v-years-{min(answers['q2_years']['value'], 40)}")
            else:
                self.say.append("v-deferred")
        self.say.append("readback_confirm")
        self.expect = {"kind": "enum", "options": ["yes", "no"], "dtmf_map": YES_NO_DTMF, "timeout_ms": TIMEOUT_MS}

    def _readback(self, inp):
        ans = self._yes_no(inp)
        if ans == "yes":
            return self._recommend()
        if ans == "no":
            self._go("PICK", tries=0)
            self.say = ["readback_pick"]
            self.expect = {"kind": "enum", "dtmf_map": {str(i): f"q{i}" for i in range(1, 8)},
                           "timeout_ms": TIMEOUT_MS}
            return
        self.state["silence"] += 1
        if self.state["silence"] >= MAX_SILENCE:
            return self._recommend()                           # they heard it twice; go on
        self.say = ["nudge" if inp.kind == "timeout" else "reask", "readback_confirm"]
        self.expect = {"kind": "enum", "options": ["yes", "no"], "dtmf_map": YES_NO_DTMF, "timeout_ms": TIMEOUT_MS}

    def _pick(self, inp):
        key = inp.digits[-1:] if inp.kind == "dtmf" else (extract.spoken_key(inp.nbest) or "")
        if key in {str(i) for i in range(1, 8)}:
            return self._ask(f"q{key}", editing=True)
        self.state["tries"] += 1
        if self.state["tries"] >= 2:
            return self._readback_start()
        self.say = ["readback_pick"]
        self.expect = {"kind": "enum", "dtmf_map": {str(i): f"q{i}" for i in range(1, 8)}, "timeout_ms": TIMEOUT_MS}

    def _recommend(self):
        prof = profile(self.st.answers(self.bid))
        result = recommend.recommend(prof)
        ranked = [{"code": x.code, "title": x.title, "level": x.level_label, "bucket": x.bucket,
                   "gap_years": x.gap_years, "gap_class": x.gap_class, "score": x.score,
                   "factors": x.factors}
                  for x in result["eligible"] + ([result["near_miss"]] if result["near_miss"] else [])]
        self.st.save_recommendation(self.bid, result, ranked)
        self.say += ["recommend_intro", {"kind": "tts", "text": recommend.spoken(result)}, "goodbye"]
        self._close(None)

    def _close(self, prompt, completed=True):
        self._go("DONE" if completed else "CLOSED")
        self.s["status"] = "COMPLETED" if completed else "RESUMABLE"
        if prompt:
            self.say.append(prompt)
        self.terminal = True
        self.expect = {"kind": "none"}

    def _done(self, inp):
        self.terminal = True
        self.expect = {"kind": "none"}

    _closed = _done

    def _repeat(self):
        """Say the current prompt again (after a reconnect or the help key)."""
        at, st = self.state.get("at"), self.state
        if at == "FIELD":
            self.say.append(st["field"] if st["mode"] == "ask" else
                            f"{st['field']}_menu" if st["mode"] == "menu" else
                            "is_right_short" if st.get("taught") else "is_right")
        elif at in ("CONSENT", "RESUME", "LANG", "PICK", "GUARDIAN"):
            self.say.append({"CONSENT": "consent", "RESUME": "resume_offer",
                             "LANG": "lang_select", "PICK": "readback_pick",
                             "GUARDIAN": "q5_guardian"}[at])
        elif at == "READBACK":
            self._readback_start()
        else:
            self._done(None)

    # helpers --------------------------------------------------------------------------
    @staticmethod
    def _yes_no(inp):
        if inp.kind == "dtmf":
            return YES_NO_DTMF.get(inp.digits[-1:])
        if inp.kind in ("audio", "text") and inp.nbest:
            got = extract.yes_no(inp.nbest)
            return got[0] if got else None
        return None


def profile(answers: dict) -> recommend.Profile:
    """Confirmed answers -> the recommender's input. Unconfirmed = unknown."""
    v = {k: a["value"] for k, a in answers.items() if a["confirmed_at"]}
    edu = v.get("q1") or {"class": 0}
    return recommend.Profile(
        school_class=edu.get("class", 0),
        literate=bool(edu.get("literate") or edu.get("class", 0) >= 1),
        family_trade=v.get("q2") if v.get("q2") not in (None, "NONE", "OTHER") else None,
        family_years=v.get("q2_years") or 0,
        current_trade=(v.get("q3") or {}).get("concept"),
        interests=v.get("q4") or [],
        mobility=v.get("q5"),
        employment_pref=v.get("q6"),
        local_demand=v.get("q7") or [],
    )
