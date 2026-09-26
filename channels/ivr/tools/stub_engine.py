"""Stand-in for ai/ so the IVR can be built before the real engine exists.

Implements POST /v1/turn with a fixed script: welcome + consent, then q1..q7, then
the result. Any answer (audio or key) moves one step forward. No understanding at all.
Silence: first time, nudge and repeat the question; second time in a row, say goodbye.

    uv run uvicorn tools.stub_engine:app --port 8001
"""

from fastapi import FastAPI

app = FastAPI(title="stub engine")

SCRIPT = [["welcome", "consent"]] + [["ack", f"q{i}"] for i in range(1, 8)] + [["ack", "result", "goodbye"]]
_pos: dict[str, int] = {}
_silent: dict[str, int] = {}


def reply(state, say, terminal=False):
    return {"state": state, "say": [{"kind": "prerendered", "id": p} for p in say],
            "expect": {"kind": "free", "timeout_ms": 6000}, "terminal": terminal}


@app.post("/v1/turn")
def turn(body: dict):
    ref = body["channel_ref"]
    kind = body["utterance"]["kind"]
    if kind == "hangup":
        _pos.pop(ref, None)
        _silent.pop(ref, None)
        return reply("HANGUP", [], terminal=True)

    if kind == "timeout":
        _silent[ref] = _silent.get(ref, 0) + 1
        if _silent[ref] >= 2:
            return reply("NO_INPUT", ["goodbye"], terminal=True)
        return reply("NUDGE", ["nudge", SCRIPT[_pos.get(ref, 0)][-1]])

    _silent[ref] = 0
    i = 0 if kind == "opened" else min(_pos.get(ref, 0) + 1, len(SCRIPT) - 1)
    _pos[ref] = i
    last = i == len(SCRIPT) - 1
    return reply("DONE" if last else ("CONSENT" if i == 0 else f"Q{i}"), SCRIPT[i], last)
