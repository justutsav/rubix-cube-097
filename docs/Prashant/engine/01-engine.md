# Interview engine (`ai/`) — what is built and how it works

Owner: Prashant · 2026-09-26 · Code: `ai/` · Spec it implements: `docs/Utsav/research/05-technical-spec.md` §1–2.

## 1. In one paragraph

Every channel sends the engine one caller turn (speech, a key press, silence, or a
hang-up) and gets back which pre-recorded prompts to play next. The engine walks a
fixed question flow, turns messy answers into one value from a closed list, confirms
each spoken answer with the caller, saves it against the person (not the call), checks
NSQF eligibility with hard rules, and ranks real courses from the official register. It
never invents a course code and never stores audio, transcripts, raw phone numbers or PINs.

## 2. The call, step by step

```
opened ─▶ known phone with saved progress? ── yes ─▶ RESUME: enter 4-digit PIN (* = new start)
   │                                                     right PIN ─▶ back at the first unanswered question
   │                                                     wrong twice ─▶ new person on the same phone
   no
   ▼
CONSENT (yes / no)  ── no ─▶ polite goodbye, nothing saved
   ▼
PIN_SET (4 keys, so the call can resume later; skipped after 2 failures)
   ▼
q0 district ─▶ q1 education ─▶ q2 family trade ─▶ q2_years ─▶ q3 current work
   ─▶ q4 interests ─▶ q5 constraints ─▶ q6 own work or job ─▶ q7 local demand
   ▼                                  (q5 "cognitive" ─▶ GUARDIAN consent check)
READBACK: all answers once ─▶ 1 = correct · 2 = pick a question (1–7) to change
   ▼
RECOMMEND: top 3 courses + best near-miss with the exact gap, spoken ─▶ DONE
```

Each question uses the same small loop:

| What happens | Engine does |
|---|---|
| Spoken answer understood | Reads it back: "आपने कहा सिलाई, सही है?" |
| Caller says yes / presses 1 | Saves it, next question |
| Caller says no, or corrects ("नहीं, आठवीं") | Re-asks, or confirms the correction |
| Not understood twice | Keypad menu for that question |
| Keypad key | Saved at once, no read-back (keys are exact) |
| Silence twice, or menu fails twice | Skips the question ("बाद में"); asked again on resume |
| No speech-to-text available | Goes straight to the keypad menu |

One sentence can answer two questions: "बारह साल से सिलाई" fills the family trade and
the years, and the years question is skipped.

## 3. Understanding answers (`engine/extract.py`)

Cheapest first; stops at the first hit:

1. **Word list** (`data/lexicon.json`): 26 trades plus education, yes/no, constraints,
   job preference, districts. Each phrase is matched exactly, then after
   Devanagari→Latin transliteration (so `silai` = `सिलाई`), then by a sound-alike key
   (so `दरजी` = `दर्जी`), then by close spelling.
2. **Number patterns**: "आठवीं", "8 तक", "दसवीं पास", "बारह साल".
3. **AI helper** (`engine/llm.py`): only if 1–2 find nothing. Off by default (needs an account).
4. **The caller confirms** whatever was picked.

Guard rails found by testing: sound-alike matching only for single words of 5+ sounds,
and close-spelling only for 6+ letters, because "पता" ≈ "पापड़" and "नहीं" ≈ "नवीं".
The speech-to-text's top 5 guesses are all tried; later guesses count slightly less.

## 4. Eligibility (`engine/eligibility.py`, `data/nsqf_entry.json`)

Straight from the NSQF 2023 entry table. Any one alternative is enough:

| Level | Needs |
|---|---|
| 1, 2 | nothing |
| 2.5 | 9th · 8th + 1 yr · 5th + 4 yrs · reads/writes + 5 yrs |
| 3 | 10th · 9th + 1 yr · 8th + 2 yrs · 5th + 5 yrs |
| 3.5 | 11th · 10th + 1 yr · 8th + 3 yrs |
| 4 | 12th · 11th + 1 yr · 10th + 2 yrs |

Experience only counts for courses in the same trade as the family work. Result per
course: **ELIGIBLE**, **NEAR_MISS** (short by ≤ 2 years of experience or 1 class, with
the exact gap), or out. Levels above 4 are never recommended.

## 5. Recommendations (`engine/recommend.py`, `data/weights.json`)

1. Start from the official register: 2,814 courses; keep valid today and level ≤ 4 (1,199).
2. Drop anything the person is not eligible for.
3. Score what is left, weights written down and versioned:
   family/current work 0.30 · interests 0.30 · local demand 0.15 · own-work vs job 0.10 ·
   disability-friendly sector 0.10 · short course if travel/home duties 0.05 · level 0.05.
   A course matched only in its description counts less than one matched in its title.
4. Top 3, no duplicate titles, at most 2 from one sector; plus the best near-miss.
5. One plain Hindi reason per course. Self-employment adds the PM-AJAY asset-grant line;
   every result mentions the mandatory financial-literacy module.

Every saved recommendation records the weights version and the register's sha256.
No answers → no guess: "a district worker will contact you".

## 6. API

| Endpoint | Does |
|---|---|
| `POST /v1/turn` | One turn in → `say` (prompt ids, or text for TTS), `expect`, `terminal` |
| `GET /v1/prompts/hi` | Every fixed prompt, id → text (the IVR renders these to WAV) |
| `POST /v1/tts` | Spoken result as 8 kHz audio |
| `GET /health` | Providers in use, register size and sha |

Utterance kinds: `opened`, `audio`, `text`, `dtmf`, `timeout`, `hangup`. Requests are
validated at the boundary (key pattern, base64 audio ≤ ~20 s, length limits).

## 7. Measured (2026-09-26, laptop, fake phone call end to end)

| Run | Result |
|---|---|
| Keypad-only interview (no speech-to-text) | 16 turns, completes, recommendation saved |
| Fully spoken interview (Vosk offline, placeholder voice) | every answer understood first time; engine 150–300 ms per turn including speech-to-text |
| Redial on the same phone | PIN → straight to read-back → result |
| Spoken result | split into sentences, fetched in parallel, engine reply 48 ms |
| Tests | 50 engine + 29 IVR, on Linux, Windows, macOS (CI) |

⚠ The spoken run used a clean synthetic voice. Real phone lines and dialects will be
much worse; the dialect test set (testing plan §6) is what gives real numbers.

## 8. Still open (needs an account, data or people)

| Item | Why it matters | Until then |
|---|---|---|
| Cloud speech-to-text (Sarvam / Bhashini) | Vosk small is weak on phone audio and dialects | Vosk, and keypad menus |
| AI helper model | Unmatched answers, side questions, follow-ups | Re-ask, then keypad |
| Production text-to-speech | gTTS is an unofficial dev voice | gTTS |
| Pilot districts + local job data | Q0 is a placeholder list; local demand only uses the caller's own answer | Placeholder |
| Village/block list (LGD) | Spec asks for block level, not district | District only |
| Age question | Needed for PM-DAKSH routing (spec §2.4 stage 0.5) | Not routed |
| Training-centre locations | Distance gate for "can't travel far" | Short courses score higher instead |
| Other languages | Only Hindi prompts and word list exist | Hindi |
| Native-speaker prompts | Empathy requirement | Placeholder voice |
