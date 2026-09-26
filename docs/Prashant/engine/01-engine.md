# Interview engine (`ai/`) — what is built and how it works

Owner: Prashant · 2026-09-26 · Code: `ai/` · Spec it implements: `docs/Utsav/research/05-technical-spec.md` §1–2.

## 1. In one paragraph

Every channel sends the engine one caller turn (speech, a key press, silence, or a
hang-up) and gets back which pre-recorded prompts to play next. The engine walks a
fixed question flow, turns messy answers into one value from a closed list, confirms
each spoken answer with the caller, saves it against the person (not the call), checks
NSQF eligibility with hard rules, and ranks real courses from the official register. It
never invents a course code and never stores audio, transcripts, or raw phone numbers.

## 2. The call, step by step

```
opened ─▶ [LANG menu, only if ENGINE_LANGS has >1: 1 हिंदी · 2 भोजपुरी]
   ▼
same phone, unfinished interview? ── yes ─▶ RESUME: "continue the previous conversation?"
   │                                          1 / हाँ ─▶ back at the first unanswered question
   │                                          2 / नहीं (or unclear twice) ─▶ new person on the same phone
   no
   ▼
CONSENT (yes / no)  ── no ─▶ polite goodbye, nothing saved
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
| A bare "हाँ"/"नहीं" to an open question | Keypad menu at once, no "sorry" (it means they missed the question) |
| "फिर से बोलिए", "समझ नहीं आया", "वापस से बोलना" | Same question again, no try used up |
| `#` at any point | Logs a call-back request for a district worker, repeats the question |
| Spoken "एक"/"दो" after "हाँ के लिए एक…" | Counts as yes / no |

Read-backs of a district say "गया ज़िला" ("गया" alone also means "went"). A plain "नहीं" to
"any difficulty?" is accepted without a read-back (it became a double negative on real calls).

One sentence can answer two questions: "बारह साल से सिलाई" fills the family trade and
the years, and the years question is skipped.

## 3. Understanding answers (`engine/extract.py`)

Cheapest first; stops at the first hit:

1. **Word list** (`data/lexicon.json`): 26 trades plus education, yes/no, constraints,
   job preference, districts. Each phrase is matched exactly, then after
   Devanagari→Latin transliteration (so `silai` = `सिलाई`), then by a sound-alike key
   (so `दरजी` = `दर्जी`), then by close spelling.
2. **Number patterns**: "आठवीं", "8 तक", "दसवीं पास", "बारह साल".
3. **AI helper** (`engine/llm.py`, Sarvam `sarvam-105b-conversations`, JSON mode, ~0.3–0.9 s):
   only when 1–2 find nothing. See "Off-script: the AI helper" below.
4. **The caller confirms** whatever was picked.

Guard rails found by testing: sound-alike matching only for single words of 5+ sounds,
and close-spelling only for 6+ letters, because "पता" ≈ "पापड़" and "नहीं" ≈ "नवीं".
Filler words ("का काम") are ignored when judging close spelling. The Hindi full stop "।"
is stripped: Sarvam ends every transcript with one, and on the first real calls it made
every short answer ("गया।") fail. The speech-to-text's top guesses are all tried; later
guesses count slightly less.

**Speech-to-text** (`engine/asr.py`, `ASR_PROVIDER`): `sarvam` (cloud, `saarika:v2.5`) → on
error or > 2 s falls back to `vosk` (offline) → then the keypad. **Voice for the result**
(`engine/tts.py`, `TTS_PROVIDER`): `sarvam` (`bulbul:v3`) → falls back to `gtts`.

### Off-script: the AI helper

The main route stays hard-coded, so ordinary answers cost nothing and take ~10 ms. The AI is
asked only when the word list and number patterns fail on something longer than one word.
It returns one of:

| AI says | Engine does |
|---|---|
| `answer` + a value from the question's own list | Reads it back like any answer ("आपने कहा…, सही है?") |
| `question` + a short reply | Speaks the reply (from `data/facts_hi.md` only), then asks the same question again |
| `help` | Logs a call-back request, repeats the question |
| `repeat` | Repeats the question |
| `unclear` | Normal re-ask → keypad menu |

It also decides yes/no when a caller answers a yes/no question in their own words ("चलिए शुरू
करते हैं"). Guard rails: a value not on the list is thrown away; replies come only from the fact
sheet (fees, stipend, centre, dates → "यह जानकारी हमारे ज़िले के साथी देंगे"), are cut at a
sentence end, never name a course; at most 2 side questions per question.

**Cost:** at most `LLM_MAX_PER_CALL` (6) AI calls per phone call, never for one-word or empty
answers; tests never call it. If Sarvam is slow or down the call simply carries on with
re-ask and the keypad.

**Voice:** Piper (free, offline, runs on the laptop CPU, ~40x faster than real time),
Hindi voice `priyamvada` (female, matching the prompts' feminine grammar) at
`PIPER_LENGTH_SCALE=0.85`. All 168 prompts re-record in ~7 s at no cost; live replies (result,
AI answers) are made on the machine in ~0.2 s. Sarvam Bulbul stays available
(`TTS_PROVIDER=sarvam`) for a demo where quality matters most. **Licence:** the `priyamvada`
and `pratham` voices are trained on CC BY-NC-SA 4.0 data (non-commercial), `rohan` on the IIT
Madras IndicTTS licence — fine for the hackathon; confirm before any paid deployment.

**Tone:** thanks rotate ("ठीक है", "जी, समझ गई", "धन्यवाद", "अच्छा"); answers that call for it
get a warm, true line (no schooling → "many courses need none"; 5+ years → "that experience will
help"; no work / a difficulty → supportive); progress cues before q4 and q7; a gentler second
re-ask.

**Speakerphone:** the caller's audio can carry our own prompt back. The adapter only lets
speech interrupt a prompt if it is clearly louder than that echo, and ignores the first 250 ms
after a prompt; the engine ignores an "answer" that is mostly its own last prompt, without
using up a try. A menu number said aloud ("नौ") counts as the key. Only the result and AI replies
are spoken live. Yes/no questions say "हाँ या नहीं बोलिए, या एक या दो दबाइए" the first time,
then just "सही है?".

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
| `POST /v1/extract` | Measurement only: one answer → what was heard and understood (accuracy harness) |
| `GET /health` | Providers in use, register size and sha |

Utterance kinds: `opened`, `audio`, `text`, `dtmf`, `timeout`, `hangup`. Requests are
validated at the boundary (key pattern, base64 audio ≤ ~20 s, length limits).

## 7. Measured (2026-09-26)

**Real calls** (Exotel trial → tunnel → laptop, Sarvam) and **softphone calls**: Sarvam heard
almost every answer correctly; every miss was in our matching and is fixed (details and
commits: `docs/Prashant/ivr/05-measurements.md`, `06-exotel-setup.md` §7). Engine time after a
spoken answer: p50 570 ms, p95 810 ms (softphone, Sarvam). Accuracy on 38 synthetic answers,
worst line condition: Sarvam 89% understood vs Vosk 68%.

**Laptop, fake phone call end to end** (earlier):

| Run | Result |
|---|---|
| Keypad-only interview (no speech-to-text) | 16 turns, completes, recommendation saved |
| Fully spoken interview (Vosk offline, placeholder voice) | every answer understood first time; engine 150–300 ms per turn including speech-to-text |
| Redial on the same phone | "continue?" → yes → straight to read-back → result |
| Spoken result | split into sentences, fetched in parallel, engine reply 48 ms |
| Tests | 50 engine + 29 IVR, on Linux, Windows, macOS (CI) |

⚠ The spoken run used a clean synthetic voice. Real phone lines and dialects will be
much worse; the dialect test set (testing plan §6) is what gives real numbers.

## 8. Still open (needs an account, data or people)

| Item | Why it matters | Until then |
|---|---|---|
| Bhashini as a second cloud speech provider | Sovereign option; Sarvam rate-limits bursts (429) | Sarvam → Vosk → keypad |
| Fact sheet sign-off | The AI answers side questions from `data/facts_hi.md`; fees/stipend are not in it | "District worker will tell you" |
| Pilot districts + local job data | Q0 is a placeholder list; local demand only uses the caller's own answer | Placeholder |
| Village/block list (LGD) | Spec asks for block level, not district | District only |
| Age question | Needed for PM-DAKSH routing (spec §2.4 stage 0.5) | Not routed |
| Training-centre locations | Distance gate for "can't travel far" | Short courses score higher instead |
| Other languages | Hindi complete; Bhojpuri prompts and words are drafts | Hindi, draft Bhojpuri |
| Native-speaker prompts | Empathy requirement | Placeholder voice |
