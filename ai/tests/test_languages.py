"""Bengali and Odia: complete prompt sets, the same matcher, a whole interview in each language."""

import pytest

from engine import extract, flow, prompts


@pytest.fixture
def three_langs(monkeypatch):
    monkeypatch.setattr(flow, "LANGS", ["hi", "bn", "or"])
    monkeypatch.setattr(flow, "LANG_DTMF", {"1": "hi", "2": "bn", "3": "or"})


@pytest.mark.parametrize("lang", ["bn", "or"])
def test_every_hindi_prompt_exists_in_the_language(lang):
    hi, other = prompts.catalogue("hi"), prompts.catalogue(lang)
    assert set(hi) == set(other)
    same = [k for k in hi if hi[k] == other[k] and k != "hmm"]
    assert not same, f"left in Hindi: {same[:5]}"


@pytest.mark.parametrize("lang", ["hi", "bn", "or"])
def test_our_own_words_never_trip_the_guardrails(lang):
    for pid, text in prompts.catalogue(lang).items():
        assert not extract.is_abusive(text), (lang, pid)
        assert not extract.looks_like_injection([text]), (lang, pid)


def test_odia_numbers_are_words_the_voice_can_read():
    c = prompts.catalogue("or")
    assert c["v-years-12"] == "ବାର ବର୍ଷ" and not any(ch.isdigit() for ch in c["q2_years_menu"])


def test_bengali_and_odia_are_matched_like_hindi():
    assert extract.norm("গয়া") == extract.norm("गया")                 # same letters, same place
    assert extract.education(["ମୁଁ ଦଶମ ପାସ୍ କରିଛି"])[0] == {"class": 10}
    assert extract.years(["বারো বছর ধরে"])[0] == 12
    assert extract.trade(["ମୁଁ ଚାଷ କରେ"])[0] == "FARMING"
    assert extract.trade(["আমার টাকার অভাব"]) is None                 # "আমার" (my) is not "কামার" (smith)
    assert extract.problem(["আমার টাকার অভাব"]) == "money"


def test_a_whole_interview_in_bengali(caller, three_langs):
    c = caller
    assert c.ids(c.turn("opened")) == ["lang_pick.hi", "lang_pick.bn", "lang_pick.or"]
    j = c.say("বাংলা")                                                  # the language, said
    assert j["lang"] == "bn" and c.ids(j) == ["welcome", "consent"]
    assert c.ids(c.say("হ্যাঁ")) == ["ack", "q0"]
    for answer in ["গয়া", "দশম পাশ"]:
        assert "you_said" in c.ids(c.say(answer))
        c.say("হ্যাঁ")
    j = c.say("বারো বছর ধরে সেলাই করি")
    assert c.ids(j)[:3] == ["you_said", "v-trade-tailoring", "v-years-12"]
    c.say("হ্যাঁ")
    assert "prob-money" in c.ids(c.say("কাজ তো আছে কিন্তু টাকার অভাব"))   # heard, not skipped
    for answer in ["সেলাই", "বিউটি পার্লার", "কোনো অসুবিধা নেই", "নিজের কাজ", "সেলাই"]:
        j = c.say(answer)
        if "you_said" in c.ids(j):
            j = c.say("হ্যাঁ")
    assert j["state"] == "READBACK"
    j = c.say("হ্যাঁ")
    tail = next(x["text"] for x in j["say"] if x["kind"] == "tts")
    assert j["terminal"] and "কোর্স" in tail and "पचास" not in tail     # the result in Bengali


def test_odia_by_key_problem_and_going_back(caller, three_langs):
    c = caller
    c.turn("opened")
    assert c.key("3")["lang"] == "or"
    c.say("ହଁ")
    assert c.ids(c.say("ଘରେ ଟଙ୍କା ନାହିଁ"))[0] == "prob-money"
    c.key("1")                                                          # q0 by key -> q1
    assert c.ids(c.say("ପୂର୍ବ ପ୍ରଶ୍ନ")) == ["go_back_ok", "q0"]


def test_fourteen_in_bengali_is_not_abuse():
    assert not extract.is_abusive("চোদ্দ বছর") and extract.is_abusive("বোকাচোদা")
