# channels/ivr

Exotel Voicebot WebSocket ⇄ `ai/` turn API. Transport only: no questions, no business
logic. Plan and design: `docs/Prashant/ivr/`.

## Run a full fake call (no Exotel account, no `ai/` needed)

```bash
uv venv -p 3.11 .venv && uv pip install -p .venv -e ".[dev]"
```
```bash
.venv/bin/uvicorn tools.stub_engine:app --port 8001
```
```bash
.venv/bin/uvicorn ivr.server:app --port 8000
```
```bash
.venv/bin/python tools/fake_exotel.py --dtmf 1
```

Tests: `.venv/bin/pytest -q`

Config: see `.env.example` (read from the environment).

`prompts/hi/*.wav` are **placeholders** from the macOS Lekha voice
(`tools/make_placeholder_prompts.py`). Replace with native-speaker recordings.
