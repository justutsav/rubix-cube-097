import pytest

from engine import extract as x


@pytest.mark.parametrize("fn,text,want", [
    ("trade", "मैं सिलाई का काम करती हूँ", "TAILORING"),
    ("trade", "silai", "TAILORING"),
    ("trade", "दरजी का काम", "TAILORING"),          # misspelt, sound-alike
    ("trade", "बुनकर हूँ", "WEAVING"),
    ("trade", "kheti badi", "FARMING"),              # Roman-script Hindi
    ("trade", "बकरी पालते हैं", "DAIRY"),
    ("trade", "ब्यूटी पालर", "BEAUTY"),               # ASR-style error
    ("trade", "मजदूरी", "LABOUR"),
    ("yes_no", "हाँ जी", "yes"),
    ("yes_no", "haan", "yes"),
    ("yes_no", "नहीं", "no"),
    ("education", "दसवीं पास", {"class": 10}),
    ("education", "8 तक पढ़ी", {"class": 8}),
    ("education", "आठ तक", {"class": 8}),
    ("education", "अनपढ़ हूँ", {"class": 0}),
    ("education", "आईटीआई", {"class": 12, "iti": True}),
    ("years", "बारह साल से कर रहे हैं", 12),
    ("years", "5 साल", 5),
    ("mobility", "कोई परेशानी नहीं", "none"),
    ("mobility", "दूर नहीं जा सकती", "distance"),     # not "none" because of नहीं
    ("mobility", "पैर में दिक्कत है", "physical"),
    ("mobility", "बच्चों को देखना पड़ता है", "care_duty"),
    ("employment_pref", "अपना काम करना है", "self"),
    ("employment_pref", "नौकरी चाहिए", "wage"),
    # found by the accuracy harness (channels/ivr/tools/accuracy.py)
    ("yes_no", "नहीं जी गलत है", "no"),             # "जी" is politeness, not yes
    ("mobility", "नहीं", "none"),                    # bare no to "any difficulty?"
    ("mobility", "ही नहीं जा सकती", "distance"),      # misheard "दूर", still not "none"
    ("trade", "राजगीर का काम", "CONSTRUCTION"),
    # found on the first real Exotel call: Sarvam ends every transcript with "।"
    ("district", "गया।", "GAYA"),
    ("yes_no", "हाँ।", "yes"),
    ("education", "मैंने बैचलर्स तक पढ़ाई की है।", {"class": 15}),
    ("years", "5 साल।", 5),
    ("trade", "खेती।", "FARMING"),
    ("mobility", "आने जाने में दिक्कत है।", "distance"),
])
def test_extracts(fn, text, want):
    got = getattr(x, fn)([text])
    assert got and got[0] == want


@pytest.mark.parametrize("fn,text", [
    ("trade", "फिर से नहीं पता"),                     # "पता" must not sound like "पापड़"
    ("trade", "बच्चों को देखना पड़ता है"),
    ("trade", "कुछ समझ नहीं आया"),
    ("yes_no", "पता नहीं हाँ"),                       # both: ambiguous, ask again
    ("education", "पता नहीं"),                        # not "पढ़ाई नहीं"
    ("education", "नहीं"),                            # not "नवीं" (9th)
    ("years", "बहुत दिन से"),
    ("trade", "इस ही का काम सीखना है"),              # shared "का काम" is not a match
    ("mobility", "स्कूल में पढ़ाती हूँ और कुछ नहीं"),     # a long answer with नहीं is not "none"
])
def test_no_false_matches(fn, text):
    assert getattr(x, fn)([text]) is None


def test_several_trades_and_nbest():
    assert x.trades(["सिलाई और ब्यूटी पार्लर सीखना है"])[0] == ["TAILORING", "BEAUTY"]
    # the right answer only in the second guess still wins, a little less sure
    v, conf, _ = x.trade(["कुछ और", "सिलाई"])
    assert v == "TAILORING" and conf < 1.0
