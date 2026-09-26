"""The interview: a fixed state machine (spec §2.2). Not an agent (decisions.md).

  NEW ─▶ RESUME ("continue the previous conversation?" — same phone, unfinished) ─┐
   └──▶ CONSENT ─▶ q0 district ─▶ q1 … q7 ─▶ READBACK ─▶ RECOMMEND ─▶ DONE
                               (q2 ─▶ q2_years;  q5 cognitive ─▶ GUARDIAN)

Every field runs the same sub-machine:
  ask ──answer──▶ confirm ──yes──▶ next field
   │  no match ×2 ──▶ menu (keypad) ──no match ×2 / silence ×2──▶ DEFER (skip, resumable)
Keypad answers need no confirmation: they are exact. Speech is always read back.
The AI helper (llm.py) only proposes a value when the word list finds nothing;
the caller still confirms it.
"""

import os
from dataclasses import dataclass

from . import extract, llm, recommend
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
    return f"v-trade-{v.lower()}"


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
                   clips=lambda v: [f"v-dist-{v.lower()}"]),
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


def _normalise(field, value, nbest=None):
    """Shape a raw extracted/keyed value into what is stored."""
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
            self.st.callback_request(self.bid, self.s["id"], at)
            self.say = ["help_queued"]
            self._repeat()                         # then carry on where they were
        else:
            getattr(self, "_" + at.lower())(inp)
        return self._reply()

    def _reply(self):
        st = self.state
        return {"session_id": self.s["id"],
                "state": ":".join(filter(None, (st.get("at"), st.get("field"), st.get("mode")))),
                "resumed_from": self.resumed_from, "lang": self.state.get("lang", "hi"),
                "say": [x if isinstance(x, dict) else {"kind": "prerendered", "id": x} for x in self.say],
                "expect": self.expect, "turn_budget_ms": 1800, "terminal": self.terminal}

    def _go(self, at, **kw):
        self.state = {"at": at, **kw, "lang": self.state.get("lang", "hi")}   # language survives every step
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
        key = inp.digits[-1:] if inp.kind == "dtmf" else ""
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
        got = spec["extract"](inp.nbest) if inp.nbest else None
        if got is None and inp.nbest:
            got = llm.classify(field, inp.nbest)
        if (got is None and st["mode"] == "ask" and inp.nbest and extract.yes_no(inp.nbest)
                and len(extract.norm(inp.nbest[0]).split()) <= 3):
            # a bare "हाँ"/"नहीं" to an open question ("what do you want to learn?") is not a wrong
            # answer, it means "I didn't catch the question": offer the choices, no scolding, no try used
            return self._menu()
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
            return self._menu(["reask"])
        self.say = ["reask", field]

    def _confirm(self, cand):
        st = self.state
        st.update(mode="confirm", cand=cand)
        clips = _field(st["field"])["clips"](cand["value"])
        if "years" in cand:
            clips = clips + [f"v-years-{min(cand['years'], 40)}"]
        self.say += ["you_said", *clips, "is_right"]
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
            return self._menu(["reask"])
        self.say = ["reask", field]
        self.expect = {"kind": "free", "dtmf_map": spec["dtmf"], "timeout_ms": TIMEOUT_MS}

    def _accept(self, value, conf, method):
        field = self.state["field"]
        self.st.put_answer(self.bid, field, value, conf, method, self.s["id"])
        if field == "q0":
            self.st.set_beneficiary(self.bid, district=value)
        if field == "q2" and value in ("NONE", "OTHER"):
            self.st.put_answer(self.bid, "q2_years", 0, 1.0, "IMPLIED", self.s["id"])
        self.say.append("ack")
        if field == "q5" and value == "cognitive":
            self._go("GUARDIAN", tries=0, editing=self.state.get("editing"))
            self.say.append("q5_guardian")
            self.expect = {"kind": "enum", "options": ["yes", "no"], "dtmf_map": YES_NO_DTMF, "timeout_ms": TIMEOUT_MS}
            return
        self._advance(field)

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
        key = inp.digits[-1:] if inp.kind == "dtmf" else ""
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
                            f"{st['field']}_menu" if st["mode"] == "menu" else "is_right")
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
