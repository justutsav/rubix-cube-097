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
