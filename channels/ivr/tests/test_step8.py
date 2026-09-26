"""Step 8: talking to the real engine's reply shape, including the spoken result (TTS)."""

import asyncio

from fastapi.testclient import TestClient

from conftest import voice, Line, clip
from ivr import engine, server


def test_result_speech_plays_in_order_sentence_by_sentence(eng, monkeypatch):
    async def tts(text, lang):
        await asyncio.sleep(0.05 if text.startswith("A") else 0.01)   # first sentence slowest
        if text.startswith("C"):
            raise RuntimeError("tts down")                            # one sentence fails
        return bytes([ord(text[0])]) * 320

    monkeypatch.setattr(engine, "tts", tts)
    eng.script = [["q2", {"kind": "tts", "text": "A one. B two. C three."}, "bye"]]

    async def turn(call_sid, phone, lang, utt):
        eng.seen.append(utt["kind"])
        say = [x if isinstance(x, dict) else {"kind": "prerendered", "id": x} for x in eng.script[0]]
        return {"state": "DONE", "say": say, "terminal": True}

    monkeypatch.setattr(engine, "turn", turn)
    with TestClient(server.app).websocket_connect("/stream") as ws:
        line = Line(ws)
        line.start()
        audio, mark = line.hear()
    # intro, sentence A, sentence B (C failed and is skipped), goodbye — in that order
    assert voice(audio) == clip(2) + b"A" * 320 + b"B" * 320 + clip(3)
