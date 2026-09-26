"""Why these courses: the reasoning the problem statement asks for (docs/PROBLEM-STATEMENT.md R4).

From the confirmed answers, the problems the caller shared and the ranked result, work out
the four things PS 26097 names, plus the "why" in plain words:

  pathway        build on the family skill / grow the current work / a new skill
  skill_gaps     what stands between the caller and the courses they want
  local_fit      does what they want to learn match what their area needs?
  constraints    mobility, care duty, problems shared on the call

Rules, not a model: every line can be traced to an answer, which is what a district officer
(and the jury) will ask for. The spoken lines are templates we wrote; the AI writes none of them.
"""

from .prompts import pack
from .recommend import PWD_SECTOR, Profile, concepts

REAL = lambda t: t not in (None, "NONE", "OTHER", "LABOUR")      # noqa: E731  a trade, not "nothing"


def same(a, b) -> bool:
    """Same trade? Known ids compare by id, jobs the caller named by their label."""
    if not (REAL(a) and REAL(b)):
        return False
    key = lambda t: t.get("label") if isinstance(t, dict) else t          # noqa: E731
    return key(a) == key(b)


def _name(t) -> str:
    if isinstance(t, dict):
        return t.get("label", "")
    c = concepts().get(t)
    return c["hi"] if c else str(t)


def assess(p: Profile, result: dict, concerns: list | None = None, lang: str = "hi") -> dict:
    picks = result["eligible"]
    near = result["near_miss"]
    concerns = concerns or []
    top = picks[0] if picks else None

    transfer = bool(top) and top.factors.get("skill_transfer", 0) >= 0.6
    # ponytail: skill_transfer is one number for family + current work; when both are real and
    # different, "family" wins. Split the factor if officers need the difference.
    pathway = ("build_on_family_skill" if transfer and REAL(p.family_trade) else
               "grow_current_work" if transfer and REAL(p.current_trade) else "new_skill")

    gaps = []
    if not p.literate and not p.school_class:
        gaps.append("functional_literacy")
    if near and near.gap_class:
        gaps.append(f"schooling:+{near.gap_class} class for {near.code}")
    if near and near.gap_years:
        gaps.append(f"experience:+{near.gap_years} years for {near.code}")
    wanted = [i for i in p.interests if REAL(i)]
    if wanted and not any(x.factors.get("aspiration", 0) >= 0.6 for x in picks):
        gaps += [f"no_eligible_course_yet:{_name(i)}" for i in wanted]

    demand = [d for d in p.local_demand if REAL(d)]
    if wanted and demand:
        local_fit = "match" if any(same(i, d) for i in wanted for d in demand) else "differs"
    else:
        local_fit = "unknown"

    constraints = [p.mobility] if p.mobility and p.mobility != "none" else []
    constraints += [f"shared:{c}" for c in concerns]

    why = []                                               # at most two, so the call stays short
    if picks:
        if pathway in ("build_on_family_skill", "grow_current_work"):
            why.append(pathway)
        if local_fit == "match":
            why.append("local_match")
        elif local_fit == "differs" and any(x.factors.get("local_demand", 0) >= 0.6 for x in picks):
            why.append("local_differs")
        if p.mobility in ("distance", "care_duty") or {"travel", "family"} & set(concerns):
            why.append("short")
        if p.mobility == "physical" and any(x.sector == PWD_SECTOR for x in picks):
            why.append("pwd")
    why = why[:2]
    lines = [pack(lang)["why"][k] for k in why]

    return {"pathway": pathway, "employment": p.employment_pref, "skill_gaps": gaps,
            "local_fit": local_fit, "constraints": constraints, "concerns": concerns,
            "picks": [{"code": x.code, "reason": x.reason} for x in picks], "why_keys": why, "why": lines}


if __name__ == "__main__":                                  # self-check on the real register
    from .recommend import recommend
    p = Profile(school_class=8, literate=True, family_trade="TAILORING", family_years=12,
                interests=["TAILORING"], local_demand=["TAILORING"], mobility="care_duty",
                employment_pref="self")
    a = assess(p, recommend(p), ["money"])
    assert a["pathway"] == "build_on_family_skill" and a["local_fit"] == "match", a
    assert len(a["why"]) == 2 and "shared:money" in a["constraints"], a
    q = Profile(interests=["TAILORING"], local_demand=["DAIRY"])
    b = assess(q, recommend(q))
    assert b["pathway"] == "new_skill" and "functional_literacy" in b["skill_gaps"] and b["local_fit"] == "differs", b
    print("ok", a["why"], b["skill_gaps"])
