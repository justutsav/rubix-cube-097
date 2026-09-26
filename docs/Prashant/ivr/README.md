# IVR channel — Prashant

Everything about the phone channel, from demo to final. Read in order.

| Doc | Answers |
|---|---|
| [01-master-plan.md](01-master-plan.md) | What and why: requirements coverage, design, languages, cost, risks, timeline |
| [02-build.md](02-build.md) | How to build it: code layout, contracts, each module, setup, deploy |
| [03-testing.md](03-testing.md) | How we prove it works: test layers, scenarios, real-call checklist, stage gates |
| [04-optimization.md](04-optimization.md) | How we keep it fast, cheap and reliable: targets, levers, review loop |

New docs continue the numbering (`05-…`). Update the log below with every piece of work,
per `CONTRIBUTING.md`.

## Progress log

| Date | Stage | What happened |
|---|---|---|
| 2026-09-26 | Planning | Master plan, build doc, testing plan, optimization plan written. Nothing built yet |
| 2026-09-26 | Build step 1 | `channels/ivr/`: Exotel frame parser (`ivr/exotel.py`), WebSocket server logging every event (`ivr/server.py`), fake Exotel client (`tools/fake_exotel.py`), 2 tests passing. Branch `prashant/ivr-build` |
| 2026-09-26 | Build step 2 | `ivr/audio.py`: 20 ms framing + `Player` that sends at real-time pace, 100 ms ahead, with end-of-clip marks. Server echoes caller audio (temporary). Fake Exotel now listens and reports pacing: 2 s audio heard over 1.9–2.1 s, max frame gap 22 ms. 5 tests passing |
| 2026-09-26 | Build step 3 | Call loop: `ivr/call.py` (turn loop), `ivr/engine.py` (`/v1/turn` client, phone HMAC), `ivr/prompts.py` (in-memory prompt bank), `ivr/vad.py` (webrtcvad endpointing, pulled forward from step 4), `tools/stub_engine.py` (fixed 9-turn script). 13 placeholder Hindi prompts (macOS voice). Fake Exotel now acts as a caller: full 9-turn call completes, adapter hangs up after goodbye; reply began ~150 ms after the answer audio ended (stub engine, localhost). 9 tests passing |
| 2026-09-26 | Steps 4–7, 10 | **Cross-platform:** macOS `say` removed; prompts now from gTTS + miniaudio (no account), silence-trimmed; all commands via `uv run`; CI runs tests on Linux, Windows, macOS (`.github/workflows/ivr.yml`). **Step 4:** VAD tested on synthetic noise: answer found at 30/20/15 dB SNR, noise alone never taken as an answer, quiet speakers (−20/−30 dB) heard. At 10 dB SNR aggressiveness 2 misses speech (3 catches it but loses quiet speakers) — kept 2, caller falls to nudge/keypad; retune on real village recordings. **Step 5:** barge-in stops the prompt (`clear`) and the interrupting speech becomes the answer; key press also interrupts. **Step 6:** no-input sends a `timeout` turn; 10-min call cap says goodbye locally. **Step 7:** "hmm" filler if the engine takes > 700 ms; engine error → local apology + hang-up, never silence; one JSON metrics line per turn. **Step 10:** `/missed-call` (secret key, 60 s dedupe) + Exotel Call API callback with retries, tested against a mock. Live fake call: 9 turns, silence after answer p50 327 ms (stub engine); barge-in run: 7 interruptions, no lost answers. 28 tests passing. Remaining steps need signups (Exotel trial, hosting) or the real `ai/` |
| 2026-09-26 | Step 8 + engine | **Engine built (`ai/`)** — see `docs/Prashant/engine/01-engine.md`. Adapter now plays the engine's spoken result: split into sentences, fetched in parallel, played in order, the end marker always sent even if a sentence fails. Prompts are rendered from the engine's catalogue (`GET /v1/prompts/hi`, 140 prompts, only changed ones re-rendered). Fake caller gained `--keys`, `--script` (spoken lines via the engine's voice) and `--phone`. Live: full keypad interview, full spoken interview (Vosk offline), and redial-with-PIN all complete. 29 IVR tests |

