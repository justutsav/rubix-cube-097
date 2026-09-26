"""Conversation, not a form: problems are heard, the caller can go back, answers are reasoned about."""

import json

from engine.server import STORE
from test_ai import ai  # noqa: F401  (fixture)
from test_flow import consent


def bid(c):
    return STORE.q("select id from beneficiary where phone_hash=?", c.phone).fetchone()[0]


def to_q5(c):
    consent(c)
    c.key("131514")                                   # q0 q1 q2 years q3 q4 by key


# --- problems ------------------------------------------------------------------------

def test_a_problem_is_acknowledged_noted_and_the_question_comes_back(caller):
    consent(caller)
    assert caller.ids(caller.say("घर में पैसों की तंगी है")) == ["prob-money", "back_to_q", "q0"]
    assert caller.ids(caller.say("ऊपर से कर्ज भी है")) == ["prob_noted", "back_to_q", "q0"]  # once is enough
    assert STORE.concerns(bid(caller)) == ["money"]                  # the topic, never the words
    assert caller.ids(caller.say("कुछ भी"))[0] == "reask"            # sharing a problem used no try


def test_a_problem_that_answers_a_later_question_is_offered_back(caller):
    consent(caller)
    assert caller.ids(caller.say("मेरे बच्चे छोटे हैं"))[0] == "prob-family"
    caller.key("13151")
    j = caller.key("4")                                               # q4 done -> q5
    assert caller.ids(j)[-3:] == ["you_told_earlier", "v-mob-care_duty", "is_right"]
    j = caller.say("हाँ")
    assert caller.ids(j)[:2] == ["ack", "q6"]                          # no second "sorry"
    assert STORE.answers(bid(caller))["q5"]["value"] == "care_duty"


def test_discrimination_gets_a_person_to_call_back(caller):
    consent(caller)
    assert caller.ids(caller.say("गाँव में हमारे साथ भेदभाव होता है"))[0] == "prob-discrimination"
    assert STORE.q("select count(*) from callback_request where beneficiary_id=?", bid(caller)).fetchone()[0] == 1


def test_ai_finds_a_problem_next_to_an_answer(caller, ai):  # noqa: F811
    calls, replies = ai
    consent(caller)
    caller.key("1")
    replies.append({"intent": "answer", "value": "8", "problem": "money"})
    j = caller.say("स्कूल गया था फिर घर की हालत से छोड़ दिया")
    assert caller.ids(j) == ["prob-money", "you_said", "v-edu-8", "is_right"]


def test_ai_problem_wins_over_offtopic_when_the_word_list_heard_one(caller, ai):  # noqa: F811
    calls, replies = ai
    consent(caller)
    replies.append({"intent": "offtopic"})
    assert caller.ids(caller.say("क्या बताऊँ इलाज में सब चला गया"))[0] == "prob-health"


# --- going back ---------------------------------------------------------------------

def test_previous_question_by_voice_then_the_interview_carries_on(caller):
    consent(caller)
    caller.key("1")                                                   # q0 -> q1
    assert caller.ids(caller.say("पिछला सवाल")) == ["go_back_ok", "q0"]
    assert caller.ids(caller.key("1"))[-1] == "q1"


def test_star_key_goes_back_and_a_new_trade_asks_its_years_again(caller):
    consent(caller)
    caller.key("1315")                                                # q0 q1 q2 years -> q3
    assert caller.ids(caller.key("*")) == ["go_back_ok", "q2_years"]
    assert caller.ids(caller.key("*")) == ["go_back_ok", "q2"]
    assert caller.ids(caller.key("2"))[-1] == "q2_years"              # a new family trade: years again
    assert caller.ids(caller.key("5"))[-1] == "q3"                    # then on from where we were


def test_nothing_before_the_first_question(caller):
    consent(caller)
    assert caller.ids(caller.say("पीछे जाओ")) == ["go_back_first", "q0"]


def test_ai_goto_a_named_question_and_never_forward(caller, ai):  # noqa: F811
    calls, replies = ai
    consent(caller)
    caller.key("13151")                                               # -> q4
    replies.append({"intent": "goto", "goto": "q1"})
    assert caller.ids(caller.say("मेरी पढ़ाई वाला जवाब बदलना है")) == ["go_back_ok", "q1"]
    assert caller.ids(caller.key("4"))[-1] == "q4"                    # q2, q3 kept; back to q4
    replies.append({"intent": "goto", "goto": "q7"})
    assert caller.ids(caller.say("आखिरी वाले सवाल पर चलो"))[-1] == "q4"


def test_going_back_then_giving_up_keeps_the_old_answer(caller):
    consent(caller)
    caller.key("1")
    caller.say("पिछला सवाल")
    caller.turn("timeout")
    j = caller.turn("timeout")
    assert caller.ids(j)[-1] == "q1"
    assert STORE.answers(bid(caller))["q0"]["confirmed_at"]


# --- reasoning -----------------------------------------------------------------------

def test_answers_are_linked_out_loud(caller):
    consent(caller)
    caller.key("1315")                                                # family trade = key 1
    assert "reason_same_trade" in caller.ids(caller.key("1"))         # current work = the same
    caller.key("4")                                                   # interest = key 4
    caller.key("11")                                                  # q5 none, q6 self
    assert "reason_demand_match" in caller.ids(caller.key("4"))       # demand = the interest


def test_the_result_says_why_and_the_reasoning_is_saved(caller):
    to_q5(caller)
    j = caller.key("111")                                             # q5 q6 q7
    j = caller.key("1")                                               # read-back: all right
    tail = next(x["text"] for x in j["say"] if x["kind"] == "tts")
    assert "परिवार के काम का अनुभव" in tail
    row = STORE.q("select data from insight where beneficiary_id=?", bid(caller)).fetchone()
    data = json.loads(row[0])
    assert data["pathway"] == "build_on_family_skill" and data["why"]


def test_a_long_sentence_with_ek_baar_is_not_a_repeat_request(caller):
    consent(caller)
    j = caller.say("हमारे गाँव से शहर जाने का कोई साधन नहीं है, बस दिन में एक बार आती है")
    assert caller.ids(j) == ["prob-travel", "back_to_q", "q0"]
