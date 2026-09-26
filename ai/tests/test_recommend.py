import datetime as dt

from engine import recommend
from engine.eligibility import Person, check, max_level
from engine.recommend import Profile

TODAY = dt.date(2026, 9, 26)


def test_nsqf_table():
    assert check(Person(0, False, 0), 2).bucket == "ELIGIBLE"          # L1-2: no schooling needed
    assert check(Person(0, False, 0), 2.5).bucket == "INELIGIBLE"
    assert check(Person(0, True, 5), 2.5).bucket == "ELIGIBLE"         # literate + 5 yrs
    assert check(Person(5, False, 5), 3).bucket == "ELIGIBLE"          # 5th + 5 yrs experience
    v = check(Person(5, False, 3), 3)
    assert (v.bucket, v.gap_years) == ("NEAR_MISS", 2)                 # the exact gap
    v = check(Person(9, False, 0), 3)
    assert (v.bucket, v.gap_class) == ("NEAR_MISS", 1)
    assert check(Person(12, False, 0), 4.5).bucket == "INELIGIBLE"     # above our ceiling
    assert max_level(Person(10, False, 0)) == 3


def _rows():
    return {r["code"]: r for r in recommend.register()["rows"]}


def test_only_real_valid_eligible_courses():
    rows = _rows()
    p = Profile(8, True, "TAILORING", 6, "TAILORING", ["TAILORING", "BEAUTY"], "care_duty", "self", ["TAILORING"])
    r = recommend.recommend(p, today=TODAY)
    assert r["eligible"]
    for x in r["eligible"]:
        q = rows[x.code]                                                # code comes from NQR, not invented
        assert q["title"] == x.title
        assert q["valid_till"] >= TODAY.isoformat() and q["level"] <= 4
        assert x.bucket == "ELIGIBLE"
    assert any("tailor" in x.title.lower() for x in r["eligible"])
    assert len({x.title for x in r["eligible"]}) == len(r["eligible"])
    assert r["nqr_snapshot_sha"] == recommend.register()["sha256"]


def test_experience_unlocks_levels_only_in_its_own_trade():
    weaver = Profile(5, True, "WEAVING", 6, None, ["WEAVING"], "none", "wage", [])
    levels = [x.level for x in recommend.recommend(weaver, today=TODAY)["eligible"]]
    assert levels and max(levels) <= 3                                  # 5th + 5 yrs -> up to L3


def test_no_signal_no_guess():
    r = recommend.recommend(Profile(), today=TODAY)
    assert r["eligible"] == [] and r["near_miss"] is None
    assert "संपर्क" in recommend.spoken(r)


def test_spoken_mentions_asset_grant_only_for_self_employment():
    p = Profile(8, True, "TAILORING", 6, None, ["TAILORING"], None, "self", [])
    assert "पचास हज़ार" in recommend.spoken(recommend.recommend(p, today=TODAY))
    p.employment_pref = "wage"
    assert "पचास हज़ार" not in recommend.spoken(recommend.recommend(p, today=TODAY))
