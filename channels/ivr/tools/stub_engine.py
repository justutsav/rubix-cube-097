"""Stand-in for ai/ so the IVR can be built before the real engine exists.

Implements POST /v1/turn with a fixed script: welcome + consent, then q1..q7, then
the result. Any answer (audio or key) moves one step forward. No understanding at all.

    uvicorn tools.stub_engine:app --port 8001
"""

from fastapi import FastAPI

app = FastAPI(title="stub engine")

SCRIPT = [["welcome", "consent"]] + [["ack", f"q{i}"] for i in range(1, 8)] + [["ack", "result", "goodbye"]]
_pos: dict[str, int] = {}


@app.post("/v1/turn")
def turn(body: dict):
    ref = body["channel_ref"]
    kind = body["utterance"]["kind"]
    if kind == "hangup":
        _pos.pop(ref, None)
        return {"state": "HANGUP", "say": [], "terminal": True}
    i = 0 if kind == "opened" else _pos.get(ref, 0) + 1
    i = min(i, len(SCRIPT) - 1)
    _pos[ref] = i
    last = i == len(SCRIPT) - 1
    return {
        "session_id": f"stub-{ref}",
        "state": "DONE" if last else ("CONSENT" if i == 0 else f"Q{i}"),
        "say": [{"kind": "prerendered", "id": p} for p in SCRIPT[i]],
        "expect": {"kind": "free", "timeout_ms": 6000},
        "terminal": last,
    }
