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

## Talk to it yourself (browser softphone, no Exotel, no credits)

Start `ai/` (see `ai/README.md`, `ASR_PROVIDER=sarvam` or `vosk` for speech), then:

```bash
SOFTPHONE=1 uv run uvicorn ivr.server:app --port 8765
```

Open `http://localhost:8765/softphone?token=<STREAM_TOKEN>` (drop `?token=` if no token is
set), press **Call**, allow the microphone, answer out loud or on the keypad. It speaks the
same protocol as Exotel, so this is the real adapter path. Each page load uses a new caller
number; type an old one to test resume. Without headphones the page mutes your mic while a
prompt plays; tick "headphones" to test talking over prompts.

Real phone calls through Exotel: `docs/Prashant/ivr/06-exotel-setup.md`.

## Settings

`channels/ivr/.env` (gitignored, read at start-up; template `.env.example`). The ones that
matter first: `STREAM_TOKEN` (required once the adapter is public) and `ENGINE_URL`.
`EXOTEL_*` and `MISSED_CALL_SECRET` only for callbacks. Test-call debugging only:
`IVR_DEBUG_DIR=<dir>` saves each caller utterance as a WAV.

## Tests

```bash
uv run --extra dev pytest -q
```


## Prompts

`prompts/hi/*.wav` are recorded in the engine's voice (Piper, free and local, by default). The wording
lives in `ai/engine/prompts.py`; after changing it, run the engine and re-render (only changed prompts are redone; `--voice gtts` for the free placeholder voice):

```bash
uv run --extra prompts python tools/make_prompts.py --engine http://localhost:8011
```

A native-speaker recording of the same files is still the goal before a pilot.
