"""Latency report from the adapter's per-turn metrics lines (ivr/metrics.py).

    uv run uvicorn ivr.server:app --port 8000 2> adapter.log      # run some calls, then:
    uv run python tools/latency.py adapter.log

Perceived silence after a spoken answer = end-of-speech wait (ENDPOINT_SILENCE_MS)
+ engine time (speech-to-text + understanding + reply). Keys have no end-of-speech wait.
Target (04-optimization.md): p50 <= 800 ms, p95 <= 1,800 ms.
"""

import json
import os
import sys
from pathlib import Path

ENDPOINT_MS = int(os.environ.get("ENDPOINT_SILENCE_MS", 240))


def pct(xs, p):
    xs = sorted(xs)
    return xs[min(len(xs) - 1, int(round(p / 100 * (len(xs) - 1))))] if xs else None


def load(paths):
    rows = []
    for path in paths:
        for line in Path(path).read_text(encoding="utf-8", errors="replace").splitlines():
            i = line.find('{"call"')
            if i >= 0:
                try:
                    rows.append(json.loads(line[i:]))
                except json.JSONDecodeError:
                    pass
    return rows


def report(rows):
    out = ["| Turn kind | Turns | Engine p50 | Engine p95 | Perceived silence p50 | p95 | max |",
           "|---|---|---|---|---|---|---|"]
    for kind in ("audio", "dtmf", "timeout", "opened"):
        r = [x for x in rows if x.get("kind") == kind and "fallback" not in x]
        if not r:
            continue
        eng = [x["engine_ms"] for x in r]
        wait = ENDPOINT_MS if kind == "audio" else 0
        per = [e + wait for e in eng]
        out.append(f"| {kind} | {len(r)} | {pct(eng, 50)} ms | {pct(eng, 95)} ms | "
                   f"{pct(per, 50)} ms | {pct(per, 95)} ms | {max(per)} ms |")
    calls = {x["call"] for x in rows}
    out += ["",
            f"Calls: {len(calls)} · turns: {len(rows)} · "
            f"'hmm' filler played: {sum(bool(x.get('filler')) for x in rows)} · "
            f"barge-ins: {sum(bool(x.get('barge_in')) for x in rows)} · "
            f"engine failures: {sum('fallback' in x for x in rows)}"]
    return "\n".join(out)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    print(report(load(sys.argv[1:])))
