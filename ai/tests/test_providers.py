"""Sarvam falls back to Vosk, then to the keypad (None). No network in these tests."""

from engine import asr, tts


def _boom(*a, **k):
    raise TimeoutError("slow")


def test_sarvam_ok(monkeypatch):
    monkeypatch.setattr(asr, "PROVIDER", "sarvam")
    monkeypatch.setattr(asr, "_sarvam", lambda pcm, rate, lang: ["सिलाई"])
    assert asr.transcribe(b"\x00" * 320, 8000) == ["सिलाई"] and asr.last_used() == "sarvam"


def test_sarvam_fails_vosk_answers(monkeypatch):
    monkeypatch.setattr(asr, "PROVIDER", "sarvam")
    monkeypatch.setattr(asr, "_sarvam", _boom)
    monkeypatch.setattr(asr, "_local_asr", _boom)                     # not installed
    monkeypatch.setattr(asr, "_vosk", lambda pcm, rate: ["सिलाई"])
    assert asr.transcribe(b"\x00" * 320, 8000) == ["सिलाई"] and asr.last_used() == "vosk"


def test_both_fail_keypad(monkeypatch):
    monkeypatch.setattr(asr, "PROVIDER", "sarvam")
    monkeypatch.setattr(asr, "_sarvam", _boom)
    monkeypatch.setattr(asr, "_local_asr", _boom)
    monkeypatch.setattr(asr, "_vosk", _boom)
    assert asr.transcribe(b"\x00" * 320, 8000) is None and asr.last_used() is None


def test_sarvam_fails_local_answers_in_the_callers_language(monkeypatch):
    monkeypatch.setattr(asr, "PROVIDER", "sarvam")
    monkeypatch.setattr(asr, "_sarvam", _boom)
    monkeypatch.setattr(asr, "_local_asr", lambda pcm, rate, lang: [f"heard-{lang}"])
    assert asr.transcribe(b"\x00" * 320, 8000, "bn") == ["heard-bn"] and asr.last_used() == "local"


def test_vosk_never_guesses_another_language(monkeypatch):
    monkeypatch.setattr(asr, "PROVIDER", "vosk")
    monkeypatch.setattr(asr, "_vosk", lambda pcm, rate: ["सिलाई"])
    assert asr.transcribe(b"\x00" * 320, 8000, "or") is None                # keypad, not Hindi words


def test_tts_falls_back_to_gtts(monkeypatch):
    monkeypatch.setattr(tts, "PROVIDER", "sarvam")
    monkeypatch.setattr(tts, "_sarvam", _boom)
    monkeypatch.setattr(tts, "_gtts", lambda text, lang, rate: b"pcm")
    tts.synth.cache_clear()
    assert tts.synth("नमस्ते", "hi", 8000) == b"pcm"
