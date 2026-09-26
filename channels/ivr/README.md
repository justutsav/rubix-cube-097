# channels/ivr

Exotel Voicebot WebSocket ⇄ `ai/` turn API. Transport only: no questions, no business
logic. Plan and design: `docs/Prashant/ivr/`.

Works the same on Linux, Windows and macOS. Needs only [uv](https://docs.astral.sh/uv/)
(it fetches Python 3.11 itself). CI runs the tests on all three: `.github/workflows/ivr.yml`.

## Run a full fake call (no Exotel account, no `ai/` needed)

Three terminals, all inside `channels/ivr`:

```bash
uv run uvicorn tools.stub_engine:app --port 8001
```
```bash
uv run uvicorn ivr.server:app --port 8000
```
```bash
uv run --extra dev python tools/fake_exotel.py --dtmf 1
```

Add `--barge-in` to the last one to have the caller talk over every prompt.

## Talk to it yourself (browser softphone, no Exotel)

Start `ai/` (see `ai/README.md`, with `ASR_PROVIDER=vosk` for speech), then:

```bash
SOFTPHONE=1 uv run uvicorn ivr.server:app --port 8000
```

Open http://localhost:8000/softphone, press **Call**, allow the microphone, and answer
out loud or on the on-screen keypad. It speaks the same protocol as Exotel, so this is
the real adapter path. Without headphones the page mutes your mic while a prompt plays
(otherwise the speaker would interrupt itself); tick "headphones" to test talking over prompts.

## Tests

```bash
uv run --extra dev pytest -q
```

## Settings

Read from the environment; defaults in `.env.example`. None are needed for the fake call.
`EXOTEL_*` and `MISSED_CALL_SECRET` are only needed for a real phone number.

## Prompts

`prompts/hi/*.wav` are **placeholders** (Google Translate voice via gTTS, no account).
Regenerate after editing the text in `tools/make_prompts.py`:

```bash
uv run --extra prompts python tools/make_prompts.py
```

Replace with native-speaker recordings before any real user hears them.
