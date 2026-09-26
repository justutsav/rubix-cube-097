"""NSQF eligibility: a hard gate before any ranking, never a score (decisions.md).

Returns one of three buckets for a person against an NSQF level:
  ELIGIBLE  |  NEAR_MISS with the exact gap  |  INELIGIBLE
"""

import json
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

PATH = Path(__file__).resolve().parent.parent / "data" / "nsqf_entry.json"
NEAR_MISS_MAX_EXP_GAP = 2          # "two more years of experience" is still a pathway


@lru_cache(maxsize=1)
def table() -> dict:
    return json.loads(PATH.read_text(encoding="utf-8"))


@dataclass
class Person:
    school_class: int = 0          # years of schooling (Q1)
    literate: bool = False         # reads and writes without schooling (Q1)
    exp_years: int = 0             # relevant experience (Q2 years), 0 if not relevant


@dataclass
class Verdict:
    bucket: str                    # ELIGIBLE | NEAR_MISS | INELIGIBLE
    gap_years: int = 0             # NEAR_MISS: more years of experience needed
    gap_class: int = 0             # NEAR_MISS: more classes of schooling needed


def _rules(level: float):
    t = table()
    if level is None or level > t["max_level"]:
        return None
    # snap to the table's rows: 1.5 -> "2", 2.5 -> "2.5", 3.5 -> "3.5"
    keys = sorted(t["levels"], key=float)
    key = next((k for k in keys if float(k) >= level), None)
    return t["levels"][key] if key else None


def check(p: Person, level: float) -> Verdict:
    rules = _rules(level)
    if rules is None:
        return Verdict("INELIGIBLE")
    best = None
    for r in rules:
        school_ok = p.school_class >= r.get("class", 0) and (not r.get("literate") or p.literate
                                                              or p.school_class >= 1)
        if school_ok and p.exp_years >= r["exp"]:
            return Verdict("ELIGIBLE")
        if school_ok:
            gap = Verdict("NEAR_MISS", gap_years=r["exp"] - p.exp_years)
        elif r["exp"] == 0 and r.get("class", 0) - p.school_class == 1:
            gap = Verdict("NEAR_MISS", gap_class=1)
        else:
            continue
        if gap.gap_years <= NEAR_MISS_MAX_EXP_GAP and (
                best is None or (gap.gap_years + gap.gap_class) < (best.gap_years + best.gap_class)):
            best = gap
    return best or Verdict("INELIGIBLE")


def max_level(p: Person) -> float:
    """Highest NSQF level this person can enrol in today."""
    lv = [float(k) for k in table()["levels"]]
    ok = [l for l in lv if check(p, l).bucket == "ELIGIBLE"]
    return max(ok) if ok else 0.0
