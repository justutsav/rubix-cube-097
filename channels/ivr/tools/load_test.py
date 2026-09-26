"""Load test: many fake callers at once against one adapter + engine.

Each caller runs a full interview, mixing spoken answers (speech-to-text load) and keys,
from a different phone number. Reports how many finished and the silence callers heard
after their spoken answers, so we learn how many calls one box can take before replies
slow past the 1.8 s target.

    uv run --extra dev python tools/load_test.py --calls 10 --engine http://localhost:8001
"""

import argparse
import asyncio
import sys
import time
from pathlib import Path

import websockets

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from tools.fake_exotel import FakeCall, spoken      # noqa: E402

SCRIPT = ["हाँ जी", "1", "आठवीं तक पढ़ी हूँ", "हाँ", "बारह साल से सिलाई का काम करती हूँ", "हाँ",
          "3", "सिलाई और ब्यूटी पार्लर सीखना है", "हाँ", "1", "अपना काम करना है", "हाँ", "1", "1"]


def pct(xs, p):
    xs = sorted(xs)
    return round(xs[min(len(xs) - 1, int(round(p / 100 * (len(xs) - 1))))]) if xs else None


RUN = int(time.time()) % 100000                     # fresh phone numbers every run: no resume path


async def one(url, n, voices):
    keys = [s if set(s) <= set("0123456789*#") else "~" for s in SCRIPT]
    answers = iter([voices[s] for s in SCRIPT if s in voices])
    t0 = time.monotonic()
    try:
        async with websockets.connect(url) as ws:
            call = FakeCall(ws, answers, None, 40, False, keys, phone=f"+917{RUN:05d}{n:04d}", quiet=True)
            await asyncio.wait_for(call.run(), timeout=600)
        # finished = reached the result, not just hung up on (an engine timeout ends with "sorry")
        return call.closed_by_adapter and call.turns >= 12, call.silences, time.monotonic() - t0
    except Exception as e:
        return False, [], repr(e)


async def main(a):
    voices = {s: spoken(a.engine, s) for s in SCRIPT if not set(s) <= set("0123456789*#")}
    res = await asyncio.gather(*(one(a.url, i, voices) for i in range(a.calls)))
    done = sum(r[0] for r in res)
    sil = [s for r in res for s in r[1]]
    secs = [r[2] for r in res if isinstance(r[2], float)]
    print(f"| Simultaneous calls | Finished | Silence after spoken answer p50 | p95 | max | Call length |")
    print(f"|---|---|---|---|---|---|")
    print(f"| {a.calls} | {done}/{a.calls} | {pct(sil, 50)} ms | {pct(sil, 95)} ms | "
          f"{pct(sil, 100)} ms | {pct(secs, 50)} s |")
    errors = [r[2] for r in res if not isinstance(r[2], float)]
    if errors:
        print("  errors:", errors[:3])


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--url", default="ws://localhost:8000/stream")
    p.add_argument("--engine", default="http://localhost:8001")
    p.add_argument("--calls", type=int, default=10)
    asyncio.run(main(p.parse_args()))
