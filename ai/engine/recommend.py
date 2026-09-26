"""Gate, then rank (spec §2.4). Never rank, then gate.

  0  NQR register, valid today, NSQF level <= 4
  1  eligibility gate per qualification: ELIGIBLE / NEAR_MISS / out
  2  weighted score from the confirmed answers (weights in data/weights.json)
  3  top 3 eligible (max 2 per sector, no duplicate titles) + the best near-miss
  4  one plain-language reason per pick, from the same scored factors
"""

import datetime as dt
import json
import math
import re
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path

from . import eligibility
from .extract import lexicon

DATA = Path(__file__).resolve().parent.parent / "data"
PWD_SECTOR = "Persons with Disability"


@lru_cache(maxsize=1)
def register() -> dict:
    return json.loads((DATA / "nqr.json").read_text(encoding="utf-8"))


@lru_cache(maxsize=1)
def weights() -> dict:
    return json.loads((DATA / "weights.json").read_text(encoding="utf-8"))


@lru_cache(maxsize=1)
def sectors() -> list:
    """Every NQR sector name, for mapping a job the caller named in their own words."""
    return sorted({r["sector"] for r in register()["rows"] if r["sector"]})


@lru_cache(maxsize=1)
def concepts() -> dict:
    return {c["id"]: c for c in lexicon()["trades"]}


@dataclass
class Profile:
    """Confirmed answers. Missing (deferred) fields are None and simply score nothing."""
    school_class: int = 0
    literate: bool = False
    family_trade: str | None = None
    family_years: int = 0
    current_trade: str | None = None
    interests: list = field(default_factory=list)
    mobility: str | None = None
    employment_pref: str | None = None
    local_demand: list = field(default_factory=list)


@dataclass
class Pick:
    code: str
    title: str
    sector: str
    level: float
    level_label: str
    hours: int | None
    bucket: str
    gap_years: int = 0
    gap_class: int = 0
    score: float = 0.0
    factors: dict = field(default_factory=dict)
    reason: str = ""


def _text(q):
    return " ".join(filter(None, (q["title"], q["occupation"], q["description"]))).lower()


def _kw(words, text):
    # word start: "weav" hits "weaving", "hair" misses "chair"
    return any(re.search(r"\b" + re.escape(k), text) for k in words)


def _hit(concept_id, q, text=None):
    """How strongly a course is about a trade. Title/occupation beat description:
    a fitness course 'tailored for athletes' is not a tailoring course."""
    c = concept_id if isinstance(concept_id, dict) else concepts().get(concept_id)   # custom job: its own sectors
    if not c:
        return 0.0
    head = " ".join(filter(None, (q["title"], q["occupation"]))).lower()
    sec = q["sector"] in c["sectors"]
    if c.get("id") == "CUSTOM":
        # the AI's words ("video editing") must still find "Video Editor": match 4-letter stems
        c = dict(c, keywords=sorted({w[:4] for k in c["keywords"] for w in k.split() if len(w) >= 4}))
    if _kw(c["keywords"], head):
        return 1.0 if sec else 0.8
    if sec:
        return 0.6 if _kw(c["keywords"], (q["description"] or "").lower()) else 0.3
    return 0.0


def _entrepreneurial(text):
    return _kw(weights()["entrepreneurial_words"], text)


def _experience_counts(p: Profile, q, text) -> int:
    return p.family_years if p.family_trade and _hit(p.family_trade, q, text) >= 0.6 else 0


def score(p: Profile, q) -> tuple[float, dict]:
    w, text = weights(), _text(q)
    f = {
        "skill_transfer": max((_hit(c, q, text) for c in (p.family_trade, p.current_trade) if c), default=0),
        "aspiration": max((_hit(c, q, text) for c in p.interests), default=0),
        "local_demand": max((_hit(c, q, text) for c in p.local_demand), default=0),
        "disability_sector": 1.0 if p.mobility == "physical" and q["sector"] == PWD_SECTOR else 0.0,
    }
    if not any(f.values()):
        return 0.0, f                                   # nothing links this course to the person
    ent = _entrepreneurial(text)
    f["employment_pref"] = {"self": 1.0 if ent else 0.3, "wage": 0.0 if ent else 0.7}.get(p.employment_pref, 0.5)
    hours = q["max_hours"] or 400
    f["short_duration"] = (1 - min(hours, 600) / 600) if p.mobility in ("distance", "care_duty") else 0.5
    f["level_fit"] = (q["level"] or 0) / 4
    return round(sum(w[k] * v for k, v in f.items()), 4), f


def recommend(p: Profile, today: dt.date | None = None, n: int = 3) -> dict:
    today = (today or dt.date.today()).isoformat()
    w = weights()
    elig_cache = {}
    eligible, near = [], []
    for q in register()["rows"]:
        if not (q["valid_till"] and q["valid_till"] >= today and q["level"]
                and q["level"] <= eligibility.table()["max_level"] and q["code"] and q["title"]):
            continue
        text = _text(q)
        exp = _experience_counts(p, q, text)
        key = (q["level"], exp)
        if key not in elig_cache:
            elig_cache[key] = eligibility.check(
                eligibility.Person(p.school_class, p.literate, exp), q["level"])
        v = elig_cache[key]
        if v.bucket == "INELIGIBLE":
            continue
        s, f = score(p, q)
        if s <= 0:
            continue
        pick = Pick(q["code"], q["title"], q["sector"] or "", q["level"], q["level_label"],
                    q["max_hours"], v.bucket, v.gap_years, v.gap_class, s, f)
        if v.bucket == "ELIGIBLE":
            eligible.append(pick)
        else:
            pick.score = round(s * w["near_miss_factor"], 4)
            near.append(pick)

    top = _diverse(sorted(eligible, key=lambda x: (-x.score, x.hours or 9999)), n, w["max_per_sector"])
    best_near = next(iter(sorted(near, key=lambda x: -x.score)), None)
    if best_near and top and best_near.score <= top[-1].score * 0.9 and len(top) == n:
        best_near = None                                # only worth saying if it beats what we have
    for x in top + ([best_near] if best_near else []):
        x.reason = reason(x, p)
    return {
        "eligible": top,
        "near_miss": best_near,
        "self_employment": p.employment_pref == "self",
        "weights_version": w["version"],
        "nqr_snapshot_sha": register()["sha256"],
    }


def _title_key(t):
    return re.sub(r"[^a-z]", "", t.lower())


def _diverse(picks, n, per_sector):
    out, seen, sectors = [], set(), {}
    for x in picks:
        k = _title_key(x.title)
        if k in seen or sectors.get(x.sector, 0) >= per_sector:
            continue
        seen.add(k)
        sectors[x.sector] = sectors.get(x.sector, 0) + 1
        out.append(x)
        if len(out) == n:
            break
    return out


# --- spoken explanation (Hindi) -----------------------------------------------

def months(hours):
    """Notional hours -> rough months at ~6 h a day, 22 days a month."""
    return max(1, math.ceil((hours or 0) / 132)) if hours else None


def reason_key(x: Pick) -> str:
    f = x.factors
    if f.get("skill_transfer", 0) >= 0.6:
        return "skill_transfer"
    if f.get("aspiration", 0) >= 0.6:
        return "aspiration"
    if f.get("disability_sector"):
        return "disability_sector"
    if f.get("local_demand", 0) >= 0.6:
        return "local_demand"
    return "fit"


def reason(x: Pick, p: Profile, lang: str = "hi") -> str:
    from .prompts import pack
    return pack(lang)["reasons"][reason_key(x)]


def _level(level: float, lang: str) -> str:
    """NSQF level as the voice says it: 3 -> "3" / "তিন" / "ତିନି", 2.5 -> "आड़ाई"-style words."""
    from .prompts import number, pack
    halves = pack(lang)["spoken"].get("halves", {})
    if level != int(level):
        return halves.get(f"{level:g}", f"{level:g}")
    return number(int(level), lang)


def spoken(result: dict, why: list | None = None, lang: str = "hi") -> str:
    """The recommendation tail, as one text for TTS, in the call's language. Titles stay as the
    register spells them (English). `why`: the overall reasoning lines (reasoning.assess)."""
    from .prompts import number, pack
    t = pack(lang)["spoken"]
    picks, near = result["eligible"], result["near_miss"]
    if not picks and not near:
        return t["none"]
    parts = []
    if picks:
        parts.append(t["count"].format(n=number(len(picks), lang)))
        parts += why or []
    for i, x in enumerate(picks):
        m = months(x.hours)
        dur = t["duration"].format(m=number(m, lang)) if m else ""
        parts.append(t["item"].format(ord=t["ordinals"][i], title=x.title, level=_level(x.level, lang), dur=dur,
                                      reason=pack(lang)["reasons"][reason_key(x)]))
    if near:
        gap = (t["gap_years"].format(n=number(near.gap_years, lang)) if near.gap_years
               else t["gap_class"] if near.gap_class else t["gap_other"])
        parts.append(t["near"].format(title=near.title, gap=gap))
    parts.append(t["finance"])
    if result["self_employment"]:
        parts.append(t["self"])
    return " ".join(parts)
