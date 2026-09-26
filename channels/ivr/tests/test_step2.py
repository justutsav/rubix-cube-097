import asyncio
import json

from ivr import audio


def test_frames_are_20ms():
    parts = list(audio.frames(b"\x00" * 1000))
    assert [len(p) for p in parts] == [320, 320, 320, 40]


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
    assert len(media) == 50
    assert sent[-1][1]["mark"]["name"] == "q1.end"
    # all sent within the lead window of real time: not dumped at once, not late
    assert 0.8 <= media[-1] - start <= 1.3           # loose: Windows timers tick every ~15 ms
