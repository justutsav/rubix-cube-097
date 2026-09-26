from conftest import Caller
from engine import flow
from engine.server import STORE


def consent(c):
    j = c.turn("opened")
    assert c.ids(j) == ["welcome", "consent"]
    j = c.say("हाँ जी")
    assert c.ids(j) == ["ack", "q0"]


def test_full_spoken_interview_ends_in_a_recommendation(caller):
    c = caller
    consent(c)
    for answer in ["सीतापुर", "आठवीं तक पढ़ी"]:
        assert "you_said" in c.ids(c.say(answer))
        c.say("हाँ")
    j = c.say("बारह साल से सिलाई करती हूँ")                        # two fields in one answer
    assert c.ids(j) == ["you_said", "v-trade-tailoring", "v-years-12", "is_right_short"]   # long form taught once
    j = c.say("हाँ")
    assert c.ids(j)[-1] == "q3"                                       # q2_years not asked again
    for answer in ["मजदूरी", "सिलाई और ब्यूटी पार्लर", "बच्चों को देखना पड़ता है", "अपना काम", "सिलाई"]:
        assert "you_said" in c.ids(c.say(answer))
        j = c.say("हाँ")
    assert j["state"] == "READBACK" and "readback_confirm" in c.ids(j)
    j = c.key("1")
    assert j["terminal"] and j["state"] == "DONE"
    tail = next(x["text"] for x in j["say"] if x["kind"] == "tts")
    assert "Tailor" in tail and "पचास हज़ार" in tail

    b = STORE.q("select * from beneficiary where phone_hash=?", c.phone).fetchone()
    assert b["consent_state"] == "GIVEN" and b["district"] == "SITAPUR"
    assert STORE.q("select count(*) from recommendation where beneficiary_id=?", b["id"]).fetchone()[0] == 1
    answers = STORE.answers(b["id"])
    assert answers["q2_years"]["value"] == 12 and all(a["confirmed_at"] for a in answers.values())


def test_keypad_only_when_there_is_no_speech_to_text(caller):
    """ASR_PROVIDER=none: spoken audio goes straight to the menu; the call still completes."""
    c = caller
    consent(c)
    j = c.turn("audio", data="AAAA")
    assert c.ids(j) == ["q0_menu"]
    for digit in ["1", "3", "1", "5", "1", "4", "2", "1", "3"]:     # q0 q1 q2 years q3 q4 q5 q6 q7
        j = c.key(digit)
        assert "you_said" not in c.ids(j)                             # keys are exact: no read-back
    assert j["state"] == "READBACK"
    assert c.key("1")["terminal"]


def test_misheard_twice_then_menu_then_deferred(caller):
    c = caller
    consent(c)
    assert c.ids(c.say("कुछ भी नहीं समझ")) == ["reask", "q0"]
    assert c.ids(c.say("ऐसे ही"))[-1] == "q0_menu"
    c.say("पता नहीं")
    j = c.say("कुछ नहीं")
    assert c.ids(j)[:2] == ["deferred", "q1"]                          # skipped, never a dead end


def test_silence_nudges_then_moves_on(caller):
    c = caller
    consent(c)
    assert c.ids(c.turn("timeout")) == ["nudge", "q0"]
    assert c.ids(c.turn("timeout"))[:2] == ["deferred", "q1"]


def test_correction_while_confirming(caller):
    c = caller
    consent(c)
    c.key("1")                                                         # q0 by key
    c.say("दसवीं")
    j = c.say("नहीं आठवीं")                                            # "no, eighth"
    assert c.ids(j) == ["you_said", "v-edu-8", "is_right_short"]


def test_refusing_consent_ends_politely_and_stores_nothing(caller):
    c = caller
    c.turn("opened")
    j = c.key("2")
    assert j["terminal"] and c.ids(j) == ["close_polite"]
    b = STORE.q("select * from beneficiary where phone_hash=?", c.phone).fetchone()
    assert b["consent_state"] == "NONE" and not STORE.answers(b["id"])


def test_dropped_call_offers_to_continue_at_the_same_question(client):
    c = Caller(client)
    consent(c)
    c.key("1")                                                         # q0
    c.key("4")                                                         # q1
    c.turn("hangup")

    c.call()                                                           # redial, same phone
    j = c.turn("opened")
    assert c.ids(j) == ["resume_offer"]                                # "continue the previous one?"
    j = c.say("हाँ।")
    assert c.ids(j) == ["resume_ok", "q2"] and j["resumed_from"] == "q2"


def test_choosing_a_fresh_start_makes_a_new_person_on_the_same_phone(client):
    c = Caller(client)
    consent(c)
    c.key("1")
    c.turn("hangup")
    c.call()
    c.turn("opened")
    assert c.ids(c.key("2")) == ["new_start", "consent"]
    ordinals = [r[0] for r in STORE.q("select ordinal from beneficiary where phone_hash=?", c.phone)]
    assert sorted(ordinals) == [1, 2]                                  # shared handset: two people


def test_unclear_resume_answer_twice_starts_fresh_never_stuck(client):
    c = Caller(client)
    consent(c)
    c.key("1")
    c.turn("hangup")
    c.call()
    c.turn("opened")
    assert c.ids(c.turn("timeout")) == ["nudge", "resume_offer"]
    assert c.ids(c.turn("timeout")) == ["new_start", "consent"]


def test_readback_lets_the_caller_fix_one_answer(caller):
    c = caller
    consent(c)
    for d in ["1", "3", "1", "5", "1", "4", "2", "1"]:
        c.key(d)
    j = c.key("3")                                                     # q7 -> read-back
    assert j["state"] == "READBACK"
    assert c.ids(c.key("2")) == ["readback_pick"]
    assert c.ids(c.key("6")) == ["q6"]                                 # edit q6 only
    j = c.key("2")
    assert j["state"] == "READBACK"                                    # straight back, not q7 again
    assert "v-pref-wage" in c.ids(j)


def test_guardian_needed_for_decisional_capacity(caller):
    c = caller
    consent(c)
    for d in ["1", "3", "1", "5", "1", "4"]:
        c.key(d)
    c.say("मानसिक परेशानी है")
    j = c.say("हाँ")
    assert c.ids(j)[-1] == "q5_guardian"
    j = c.key("2")                                                     # no guardian present
    assert j["terminal"]
    b = STORE.q("select consent_state from beneficiary where phone_hash=?", c.phone).fetchone()
    assert b[0] == "GUARDIAN_PENDING"


def test_bad_requests_are_rejected(client):
    base = {"channel": "ivr", "channel_ref": "x", "identity": {"kind": "msisdn_hash", "value": "abcdefgh12"}}
    assert client.post("/v1/turn", json=base | {"utterance": {"kind": "dtmf", "digits": "12ab"}}).status_code == 422
    assert client.post("/v1/turn", json=base | {"utterance": {"kind": "audio", "data": "!!notb64"}}).status_code == 422
    assert client.post("/v1/turn", json=base | {"utterance": {"kind": "shout"}}).status_code == 422


def test_catalogue_serves_every_prompt(client):
    cat = client.get("/v1/prompts/hi").json()
    assert "q1" in cat and "v-trade-tailoring" in cat and "q2_menu" in cat
    assert client.get("/v1/prompts/xx").status_code == 404


def test_extract_endpoint_for_measurement(client):
    r = client.post("/v1/extract", json={"field": "q2", "utterance": {"kind": "text", "value": "silai ka kaam"}})
    assert r.json()["value"] == "TAILORING" and r.json()["method"] == "LEXICON"
    r = client.post("/v1/extract", json={"field": "yes_no", "utterance": {"kind": "text", "value": "नहीं"}})
    assert r.json()["value"] == "no"
    assert client.post("/v1/extract", json={"field": "q9", "utterance": {"kind": "text", "value": "x"}}).status_code == 422


def test_yes_to_any_difficulty_opens_the_menu(caller):
    c = caller
    consent(c)
    for d in ["1", "3", "1", "5", "1", "4"]:
        c.key(d)
    assert c.ids(c.say("हाँ।")) == ["q5_menu"]


def test_asking_to_repeat_repeats_without_using_a_try(caller):
    c = caller
    consent(c)
    assert c.ids(c.say("एक बार वापस से बोलना।")) == ["q0"]
    assert c.ids(c.say("समझ नहीं आया")) == ["q0"]
    assert c.ids(c.say("कुछ भी नहीं समझ")) == ["reask", "q0"]          # still the first real miss


def test_bare_yes_to_an_open_question_offers_the_menu(caller):
    c = caller
    consent(c)
    c.key("1")                                              # q0 -> q1
    assert c.ids(c.say("हाँ।")) == ["q1_menu"]


def test_plain_no_to_any_difficulty_is_accepted_without_readback(caller):
    c = caller
    consent(c)
    for d in ["1", "3", "1", "5", "1", "4"]:
        c.key(d)
    ids = c.ids(c.say("नहीं।"))
    assert ids[0] in flow.ACKS and ids[1] == "q6"                    # accepted, no read-back


def test_spoken_menu_digit_counts_as_yes(client):
    c = Caller(client)
    c.turn("opened")
    assert c.ids(c.say("एक।")) == ["ack", "q0"]                     # "हाँ के लिए एक" said aloud


def test_our_own_prompt_heard_back_on_speakerphone_is_ignored(caller):
    c = caller
    consent(c)
    c.key("1")                                                          # now asking q1
    j = c.say("आपने कहाँ तक पढ़ाई की है")                                 # echo of q1 itself
    assert c.ids(j) == [] and j["state"] == "FIELD:q1:ask"              # no "sorry", no try used
    assert c.ids(c.say("कुछ भी नहीं समझ"))[0] == "reask"                # the first real miss
    assert c.ids(c.say("पढ़ाई दसवीं तक की है")) [:2] == ["you_said", "v-edu-10"]   # real answer with prompt words


def test_echo_of_the_consent_question_is_ignored(caller):
    c = caller
    c.turn("opened")
    j = c.say("क्या हम शुरू करें हाँ या नहीं बोलिए")
    assert c.ids(j) == [] and j["state"] == "CONSENT"
    assert c.ids(c.say("हाँ"))[:2] == ["ack", "q0"]


def test_menu_number_said_aloud_counts_as_the_key(caller):
    c = caller
    consent(c)
    c.say("कुछ भी नहीं समझ")
    assert c.ids(c.say("ऐसे ही"))[-1] == "q0_menu"
    assert c.ids(c.say("नौ।"))[:2] == ["ack", "q1"]              # 9 = other district
    b = STORE.q("select district from beneficiary where phone_hash=?", c.phone).fetchone()
    assert b[0] == "OTHER"


def test_warm_replies_and_progress_cues(caller):
    c = caller
    consent(c)
    c.key("1")                                                       # q0
    assert c.ids(c.key("1"))[0] == "emp_no_school"                   # key 1 = never studied
    c.key("1")                                                       # q2 tailoring
    assert c.ids(c.key("5"))[0] == "emp_experience"                  # 10+ years
    ids = c.ids(c.key("1"))                                          # q3 -> q4
    assert ids[-2:] == ["progress_half", "q4"]
