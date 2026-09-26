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
    c = concepts().get(concept_id)
    if not c:
        return 0.0
    head = " ".join(filter(None, (q["title"], q["occupation"]))).lower()
    sec = q["sector"] in c["sectors"]
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


def reason(x: Pick, p: Profile) -> str:
    f = x.factors
    if f.get("skill_transfer", 0) >= 0.6:
        return "यह आपके परिवार या अभी के काम से जुड़ा है"
    if f.get("aspiration", 0) >= 0.6:
        return "यह वही काम है जो आप सीखना चाहते हैं"
    if f.get("disability_sector"):
        return "यह कोर्स दिव्यांग साथियों के लिए बनाया गया है"
    if f.get("local_demand", 0) >= 0.6:
        return "आपके इलाके में इस काम की माँग है"
    return "यह आपकी पढ़ाई और अनुभव के हिसाब से सही है"


def spoken(result: dict) -> str:
    """The recommendation tail, as one text for TTS. Titles stay as the register spells them."""
    picks, near = result["eligible"], result["near_miss"]
    if not picks and not near:
        return ("अभी आपके जवाबों से मेल खाता कोई कोर्स नहीं मिला। "
                "हमारे ज़िले के साथी आपसे संपर्क करेंगे।")
    ordinal = ["पहला", "दूसरा", "तीसरा"]
    parts = []
    if picks:
        parts.append(f"आपके लिए {len(picks)} कोर्स हैं।")
    for i, x in enumerate(picks):
        m = months(x.hours)
        dur = f", करीब {m} महीने का" if m else ""
        parts.append(f"{ordinal[i]}: {x.title}, लेवल {x.level:g}{dur}। {x.reason}।")
    if near:
        gap = (f"{near.gap_years} साल और अनुभव" if near.gap_years
               else f"एक और कक्षा की पढ़ाई" if near.gap_class else "थोड़ी और तैयारी")
        parts.append(f"{near.title} के लिए आपको {gap} चाहिए।")
    parts.append("हर कोर्स में पैसों के हिसाब किताब की ट्रेनिंग भी मिलती है।")
    if result["self_employment"]:
        parts.append("अपना काम शुरू करने के लिए पीएम अजय से, बैंक लोन के साथ, "
                     "पचास हज़ार रुपये तक की मदद मिल सकती है।")
    return " ".join(parts)
