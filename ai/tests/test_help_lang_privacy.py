
import pytest

from conftest import Caller
from engine import extract as x
from engine import flow, prompts
from engine.server import STORE
from test_flow import consent


# --- help key ------------------------------------------------------------------

def test_hash_queues_a_callback_and_repeats_the_question(caller):
    c = caller
    consent(c)
    c.key("1")                                                   # q0 by key -> q1
    j = c.key("#")
    assert c.ids(j) == ["help_queued", "q1"]                     # then carries on
    b = STORE.q("select id from beneficiary where phone_hash=?", c.phone).fetchone()
    r = STORE.q("select * from callback_request where beneficiary_id=?", b[0]).fetchone()
    assert r["status"] == "OPEN" and r["at_state"] == "FIELD"


def test_hash_during_confirm_repeats_the_confirm(caller):
    c = caller
    consent(c)
    c.say("सीतापुर")
    assert c.ids(c.key("#")) == ["help_queued", "is_right"]


# --- language choice -------------------------------------------------------------

@pytest.fixture
def two_langs(monkeypatch):
    monkeypatch.setattr(flow, "LANGS", ["hi", "bho"])
    monkeypatch.setattr(flow, "LANG_DTMF", {"1": "hi", "2": "bho"})


def test_language_menu_sets_the_call_language(caller, two_langs):
    c = caller
    j = c.turn("opened")
    assert c.ids(j) == ["lang_select"]
    j = c.key("2")
    assert j["lang"] == "bho" and c.ids(j) == ["welcome", "consent"]
    j = c.say("हँ जी")                                           # Bhojpuri yes
    assert j["lang"] == "bho" and c.ids(j) == ["ack", "q0"]      # language survives each step


def test_no_choice_defaults_to_the_first_language(caller, two_langs):
    c = caller
    c.turn("opened")
    c.turn("timeout")
    j = c.turn("timeout")
    assert j["lang"] == "hi" and c.ids(j) == ["welcome", "consent"]


def test_bhojpuri_catalogue_is_only_overrides_of_known_prompts():
    hi, bho = prompts.catalogue("hi"), prompts.catalogue("bho")
    assert bho and set(bho) <= set(hi)


@pytest.mark.parametrize("fn,text,want", [
    ("yes_no", "हँ जी", "yes"),
    ("yes_no", "नाहीं", "no"),
    ("education", "दसवाँ ले पढ़नी", {"class": 10}),
    ("trade", "खेती-बारी करीले", "FARMING"),
    ("mobility", "कवनो दिक्कत नइखे", "none"),
    ("employment_pref", "आपन काम करब", "self"),
])
def test_bhojpuri_forms_understood(fn, text, want):
    assert getattr(x, fn)([text])[0] == want


# --- privacy: what must never be stored -----------------------------------------------

def test_nothing_sensitive_is_stored(client):
    c = Caller(client)
    consent(c)
    said = "मैं आठवीं तक पढ़ी हूँ"
    c.key("1")
    c.say(said)
    c.say("हाँ")
    dump = "\n".join(STORE.db.iterdump())
    assert said not in dump and "पढ़ी" not in dump               # no transcripts, only the value
    assert not any(t in dump for t in ("audio", "wav", "recording"))  # no audio columns at all
