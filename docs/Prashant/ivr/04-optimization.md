# IVR channel — optimization plan

Owner: Prashant · 2026-09-26 · How we keep calls fast, cheap and reliable. Measure first
(see [03-testing.md](03-testing.md) §6–7), then change one thing, then measure again.

---

## 1. Targets

| Area | Target |
|---|---|
| Silence per turn | p50 ≤ 800 ms, p95 ≤ 1,800 ms |
| Barge-in | ≤ 200 ms |
| Callback | ≤ 10 s |
| Cost per interview (final) | ≤ ₹4.50 |
| Call length | ≤ 5 min (fewer minutes = lower cost) |
| Completion rate | ≥ 85% of started calls finish |
| AI-helper use | ≤ 30% of turns |

---

## 2. Latency — built in from day one

These are in the design, not later tweaks:

1. **Pre-recorded prompts in memory.** No text-to-speech and no disk read on the hot path.
2. **Word list before AI.** ~70% of answers resolved in ~5 ms.
3. **Adapter and engine on the same machine**, engine call over localhost with a kept-alive
   HTTP connection.
4. **Everything in one region (Mumbai)**, speech-to-text provider included.
5. **Filler "hmm…" after 1 s** so any slow turn still feels human (700 ms fired on most Sarvam turns in real calls).
6. **Real-time paced playback**, so interruption stops audio immediately.

---

## 3. Latency — levers to pull if measurements say so

In order of cost to try. Only pull a lever when a stage in the metrics log is the problem.

| If this stage is slow | Try | Expected gain |
|---|---|---|
| End-of-speech wait | Lower `ENDPOINT_SILENCE_MS` 240 → 180 for yes/no questions only | ~60 ms |
| End-of-speech wait | Stream audio to speech-to-text **while** the caller talks; final result ~100 ms after endpoint | 200–500 ms |
| Speech-to-text | Switch provider per language by measured speed; keep a warm connection | 100–300 ms |
| AI helper | Shorter prompt, smaller model, JSON-only output, max tokens ~20 | 200–600 ms |
| AI helper | Start the AI call in parallel with the word-list lookup; cancel if the list wins | 300–800 ms on misses |
| Confirmation | Pre-record "you said <X>, right?" for every value in every closed list (hundreds of short clips) → no TTS at all | 300–700 ms on confirms |
| Result tail | Start TTS for the result as soon as the last field is confirmed, while "let me check" plays | 500+ ms |
| First question | Pre-fetch `opened` turn while the callback is ringing | ~300 ms at call start |

---

## 4. Cost

Where the money goes per interview (~₹4.15): telephony ~37%, speech/AI ~63%.

| Lever | Saves |
|---|---|
| Shorter prompts (every second of prompt is billed call time) | Target 2–4 s per question |
| Skip questions already answered in a multi-field sentence | ~1 turn per call |
| Send only speech to speech-to-text (VAD trims silence) | 30–50% of speech-to-text minutes |
| Word list first; AI only on misses | Most AI calls |
| Pre-recorded confirmations and result phrases | Most TTS spend |
| Bhashini instead of Sarvam where accuracy is equal | Speech-to-text cost → ~₹0 |
| Missed call + callback on a normal number, not toll-free | ~45–70% of telephony |
| No always-on GPU until > ~47,700 interviews/month | ~₹4 lakh/year fixed |
| Cap call at 10 min; polite end if stuck | Tail of runaway calls |

---

## 5. Reliability

| Risk | Optimization |
|---|---|
| Speech-to-text provider outage | Automatic switch to second provider after 1 failure or > 2 s; health-checked every minute |
| AI provider outage | Circuit breaker: after 3 failures in a minute, skip AI for 5 min (word list + keypad only) |
| Engine restart mid-call | State saved per turn in DB; adapter retries the turn once |
| Host crash | Health-check auto-restart; Exotel flow shows apology prompt if WebSocket fails |
| Peak load | One box handles ~N calls (measured in load test); scale by adding boxes behind Exotel's flow URL |

---

## 6. Quality (the "empathetic" requirement)

Measured in real calls, improved every week:

- Listen to 10 recorded-with-consent test calls a week; rewrite the 3 worst-sounding prompts.
- Track which question has the most re-asks → rewrite that question, not the code.
- Track where callers hang up → shorten or soften that step.
- Keep each prompt ≤ 2 short sentences; confirmations ≤ 1.

---

## 7. What we will not optimize yet

- Own GPU / self-hosted speech model — only for the offline demo, not production, until volume justifies it.
- Custom VAD models — webrtcvad until tests show it fails.
- Multi-region hosting — one Mumbai region is enough for a pilot.
- Microservices, queues, Kubernetes — one process per box until load tests say otherwise.

---

## 8. Review loop

Weekly during the demo stage:
1. Pull `metrics.py` logs → p50/p95 per stage, AI rate, fallback rate, completion rate.
2. Pick the single worst number.
3. Pull one lever from §3–§6.
4. Re-run fixtures + 5 real calls; record before/after in [README.md](README.md) log.
