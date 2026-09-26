from conftest import Caller
from engine.server import STORE


def consent_and_pin(c, pin="1234"):
    j = c.turn("opened")
    assert c.ids(j) == ["welcome", "consent"]
    j = c.say("हाँ जी")
    assert c.ids(j) == ["pin_set"]
    j = c.key(pin)
    assert c.ids(j) == ["pin_saved", "q0"]


def test_full_spoken_interview_ends_in_a_recommendation(caller):
    c = caller
    consent_and_pin(c)
    for answer in ["सीतापुर", "आठवीं तक पढ़ी"]:
        assert "you_said" in c.ids(c.say(answer))
        c.say("हाँ")
    j = c.say("बारह साल से सिलाई करती हूँ")                        # two fields in one answer
    assert c.ids(j) == ["you_said", "v-trade-tailoring", "v-years-12", "is_right"]
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
    consent_and_pin(c)
    j = c.turn("audio", data="AAAA")
    assert c.ids(j) == ["q0_menu"]
    for digit in ["1", "3", "1", "5", "1", "4", "2", "1", "3"]:     # q0 q1 q2 years q3 q4 q5 q6 q7
        j = c.key(digit)
        assert "you_said" not in c.ids(j)                             # keys are exact: no read-back
    assert j["state"] == "READBACK"
    assert c.key("1")["terminal"]


def test_misheard_twice_then_menu_then_deferred(caller):
    c = caller
    consent_and_pin(c)
    assert c.ids(c.say("कुछ भी नहीं समझ")) == ["reask", "q0"]
    assert c.ids(c.say("ऐसे ही"))[-1] == "q0_menu"
    c.say("पता नहीं")
    j = c.say("कुछ नहीं")
    assert c.ids(j)[:2] == ["deferred", "q1"]                          # skipped, never a dead end


def test_silence_nudges_then_moves_on(caller):
    c = caller
    consent_and_pin(c)
    assert c.ids(c.turn("timeout")) == ["nudge", "q0"]
    assert c.ids(c.turn("timeout"))[:2] == ["deferred", "q1"]


def test_correction_while_confirming(caller):
    c = caller
    consent_and_pin(c)
    c.key("1")                                                         # q0 by key
    c.say("दसवीं")
    j = c.say("नहीं आठवीं")                                            # "no, eighth"
    assert c.ids(j) == ["you_said", "v-edu-8", "is_right"]


def test_refusing_consent_ends_politely_and_stores_nothing(caller):
    c = caller
    c.turn("opened")
    j = c.key("2")
    assert j["terminal"] and c.ids(j) == ["close_polite"]
    b = STORE.q("select * from beneficiary where phone_hash=?", c.phone).fetchone()
    assert b["consent_state"] == "NONE" and not STORE.answers(b["id"])


def test_dropped_call_resumes_with_pin_at_the_same_question(client):
    c = Caller(client)
    consent_and_pin(c, "4321")
    c.key("1")                                                         # q0
    c.key("4")                                                         # q1
    c.turn("hangup")

    c.call()                                                           # redial, new call id
    j = c.turn("opened")
    assert c.ids(j) == ["resume_offer"]
    j = c.key("4321")
    assert c.ids(j) == ["resume_ok", "q2"] and j["resumed_from"] == "q2"


def test_wrong_pin_twice_starts_a_new_person_never_a_lockout(client):
    c = Caller(client)
    consent_and_pin(c, "1111")
    c.key("1")
    c.turn("hangup")
    c.call()
    c.turn("opened")
    assert c.ids(c.key("9999"))[0] == "pin_wrong"
    j = c.key("8888")
    assert c.ids(j) == ["new_start", "consent"]
    ordinals = [r[0] for r in STORE.q("select ordinal from beneficiary where phone_hash=?", c.phone)]
    assert sorted(ordinals) == [1, 2]                                  # shared handset: two people


def test_star_skips_resume(client):
    c = Caller(client)
    consent_and_pin(c)
    c.key("1")
    c.turn("hangup")
    c.call()
    c.turn("opened")
    assert c.ids(c.key("*")) == ["new_start", "consent"]


def test_readback_lets_the_caller_fix_one_answer(caller):
    c = caller
    consent_and_pin(c)
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
    consent_and_pin(c)
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
