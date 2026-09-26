import asyncio
import json

from ivr import audio


def test_chunks_meet_exotel_minimum():
    parts = list(audio.frames(b"\x01" * 7000))
    assert [len(p) for p in parts] == [3200, 3200, 3200]              # last one padded with silence
    assert all(len(p) % 320 == 0 for p in parts)


def test_player_paces_to_real_time_and_marks_the_end():
    async def run():
        sent = []
        loop = asyncio.get_running_loop()

        async def send(text):
            sent.append((loop.time(), json.loads(text)))

        p = audio.Player(send, "s1")
        p.play(b"\x00" * 16000, mark="q1.end")      # 1 s clip
        start = loop.time()
        while not sent or sent[-1][1]["event"] != "mark":
            await asyncio.sleep(0.01)
        await p.close()
        return start, sent

    start, sent = asyncio.run(run())
    media = [t for t, m in sent if m["event"] == "media"]
    assert len(media) == 5                                           # 1 s = five 200 ms chunks
    assert sent[-1][1]["mark"]["name"] == "q1.end"
    # all sent within the lead window of real time: not dumped at once, not late
    assert 0.5 <= media[-1] - start <= 1.0           # paced, 200 ms ahead; loose for Windows timers
