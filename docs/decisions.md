# Decisions

What is settled and why. Add to the bottom with a date. If a task conflicts with one of
these, stop and flag it — do not silently resolve.

## 2026-09-25 — the customer is a District Collector as much as a beneficiary

Four of the five "Basic Issues under GIA" in the PS are administrative: perspective plans,
participant identification, placement, inter-department coordination, no ground staff. The
scheme's decision-maker is the **DL-PACC chaired by the District Collector, meeting quarterly**,
and its artefact is the **Perspective Plan on `pmajay.dosje.gov.in`**, due in the first week of
April under the May 2023 revision's calendar. We ship the officer
half. Evidence: `docs/Utsav/research/01-the-customer.md` §3, §10.

## 2026-09-25 — voice-first, multi-channel. The "app" is one of four surfaces

The PS names IVR, WhatsApp voice notes, and mobile/kiosk. Reality adds assisted mode, because
**51.6% of rural women 15+ own no mobile phone** and the guidelines mandate **30% women** in
skill programmes. One interview engine, four thin transports, plus a desktop console for the
district PIU. PS 26154 was "dashboard, desktop, done" — that instinct does not transfer.

## 2026-09-25 — the interview is a finite state machine, not an agent

Seven mandated fields in a fixed order. An FSM owns the flow; the LLM only ever answers
"which value of this closed enum did they mean, and how confident are you". Every turn is
replayable and every extraction is a logged `(transcript → value, confidence)` pair. An LLM
that conducts the interview is slower, unreproducible, wanders in front of judges, and
destroys the audit trail this scheme will eventually need.

## 2026-09-25 — assume the transcript is wrong

Best published WER on dialectal telephone Hindi is **26.8** (IndicWhisper); Google STT is
**59.9**. The unit of the system is therefore a **field classified over a closed set**, not a
transcription. Order of attack: ASR `n`-best → vernacular trade lexicon with phonetic/fuzzy
match → small-LLM enum classification → **spoken confirmation**. Low confidence is a re-ask,
not an error.

## 2026-09-25 — we do not claim a dialect ASR model

Bhojpuri, Rajasthani, Chhattisgarhi and Magahi have ~11 crore speakers between them, zero
coverage in Bhashini/Sarvam/Google, and ~18 hours of published corpus for four of them
combined. We absorb the error in the matching layer and we **publish the measurement**. Any
sentence implying we support dialects at the model level is a lie a MoSJE jury can catch.

## 2026-09-25 — eligibility is a hard gate before ranking, never a score

NSQF 2023 publishes entry requirements per level, including that Levels 1-2 need no formal
education and that relevant experience substitutes for schooling from Level 2.5 up. Rank only
inside the eligible set. Output **NEAR-MISS with the exact gap** — that is the PS's "skill gaps
requiring intervention". A recommendation the person cannot enrol in manufactures the CAG's
41% placement figure one call at a time.

## 2026-09-25 — qualification identifiers are imported, never invented

QP codes, NOS codes, NSQF levels, awarding bodies, durations and eligibility come from the
official **NQR** export. Fields the source does not provide are **NULL, not guessed**.
Prototype data is never labelled official. NCO-2015 is a *signal* only — NCVET's own audit
found 156 of 2,157 qualifications mis-mapped and 256 unmappable. A wrong QP code sends a real
person to a centre that will not admit them; it is a defect, not a rounding error.

## 2026-09-25 — audio is discarded after confirmed transcription

DPDP Rules 2025 are in force. Raw voice is the most sensitive thing this system will ever hold
and the least necessary to keep. Consent is a spoken, logged, withdrawable FSM state, and the
mobility/disability field branches to a **guardian-consent path** — Rule 10 requires verifiable
consent and a checkbox does not satisfy it.

## 2026-09-25 — fixed prompts are pre-rendered audio files

The consent script, the seven questions, the re-prompts and the acknowledgements are fixed
text. Synthesise once, ship as WAVs, TTS only the personalised tail. This is what keeps a turn
under two seconds on a voice channel, makes the kiosk work offline, drops per-call cost to
near zero, and lets a human fix the ones that sound cold.

## 2026-09-25 — route to PM-DAKSH and SIA rather than re-skin them

The PM-AJAY guidelines forbid overlap with PM-DAKSH by name. MSDE + Meta + Sarvam already
shipped **SIA**, a multilingual WhatsApp voice assistant recommending NSQF courses, in May 2025.
Where they are the right answer, hand off. A system that knows when to hand off is more
credible than one that pretends to be alone in the field.

## 2026-09-25 — opportunity data is two or three sourced districts, not a national map

Every row carries `source` and `source_date`. The architecture is pluggable for NCS/e-Shram.
A fabricated national feed loses to three honest districts the moment a jury member turns out
to be from one of them.

## 2026-09-25 — success is measured by spread, not just relevance

CAG found 40% of national certifications in 10 job-roles and 90% of "Green Jobs" in one. Run
the recommender over a synthetic district cohort and plot the trade distribution. If it
concentrates like PMKVY did, we have automated the failure with better UX.

## 2026-09-26 — hybrid interview: fixed flow, AI only as the last rung

The question order, consent, eligibility and course codes stay fixed code. An AI model
may only propose a value from the field's closed list when the word list and number
patterns find nothing, and the caller still confirms it. Follow-ups and side questions
are the same kind of proposal, never a change to the flow. Off by default; the flow
works without it (re-ask, then keypad). Detail: `docs/Prashant/ivr/01-master-plan.md` §3.

## 2026-09-26 — the turn contract gains `timeout`, `hangup` and inline audio

`/v1/turn` utterances: `opened | audio | text | dtmf | timeout | hangup`. Audio travels
inline as base64 (≤ ~20 s), not by blob reference. `timeout` lets the engine decide the
nudge; `hangup` marks the session resumable. Resume PIN: `*` means "start new".

## 2026-09-26 — Q0 is district-level until the LGD block list is imported

Spec §9 BLOCKER 3 asks for village/block. We ask the district from a pilot list
(`ai/data/districts.json`, placeholder choice) and fall back to "other". Block-level
needs the LGD directory; open.

## 2026-09-26 — resume by phone number, no PIN (reverses spec §1.2's PIN gate)

A redial from the same phone with an unfinished interview is asked "continue the previous
conversation?" (1/हाँ = continue at the first unanswered question, 2/नहीं = new person on the
same phone; unclear twice = new). The 4-digit PIN is removed: on real calls callers answered
"हाँ" to the PIN request and it cost a turn on every call. **Accepted risk:** on a shared
handset, whoever redials can continue another person's interview and hear its read-back —
the disclosure spec §1.2 guarded against. Revisit before any pilot with real beneficiaries.

## 2026-09-26 — the AI helper is on (Sarvam), grounded and capped

Extends the hybrid decision above. When the word list fails, `sarvam-105b-conversations`
(JSON mode, ~0.5 s) may pick an allowed value (still read back), answer a side question
**only from `ai/data/facts_hi.md`**, or detect "repeat"/"I want a person". Unguarded, the model
told a caller the course costs money; with the fact sheet it defers fees and stipend to the
district worker. Cost cap: 6 AI calls per phone call, none for one-word answers. Prompts are
recorded once in Sarvam's voice at 1.2×; only the result and AI replies use live voice.

## 2026-09-26 — voice: Piper on the machine, not a paid cloud voice

Sarvam Bulbul cost too much for our free tier. Piper (open source, CPU, offline) makes speech
~40x faster than real time on a laptop, so prompts and live replies cost nothing and arrive
sooner. Voice `hi_IN-priyamvada-medium`. Its training data is CC BY-NC-SA 4.0: acceptable for
the hackathon and a government pilot, **to be confirmed before any paid deployment**. Sarvam
remains a switch (`TTS_PROVIDER=sarvam`).

## 2026-09-26 — speech policy: the assistant only says what we wrote

Whatever a caller says, the assistant speaks only our own sentences: pre-recorded prompts,
pre-written answers to side questions (`ai/data/facts_hi.json`, picked by id), the recommendation
template, and caller-given place/job names after cleaning. The AI never writes spoken words.
Injection and abuse are filtered before the AI; abuse twice ends the call; per-call, per-number
and daily caps bound cost. Guardrail events are logged as counts, never words. No promises of
money or jobs are ever made (fact A12). Details and tests: `docs/Prashant/ivr/07-guardrails.md`.

## 2026-09-27 — conversation: problems are heard, the caller can go back, the engine reasons

PS 26097 asks for an interview that is "empathetic and conversational rather than administrative"
and for skill gaps, pathways and local opportunities, not just a course list. So: a problem the
caller shares is acknowledged (our own line per topic), noted as a topic for the district worker
and remembered for the question it answers; the caller can go back by words or the star key; the
engine links answers out loud and explains its result with rules (`ai/engine/reasoning.py`), not
a model, so every sentence traces to an answer. The speech policy is unchanged: the AI only picks
topic and question ids. Details: `docs/Prashant/engine/01-engine.md` §3 and §5.
