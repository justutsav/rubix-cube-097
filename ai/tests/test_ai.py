"""The AI helper, with Sarvam replaced by a script: when it is asked, what it may do, the cap."""

import json

import pytest

from conftest import Caller
from engine import flow, llm
from engine.server import STORE
from test_flow import consent


@pytest.fixture
def ai(monkeypatch):
    """Fake AI: returns the next scripted reply and records every question it was asked."""
    calls, replies = [], []
    monkeypatch.setattr(llm, "PROVIDER", "sarvam")

    def fake_sarvam(system, user):
        calls.append(user)
        return json.dumps(replies.pop(0) if replies else {"intent": "unclear"})

    monkeypatch.setattr(llm, "_sarvam", fake_sarvam)
    return calls, replies


def test_off_script_answer_is_understood_and_still_read_back(caller, ai):
    calls, replies = ai
    consent(caller)
    caller.key("1")                                                   # q0 -> q1
    replies.append({"intent": "answer", "value": "5"})
    j = caller.say("थोड़ा बहुत स्कूल गया था बस")                      # word list: nothing
    assert caller.ids(j) == ["you_said", "v-edu-5", "is_right"] and len(calls) == 1


def test_side_question_is_answered_with_our_own_sentence_then_the_same_question(caller, ai):
    calls, replies = ai
    consent(caller)
    replies.append({"intent": "question", "fact": "A6"})
    j = caller.say("इसमें पैसे लगेंगे क्या")
    assert caller.ids(j) == ["fact-A6", "q0"]                       # pre-recorded; no AI words spoken


def test_asking_for_a_person_by_voice(caller, ai):
    calls, replies = ai
    consent(caller)
    replies.append({"intent": "help"})
    assert caller.ids(caller.say("मुझे किसी इंसान से बात करनी है")) == ["help_queued", "q0"]
    b = STORE.q("select id from beneficiary where phone_hash=?", caller.phone).fetchone()
    assert STORE.q("select count(*) from callback_request where beneficiary_id=?", b[0]).fetchone()[0] == 1


def test_yes_no_question_understood_by_the_ai(caller, ai):
    calls, replies = ai
    caller.turn("opened")
    replies.append({"intent": "answer", "value": "yes"})
    assert caller.ids(caller.say("चलिए शुरू करते हैं जी")) == ["ack", "q0"]


def test_cheap_layers_first_no_ai_for_clear_answers_or_noise(caller, ai):
    calls, _ = ai
    caller.turn("opened")
    caller.say("हाँ")                                                  # word list: yes
    caller.say("गया")                                                  # word list: district
    caller.say("हम्म")                                                 # one word: not worth a call
    assert calls == []


def test_ai_value_outside_the_allowed_list_is_ignored(caller, ai):
    calls, replies = ai
    consent(caller)
    caller.key("1")
    replies.append({"intent": "answer", "value": "PhD"})               # not an option for q1
    assert caller.ids(caller.say("मैंने पीएचडी की है भाई")) == ["reask", "q1"]


def test_ai_budget_per_call(caller, ai, monkeypatch):
    calls, _ = ai
    monkeypatch.setattr(flow, "AI_PER_CALL", 2)
    consent(caller)
    for _ in range(4):
        caller.say("कुछ समझ में नहीं आ रहा भाई")
    assert len(calls) == 2                                             # then menus and keypad only


def test_ai_off_or_failing_changes_nothing(caller, monkeypatch):
    monkeypatch.setattr(llm, "PROVIDER", "sarvam")
    monkeypatch.setattr(llm, "_sarvam", lambda s, u: (_ for _ in ()).throw(TimeoutError()))
    consent(caller)
    assert caller.ids(caller.say("कुछ समझ में नहीं आ रहा भाई")) == ["reask", "q0"]


# --- open answers: any place, any job ------------------------------------------------

def test_any_place_in_india_is_understood_and_checked(caller, ai):
    calls, replies = ai
    consent(caller)
    replies.append({"intent": "answer", "value": None, "state": "Odisha", "district": "Khordha",
                    "hi": "भुवनेश्वर, ओडिशा"})
    j = caller.say("मैं भुवनेश्वर से बोल रहा हूँ")
    assert j["say"][1] == {"kind": "tts", "text": "भुवनेश्वर, ओडिशा"} and caller.ids(j)[0] == "you_said"
    caller.say("हाँ")
    b = STORE.q("select district from beneficiary where phone_hash=?", caller.phone).fetchone()
    assert b[0] == "Khordha, Odisha"


def test_a_place_outside_india_is_not_accepted(caller, ai):
    calls, replies = ai
    consent(caller)
    replies.append({"intent": "answer", "state": "Atlantis", "district": "X", "hi": "अटलांटिस"})
    assert caller.ids(caller.say("मैं अटलांटिस से बोल रहा हूँ"))[0] == "reask"


def test_any_job_becomes_a_custom_trade_with_real_sectors(caller, ai):
    calls, replies = ai
    consent(caller)
    caller.key("1")                                                   # q0
    caller.key("4")                                                   # q1 10th
    replies.append({"intent": "answer", "value": "NEW", "label": "इंजीनियर",
                    "sectors": ["Electronics & HW", "Made Up Sector"], "keywords": ["technician", "Engineer!"]})
    j = caller.say("हमारे घर में सब इंजीनियर हैं")
    assert j["say"][1] == {"kind": "tts", "text": "इंजीनियर"}
    caller.say("हाँ")
    b = STORE.q("select id from beneficiary where phone_hash=?", caller.phone).fetchone()
    v = STORE.answers(b[0])["q2"]["value"]
    assert v == {"id": "CUSTOM", "label": "इंजीनियर", "sectors": ["Electronics & HW"],
                 "keywords": ["technician", "engineer"]}                # made-up sector and junk dropped


def test_custom_trade_drives_real_recommendations():
    import datetime as dt
    from engine import recommend
    eng = {"id": "CUSTOM", "label": "इंजीनियर", "sectors": ["Electronics & HW"], "keywords": ["technician"]}
    r = recommend.recommend(recommend.Profile(10, True, eng, 0, None, [eng], None, "wage", []),
                            today=dt.date(2026, 9, 26))
    assert sum(x.sector == "Electronics & HW" for x in r["eligible"]) >= 2   # its sectors lead
