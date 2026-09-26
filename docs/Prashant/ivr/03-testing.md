# IVR channel — testing plan

Owner: Prashant · 2026-09-26 · What we test, how, and the bar to pass. Build details in
[02-build.md](02-build.md).

---

## 1. Principles

- **Test without paying.** The fake Exotel client and stub engine cover everything except
  the real phone network. Real calls are the last layer, not the first.
- **Real audio, not clean audio.** Fixtures are recorded on feature phones, outdoors, with
  noise and dialect — the conditions the product lives in.
- **Every bug found on a real call becomes a fixture.** Record it, add it, never regress.
- **Measure, then claim.** Nothing goes on a slide that is not in a test report.

---

## 2. Test layers

| Layer | What | Tool | When | Stage |
|---|---|---|---|---|
| Unit | Frame parsing, base64/PCM, VAD endpoint, pacing, HMAC, config | `pytest` | Every change | Demo |
| Component | One full call against `stub_engine.py` via `fake_exotel.py` | `pytest-asyncio` | Every change | Demo |
| Integration | Adapter + real `ai/` with audio fixtures | same, `ENGINE_URL` real | Daily once `ai/` exists | Demo |
| Real call | Human dials the Exotel number | checklist (§5) | Weekly, then before every demo | Demo |
| Accuracy | Dialect test set through the full path | script, report | Once per language/dialect change | Demo |
| Load | Many simultaneous fake calls | `fake_exotel.py --parallel N` | Before pilot | Final |
| Security/privacy | No raw numbers/audio stored; consent enforced | review + grep of logs/DB | Before pilot | Final |

---

## 3. Fixtures (`samples/`)

Raw audio is gitignored; `samples/manifest.csv` is committed (file, language, speaker id,
phone type, noise level, expected field value).

| Set | Size | Content |
|---|---|---|
| Clean Hindi | 20 | Each question answered clearly |
| Noisy Hindi | 20 | Road, market, fan, TV, children |
| Bhojpuri | 30 | The dialect accuracy set (native speakers, consent recorded) |
| Edge | 20 | Silence, cough only, very long answer, whisper, laughing, "hello? hello?" |
| Keypad | scripted | DTMF sequences for every `dtmf_map` |
| Real-call bugs | grows | Every failure from §5 |

---

## 4. Scenario list (component + integration)

Each is one scripted fake call. ✓ = must pass for demo.

| # | Scenario | Expected | Demo |
|---|---|---|---|
| 1 | Happy path, Hindi, all fields confirmed | Result spoken; `terminal=true` | ✓ |
| 2 | Caller interrupts every prompt | `clear` sent < 200 ms each time; no lost answer | ✓ |
| 3 | Caller silent after a question | Nudge at 6 s, second nudge, then polite goodbye; session resumable | ✓ |
| 4 | Answer confirmed by key 1 instead of voice | Accepted | ✓ |
| 5 | Two failed understandings | Keypad options offered | ✓ |
| 6 | Hang up at Q4 | Engine told; next call resumes at Q4 | ✓ |
| 7 | Engine returns 500 | Spoken apology + callback logged; no silence > 3 s | ✓ |
| 8 | Engine slow (2 s) | Filler plays at 700 ms; call continues | ✓ |
| 9 | Engine slow 3 times in one call | Call switches to keypad-only | ✓ |
| 10 | Unknown Exotel event | Logged, ignored, call continues | ✓ |
| 11 | WebSocket drops without `stop` | Treated as hang-up | ✓ |
| 12 | 15 s monologue | Forced endpoint; answer processed | ✓ |
| 13 | Cough / click only | Discarded as < 250 ms; no turn sent | ✓ |
| 14 | Two missed calls in 60 s | One callback | ✓ |
| 15 | Missed call webhook without secret | Rejected 403 | ✓ |
| 16 | Side question ("paisa milega?") | Engine answers from fact sheet, returns to same question | ✓ |
| 17 | One sentence answers three fields | Engine fills them, adapter plays confirms | ✓ |
| 18 | Disability disclosed | Guardian-consent branch prompts | ✓ |
| 19 | Language switch mid-call (key) | Prompts switch language from next turn | Final |
| 20 | 50 parallel calls | No call over 1.8 s p95 silence; no dropped frames | Final |

---

## 5. Real-call checklist

Run from at least three phones: a ₹1,000 feature phone, a cheap Android, and one on 2G/
weak signal. Each run logs to a sheet: date, phone, network, place, result, latency p50/p95,
issues.

- [ ] Missed call → callback rings in < 10 s
- [ ] Caller not charged for the missed call
- [ ] Language menu understood first time
- [ ] Every question audible, not clipped at start or end
- [ ] Interrupting works; no talking-over
- [ ] Confirmations feel natural, not robotic (ask the caller)
- [ ] Dropped call (walk out of signal) → resumes on redial
- [ ] Full interview under 5 minutes
- [ ] Result sounds correct to the caller
- [ ] Caller rating 1–5: "would you use this again?"

Demo bar: **20 real calls, ≥ 18 completed, average rating ≥ 4.**

---

## 6. Accuracy tests

For each language/dialect set, run fixtures through the full path and report:

| Metric | Meaning | Demo target |
|---|---|---|
| Speech-to-text WER | Raw word error | Report only (expected 25–60%) |
| **Field accuracy after confirmation** | Saved value = true value | **≥ 95%** |
| First-try understanding | Correct before any re-ask | ≥ 70% Hindi, report Bhojpuri |
| Keypad fallback rate | Turns that needed keys | ≤ 15% |
| AI-helper rate | Turns that needed the AI step | ≤ 30% |

The slide shows WER next to field accuracy: bad transcription, correct answers. That gap is
the whole design.

---

## 7. Latency tests

From `metrics.py` logs over integration runs and real calls:

| Metric | Demo target |
|---|---|
| Silence after caller stops, p50 | ≤ 800 ms |
| Silence after caller stops, p95 | ≤ 1,800 ms |
| Barge-in stop time | ≤ 200 ms |
| Missed call → ring | ≤ 10 s |

Any turn over 1,800 ms is investigated by stage (endpoint / engine / first audio). See
[04-optimization.md](04-optimization.md).

---

## 8. Privacy checks (before any real-user call)

- [ ] Grep logs and DB for 10-digit numbers → none
- [ ] No WAV/PCM written anywhere by the adapter (check temp dirs after a call)
- [ ] Consent refused → call ends, no fields saved
- [ ] Test-set speakers signed consent for recording

---

## 9. Stage gates

| Gate | Needs |
|---|---|
| Use Exotel trial | Scenarios 1–15 pass on fake Exotel |
| Show to team/mentor | 1–18 pass + 5 real calls |
| SIH demo | All demo ✓ + §5 bar + §6 and §7 targets + privacy checks + backup video |
| Pilot | Everything above + 19–20 + load + security review |
