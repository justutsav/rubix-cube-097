# IVR channel — master plan, demo to final

Owner: Prashant · Written 2026-09-26 · Status: planning, nothing built.

Companion docs: [02-build.md](02-build.md) (how to build it) ·
[03-testing.md](03-testing.md) (how we prove it works) ·
[04-optimization.md](04-optimization.md) (how we keep it fast and cheap).

Builds on `docs/Utsav/research/05-technical-spec.md` (§1 turn contract, §2 extraction ladder,
§3 IVR, §9 costs, §10 build order) and `docs/decisions.md`. If this file conflicts with
either, the conflict is flagged in §12 — it is not silently resolved.

---

## 1. What we are building, in one paragraph

A person with a basic keypad phone gives a **missed call** to our number. We call them back
for free. A warm, pre-recorded voice in their language asks about their life and work — the
seven things the problem statement names — and the person just talks. The system
understands them even through a bad line and a strong dialect, reads every answer back for
a yes/no, and at the end tells them which **NSQF course they can actually join**, what they
are missing if they can't yet, and what work exists near them. If the call drops, the next
call picks up at the same question. Every answer also flows into the district officer's
demand report.

---

## 2. What the problem statement asks, and how the IVR meets it

| # | Requirement (PS 26097) | How the IVR meets it | Demo | Final |
|---|---|---|---|---|
| R1 | Voice conversation replaces the form | The whole call is spoken; keypad is only a backup | ✓ | ✓ |
| R2 | Regional languages **and dialects** | Language pick at call start; prompts recorded per language; dialect words absorbed by the trade-name list; **dialect accuracy measured and published, never claimed** (§5) | Hindi + Bhojpuri-lexicon | 7 languages + 4 dialects |
| R3 | Seven named fields, in order | Fixed question flow in `ai/`; the IVR never holds its own copy | ✓ | ✓ |
| R4 | Courses · pathways · skill gaps · local opportunities | Spoken result: eligible course, near-miss with exact gap, one local opportunity | ✓ (1 district) | ✓ (pilot districts) |
| R5 | IVR for feature phones | Missed call → callback on any phone, no data needed | ✓ | ✓ |
| R6 | Low-connectivity, low-tech | Plain voice call over 2G; nothing to install; keypad fallback | ✓ | ✓ |
| R7 | Empathetic, not administrative | Native-speaker-written prompts, short turns, "hmm" filler while thinking, caller can interrupt, never "invalid input" | ✓ | ✓ |
| R9 | Officer-side "Basic Issues" | Every confirmed answer lands in the shared DB that feeds the district demand report | data only | ✓ |
| — | DPDP Rules 2025 | Spoken consent as a flow step; audio deleted after confirmation; guardian path on disability | ✓ | ✓ |
| — | TRAI rules | Demo: inbound only. Final: DLT Principal Entity + 1600-series + auto-dialer declaration | — | ✓ |

R8 (an "app") is the kiosk channel, not the IVR. It reuses the same engine.

---

## 3. The design: fixed skeleton, AI only where it earns its place

**Fixed (no AI, never changes during a call):** question order (language → village/block →
consent → the seven fields → result), consent wording, recorded prompts, eligibility rules,
official course codes, when to fall back to the keypad. An answer is saved only after the
caller confirms it.

**AI steps in only when the cheap method fails:**

| Where | Trigger | What the AI does | Limit |
|---|---|---|---|
| Understanding an answer | Trade-name list and patterns found no match | Picks one value from the fixed list + confidence | 1 s, else re-ask |
| Follow-up | Answer too vague ("some work") | Chooses one pre-written follow-up | 1 s, else generic re-ask |
| Several answers at once | One sentence covers more than one field | Fills them; flow skips ahead but still confirms each | — |
| Side question | "Will I get money?", "Who are you?" | Answers from an approved fact sheet, then returns to the same question | fact sheet only |
| Final result | Always | Words the (already chosen) recommendation in plain language | never picks the course |

The AI proposes; the fixed flow decides. It cannot skip consent, add a question, or invent
a course. Every AI call is logged as (what was heard → what it chose → confidence). Target:
AI on **≤ 30% of turns**.

---

## 4. How one call works

```
Caller ─ missed call ─▶ Exotel number ─ webhook ─▶ channels/ivr  POST /missed-call
                                                      │ Exotel Call API: call back, flow = Voicebot
Exotel Voicebot applet ◀──── WebSocket (8 kHz audio both ways) ────▶ channels/ivr adapter
                                                      └─▶ ai/  POST /v1/turn (audio or key press)
                                                             ├─ speech-to-text (Sarvam / Bhashini)
                                                             └─ flow + matching → next prompt ids
```

1. **Missed call** → hash the phone number (never store it raw) → look up an unfinished
   session → call back within ~10 s.
2. **Language**: default guessed from the caller's telecom circle, confirmed by one key
   press ("Hindi ke liye 1, Bhojpuri ke liye 2 …").
3. **Village/block** (needed for district grouping), then **spoken consent**.
4. **Each question**: play recording → detect end of speech → send audio to `/v1/turn`
   (the engine runs speech-to-text, top 5 guesses) → play "you said X, right?" → yes by
   voice or key 1.
   - Unsure → re-ask differently. Twice unsure → keypad options. Still stuck → mark field
     "needs follow-up" and move on (a human worker completes it later — assisted mode).
5. **Result**: eligible course + gap + local opportunity. Offer an SMS summary.
6. **Hang-up at any point**: unconfirmed audio discarded, session marked resumable.

The adapter is **transport only**: no questions, no business logic, no speech-to-text.
Speech-to-text lives in `ai/` because WhatsApp needs the exact same step.

---

## 5. Languages and dialects

| | Demo | Final (pilot) |
|---|---|---|
| Languages | Hindi | Hindi, Bengali, Punjabi, Marathi, Odia, Tamil, Telugu (states with the largest SC populations) |
| Dialects | Bhojpuri via Hindi speech-to-text + Bhojpuri trade-name list, **measured** | Bhojpuri, Magahi, Chhattisgarhi, Rajasthani — same method, each with its own word list and native-speaker prompts |
| Speech-to-text | Sarvam (supports 10+ Indian languages) | Sarvam or Bhashini per language, chosen by measured accuracy |
| Prompts | Hindi, recorded once | Per language; dialect prompts recorded by a native speaker |

**The honest line for judges:** no speech model exists for Bhojpuri, Magahi, Chhattisgarhi
or Rajasthani anywhere. We run the nearest language's model, absorb errors with a dialect
word list and sound-alike matching, confirm every answer, and **show the measured
accuracy** on a 30-sentence test set per dialect. Adding a language = recording prompts +
building a word list + one config line. No code change.

---

## 6. Latency — target under 1.8 s of silence per turn

| Step | Time | How we keep it low |
|---|---|---|
| Detect end of speech | 240 ms | VAD on 20 ms frames, 12 silent frames |
| Speech-to-text | 300–800 ms | Streaming API, India region, domain words primed |
| Understanding | 5 ms (list) / 400–1,000 ms (AI) | List handles ~70%; AI only on misses, capped at 1 s |
| Pick the reply | ~5 ms | Fixed flow |
| Start playing | ~10 ms | Prompts pre-recorded and held in memory; no text-to-speech on the hot path |
| **Total** | **~0.6 s typical, ~1.8 s worst** | When AI runs, a 300 ms "hmm…" plays over it |

Also:
- **Interrupting:** the caller can talk over a prompt; we stop playback within 200 ms.
- **Callback delay:** under 10 s from the missed call.
- Everything (adapter, engine, DB) runs in **one region (Mumbai)**, same box for the demo.
- Every turn logs time per step. That log is the latency slide.

---

## 7. Cost

### Demo (next 4–6 weeks): about ₹0–2,000

| Item | Cost |
|---|---|
| Exotel trial number + credits | Free trial |
| Sarvam speech-to-text + text-to-speech (prompt recording) | Signup credits |
| Cloud AI model (small) | Free credits; < ₹0.50/call after |
| Hosting (Render/Railway/Fly free tier) + ngrok | Free |
| Postgres (Supabase/Neon free tier) | Free |
| Everything else (FastAPI, VAD, fuzzy matching, NQR data) | Free, open source / public |

### Final (per interview, 4 min, ~11 turns)

| Item | Cost |
|---|---|
| Callback call on a normal number (streaming included) | ~₹1.52 |
| Speech-to-text + AI + result text-to-speech | ~₹2.63 |
| **Total per interview** | **~₹4.15** |
| Fixed per year (number, small India-region server, DB) | ~₹26,400 + Exotel plan (from ~₹10,000) |

At 1,00,000 interviews a year that is about **₹4.40 per person** all-in.

**Why it's cheap:** pre-recorded prompts (no text-to-speech on most turns), word list before
AI, no always-on GPU (metered APIs; own GPU only past ~47,700 interviews a month), missed
call + callback instead of toll-free, audio not stored.

⚠ Exotel's streaming (AgentStream) price is **not published**. Get it in writing before
quoting any figure on a slide.

---

## 8. Foolproofing — what breaks and what we do

| What goes wrong | What happens |
|---|---|
| Speech-to-text mishears | Top-5 guesses + word list + confirmation; keypad fallback after two misses |
| Speech-to-text API is down or slow (> 2 s) | Switch provider automatically (Sarvam ⇄ Bhashini); if both fail, keypad-only mode for that call |
| AI model down or slow (> 1 s) | Skip it; re-ask with a simpler prompt or keypad options |
| Call drops | Answers saved per person, not per call; next call resumes at the same question |
| Caller silent | Two gentle nudges, then "call back any time", session kept |
| Caller talks over prompt | Playback stops, we listen |
| Background noise | VAD (not volume threshold); if speech never clean, keypad |
| Caller wants a human | Key 0 → log a "call-me-back" request for the district worker |
| Our server crashes mid-call | Session state is in the DB after every turn; restart resumes |
| Exotel streaming unavailable/too costly | Fallback flow on Exotel's basic blocks (play → record → our webhook → keypad) using the same `/turn` API |
| Same person calls twice | Phone hash finds the old session; offers "continue or start over" |
| Disability disclosed | Guardian-consent branch |
| Live demo fails on stage | Pre-recorded video of a real call + laptop-mic version of the same engine |
| Wrong course code | Codes only ever come from the official NQR export; unknown fields stay empty |

Testing before any demo: a **fake Exotel** that replays real recorded calls (noisy,
dialect, interruptions, drops) against the adapter, run on every change.

---

## 9. Tech stack

| Part | Tool | Cost |
|---|---|---|
| Adapter + engine | Python, FastAPI, `websockets` | Free |
| End-of-speech detection | `webrtcvad` (or Silero VAD) | Free |
| Audio handling | `numpy` framing in the adapter; 8 → 16 kHz resample in `ai/` | Free |
| Phone | Exotel: number, missed-call webhook, Call API, Voicebot WebSocket | Trial → paid |
| Speech-to-text | Sarvam (default), Bhashini (sovereign), IndicConformer self-hosted (offline demo only) | Credits / free / GPU |
| Prompt audio | Sarvam Bulbul or Bhashini TTS, rendered once, then hand-fixed | One-time, ~free |
| Matching | RapidFuzz + Double Metaphone | Free |
| AI helper | Small cloud model behind one config switch; Qwen3-8B / Sarvam-30B as self-hosted option | Credits |
| Storage | Postgres | Free tier |
| Hosting | Free tier (demo) → Mumbai-region VM (final) | Free → ~₹2,000/mo |

---

## 10. The plan: demo first, then the full version

### Stage 1 — Demo (4–6 weeks). Target: a real phone call, start to finish, in Hindi.

**Done when:** a stranger gives a missed call, gets called back, finishes the interview in
Hindi, hears a real course with its gap, with < 1.8 s silence per turn, and a dropped call
resumes. Plus a measured accuracy number on 30 Bhojpuri sentences.

| Week | Prashant does | Needs from others |
|---|---|---|
| 0 (now) | Sign up: Exotel trial, Sarvam key, Bhashini. Email Exotel sales (§11 questions). Agree `/turn` contract with AI/ML | AI/ML: `/turn` contract |
| 1–2 | `channels/ivr/`: Exotel message parser, fake Exotel client, VAD, paced playback, interruption, dummy `/turn` | — |
| 3 | Sarvam speech-to-text, provider switch, real `/turn` | AI/ML: engine Phase 1; everyone: Hindi prompts |
| 4 | Exotel trial number via ngrok; missed-call callback | — |
| 5 | Real calls with real people; latency + accuracy logs; fix top 3 failures | Everyone: 30 Bhojpuri test sentences |
| 6 | Record backup demo video; freeze | — |

If the next SIH round is sooner than 6 weeks: fake Exotel + laptop mic + recorded call
video; live phone call saved for the finale.

### Stage 2 — Full version (after SIH selection). Target: 2–3 district pilot.

1. DLT Principal Entity registration, 1600-series number, auto-dialer declaration.
2. Mumbai-region hosting; DB backups; monitoring and alerts.
3. Add languages and dialects one at a time (§5), each with its measured accuracy.
4. SMS summary after the call; key 0 human-callback queue for district workers.
5. Load test: 50 simultaneous calls.
6. Security review: phone hashing, consent log, audio deletion verified.
7. Hand-off routes to PM-DAKSH / SIA where they fit better.

---

## 11. Questions for Exotel (need written answers)

1. AgentStream (Voicebot streaming) price per minute; included in the trial?
2. Outbound callback per-minute rate on a normal number; pulse length.
3. Time from missed call to webhook; time to place the callback.
4. Audio format on our account (`audio/x-l16`, 8 kHz?).
5. Lead time for DLT registration and a 1600-series number.
6. Max simultaneous streamed calls on the plan.

---

## 12. Conflicts to flag

- **The AI role is wider than `decisions.md` allows.** That file says the AI only picks a
  value from a closed list. §3 here adds follow-ups, side questions and multi-field
  answers. Needs a new dated entry in `decisions.md`, agreed with the team.
- **Seven languages for the final** is our choice; the PS names no list. Confirm with the team.
