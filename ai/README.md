# ai/ — the interview engine

One service every channel talks to over HTTP. It owns the questions, understanding
answers, eligibility and recommendations. Channels (`channels/ivr`, later WhatsApp and
the kiosk) only move audio and keys. Design: `docs/Prashant/engine/01-engine.md`.

Works the same on Linux, Windows and macOS. Needs only [uv](https://docs.astral.sh/uv/).

## Run

```bash
uv run --extra tts uvicorn engine.server:app --port 8001
```

With free offline speech-to-text (no account, ~80 MB model, one-time download):

```bash
uv run python tools/get_vosk_model.py
```
```bash
ASR_PROVIDER=vosk uv run --extra tts --extra vosk uvicorn engine.server:app --port 8001
```

(Windows PowerShell: `$env:ASR_PROVIDER="vosk"` first.)

Then start the IVR adapter and a fake call — see `channels/ivr/README.md`.

## Tests

```bash
uv run --extra dev pytest -q
```

## Data (all committed, all sourced)

| File | What | Source |
|---|---|---|
| `data/nqr.json` | 2,814 NSQF qualifications | nqr.gov.in export, `tools/import_nqr.py` (sha256 inside) |
| `data/nsqf_entry.json` | Entry requirements per level | NSQF 2023 gazette |
| `data/lexicon.json` | Spoken words → trades, education, yes/no… | authored; no course codes |
| `data/weights.json` | Ranking weights, versioned | authored judgement calls |
| `data/districts.json` | Pilot districts for Q0 | **placeholder** choice |

Refresh the register: `uv run --extra nqr python tools/import_nqr.py`

## Settings (environment)

| Name | Default | |
|---|---|---|
| `ENGINE_DB` | `ai/.storage/engine.db` | SQLite file (`:memory:` for tests) |
| `PHONE_PEPPER` | `dev-only-pepper` | secret for PIN hashes; same value as the IVR adapter |
| `ASR_PROVIDER` | `none` | `none` = keypad menus only · `vosk` = offline · `sarvam` = cloud, falls back to Vosk then keypad |
| `ASR_TIMEOUT_MS` | `2000` | Sarvam slower than this → fall back |
| `SARVAM_API_KEY` | — | put it in `ai/.env` (gitignored); read at start-up |
| `SARVAM_STT_MODEL` | `saarika:v2.5` | |
| `TTS_PROVIDER` | `gtts` | `gtts` = dev voice · `sarvam` = Bulbul, falls back to gtts |
| `SARVAM_TTS_MODEL` / `SARVAM_TTS_SPEAKER` | `bulbul:v3` / Sarvam default | |
| `LLM_PROVIDER` | `none` | AI helper for unmatched answers (needs an account) |
| `ENGINE_LANGS` | `hi` | e.g. `hi,bho` asks for the language at call start (Bhojpuri is a draft) |
| `ENGINE_LOG_TRANSCRIPTS` | unset | `1` logs what was heard per answer — **test calls only** |
