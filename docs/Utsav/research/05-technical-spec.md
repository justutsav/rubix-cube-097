# Technical spec — SIH26097, end to end

Written 2026-09-25. Point A is a beneficiary who has never heard of NSQF. Point B is a
spoken recommendation they can act on Monday **and** a row in the district's Perspective
Plan. Everything between those two points is in this file.

Reads on top of `docs/PROBLEM-STATEMENT.md` (requirements R1-R9), `03-verdict.md` (what we
build), `02-tech-landscape.md` (why each component was chosen) and `docs/decisions.md`
(what is settled). Where this file names a vendor field or price, ⚠ marks anything not
confirmed from a primary source.

---

## 0. The whole thing on one page

```
                    ┌──────────────────────────────────────────────┐
  A  feature phone  │                                              │
     ──dials────────▶  Exotel toll-free ──WebSocket──▶ IVR adapter │
                    │                                              │
     WhatsApp       │                                              │
     ──voice note──▶  Meta Cloud API ──webhook──────▶ WA adapter   │
                    │                                              │
     kiosk / ASHA   │                                              │
     ──taps mic────▶  Android + Vosk ──outbox sync──▶ App adapter  │
                    └──────────────────┬───────────────────────────┘
                                       │  ONE contract: POST /v1/turn
                                       ▼
        ┌────────────────────────────────────────────────────────────┐
        │  THE CORE — no channel knows any of this exists            │
        │                                                            │
        │  identity ──▶ session resolve (resume or start)            │
        │       │                                                    │
        │       ▼                                                    │
        │  INTERVIEW FSM   consent → Q1..Q7 → readback → recommend   │
        │       │                                                    │
        │       ▼                                                    │
        │  EXTRACTION LADDER  n-best → lexicon → regex → LLM → confirm│
        │       │                                                    │
        │       ▼                                                    │
        │  PROFILE (Postgres, per-field confidence + provenance)     │
        │       │                                                    │
        │       ▼                                                    │
        │  RECOMMENDER   gate → retrieve → rank → explain ×3         │
        └───────────────┬─────────────────────────┬──────────────────┘
                        │                         │
                        ▼                         ▼
        B1  spoken recommendation      B2  district aggregation
            back down the same              → officer console
            channel, ≤60 s                  → Perspective Plan input
                                            → convergence export (SSDM/NSFDC)
```

Three doors, one room. The PS names the three doors (R5); reality adds a fourth
(assisted mode) and a fifth reader (the officer, R9).

**The single most important sentence in this spec:** the FSM, the extractor and the
recommender do not know which channel they are serving. If the interview logic ever
appears inside the IVR handler, the WhatsApp path becomes a second implementation of the
same seven questions and they drift apart by day three.

---

## 1. How the three inputs are linked

### 1.1 The turn contract

Every channel adapter does exactly two things: turn its transport into an *utterance*,
and turn a *prompt* back into its transport. One endpoint, called identically by all
three.

```http
POST /v1/turn
Content-Type: application/json

{
  "channel":     "ivr" | "whatsapp" | "app",
  "channel_ref": "<call_sid | wa_message_id | device_session_uuid>",
  "identity":    { "kind": "msisdn_hash", "value": "<hmac-sha256(e164, server_pepper)>" },
  "utterance":   { "kind": "audio",  "format": "l16", "rate": 8000, "ref": "blob://tmp/…" }
               | { "kind": "dtmf",   "digits": "2" }
               | { "kind": "text",   "value": "silai ka kaam" }
               | { "kind": "opened" },            // first contact, no speech yet
  "locale_hint": "hi-IN",
  "offline_captured_at": "2026-09-25T11:04:00Z"   // app channel only, for late sync
}
```

```jsonc
// 200 OK
{
  "session_id": "ses_01J…",
  "state":      "Q4_SKILLS_INTERESTS",
  "resumed_from": "Q4_SKILLS_INTERESTS",          // null on a fresh session
  "say": [
    { "kind": "prerendered", "id": "q4.ask.hi.v3", "duration_ms": 4100 },
    { "kind": "tts",         "text": "आपने कहा सिलाई — सही है?" }   // only when unavoidable
  ],
  "expect": {
    "kind": "enum",
    "options": ["yes", "no"],
    "dtmf_map": { "1": "yes", "2": "no" },
    "timeout_ms": 6000
  },
  "turn_budget_ms": 1800,
  "terminal": false
}
```

`say` is a **list of references, not audio**. The IVR adapter resolves
`prerendered:q4.ask.hi.v3` to an 8 kHz WAV on local disk; the WhatsApp adapter resolves
the same id to a pre-uploaded Meta media id; the Android app resolves it to a file in its
APK. One prompt, authored once, three renderings, zero drift. This is also why fixing a
cold-sounding prompt is a one-line change in all three channels at once.

### 1.2 Identity and cross-channel resume — the part that matters most

`docs/decisions.md` does not yet cover this, so state it plainly: **the session is keyed
on the person, not on the call.**

```
beneficiary.id        ← stable
  ├── session (ivr,      call_sid=...)     started 11:02, dropped 11:06 at Q4
  ├── session (whatsapp, wa_msg=...)       started 18:40, resumed at Q4
  └── session (app,      device=...)       started next Tuesday, finished at Q7
answer rows hang off beneficiary.id, NOT off session.id
```

Resolution order on every `POST /v1/turn`:

1. Hash the MSISDN → look up `beneficiary`.
2. No match → create, `state = CONSENT`.
3. Match with **all seven fields confirmed** → this is a returning caller: offer the
   saved recommendation, or "start again".
4. Match with **unconfirmed fields** → resume at the lowest-numbered unconfirmed field,
   after a one-line spoken acknowledgement: *"पिछली बार आप चौथे सवाल तक पहुँचे थे — वहीं से
   शुरू करें?"* (DTMF 1 = yes, 2 = start over).

**Confirmed answers are immutable within a profile version.** Only unconfirmed fields are
ever re-asked. This is what makes the four-minute interview survive a network that drops
calls, and it is the same mechanism that lets a feature-phone user finish on a kiosk three
days later.

**The shared-handset problem, and its fix.** 51.6% of rural women 15+ own no phone
(`01-the-customer.md` §8). A phone-hash key therefore collides: a brother redials and
lands inside his sister's half-finished interview — which is both a wrong profile and a
DPDP disclosure of her disability answer to him.

Fix, and it costs one FSM state. A **name** gate is not enough — a relative can guess a
name. `phone_hash` is a **non-unique lookup index, never an identity**, and resume is
**PIN-gated**:

```
at CONSENT:  capture a 4-digit resume PIN by DTMF   (plumbing already exists, ₹0, 0 WER)

on redial to a hash with an open RESUMABLE session:
  "पिछली बातचीत जारी रखनी है? अपने चार अंक दबाइए।  नई शुरुआत के लिए 1 दबाइए।"
    PIN correct  → resume at the lowest unconfirmed field
    1            → new beneficiary record, same phone_hash, ordinal 2
    2 failures   → new beneficiary record (never a lockout — this is a welfare line)
```

**Reveal nothing, read back nothing, until the PIN clears.** On WhatsApp, resume is
**forward-only** — ask the next unanswered field, never read prior answers back into a
chat log that lives on a handset we cannot erase. Kiosk and assisted mode need no PIN; the
mobiliser is physically present.

Multiple beneficiaries per handset is the *normal* case in this scheme, not an edge case,
so `(phone_hash, ordinal)` carries it from day one rather than retrofitting a unique
constraint later. Full reasoning: §9, BLOCKER 1.

### 1.3 What is shared and what is not

| Component | Shared across channels | Channel-specific |
|---|---|---|
| Interview FSM, all states and transitions | ✅ | — |
| Extraction ladder, lexicon, thresholds | ✅ | — |
| Profile, confidence, provenance | ✅ | — |
| Eligibility gate + recommender + explanations | ✅ | — |
| Prompt **text**, prompt **ids**, translations | ✅ | — |
| Prompt **audio encoding** | — | 8 kHz PCM (IVR) · OGG/Opus (WA) · 16 kHz WAV (app) |
| ASR engine | — | IndicConformer server (IVR, WA) · Vosk on-device (app) |
| Turn granularity | ✅ one question per turn, everywhere — batching audited and rejected (§9 MAJOR 7) | — |
| Endpointing | — | VAD (IVR) · the user's mic button (WA, app) |
| Confirmation UX | — | spoken + DTMF (IVR) · spoken + quick-reply buttons (WA) · on screen (app) |

The last row is the only place the channels legitimately diverge, and it is a
**presentation** difference over one `expect` object, not a logic difference.

---

## 2. The core

### 2.1 Data model

```sql
beneficiary (
  id              uuid pk,
  phone_hash      bytea not null,          -- hmac(e164, pepper); the raw number is never stored
  ordinal         smallint not null default 1,   -- shared-handset discriminator, §1.2
  first_name      text,                    -- volunteered, used only for the resume gate
  district_lgd    int references district,
  block_lgd       int,
  consent_state   text not null,           -- NONE|GIVEN|GUARDIAN_PENDING|GUARDIAN_GIVEN|WITHDRAWN
  created_at      timestamptz,
  unique (phone_hash, ordinal)
)

session (
  id            uuid pk,
  beneficiary_id uuid references beneficiary,
  channel       text not null,             -- ivr|whatsapp|app
  channel_ref   text,                      -- call_sid / wa thread / device id
  fsm_state     text not null,
  status        text not null,             -- ACTIVE|RESUMABLE|COMPLETED|ABANDONED
  started_at    timestamptz, last_turn_at timestamptz
)

answer (
  beneficiary_id uuid references beneficiary,
  field_no       smallint,                 -- 1..7, the PS's order, verbatim
  raw_transcript text,                     -- kept; the audio is not (decisions.md 2026-09-25)
  nbest          jsonb,                    -- ASR alternates, for post-hoc error analysis
  value          jsonb not null,           -- normalised: enum, {years:int}, [concept_ids]
  confidence     real not null,
  method         text not null,            -- LEXICON|REGEX|LLM|DTMF|OPERATOR
  asr_engine     text, asr_version text,
  confirmed_at   timestamptz,              -- NULL = not yet read back and accepted
  session_id     uuid references session,  -- which session produced it (audit, not identity)
  primary key (beneficiary_id, field_no)
)

consent_event (id, beneficiary_id, kind, script_version, captured_at, channel, evidence)
                 -- kind: SPOKEN_YES|DTMF_YES|GUARDIAN_YES|WITHDRAWN
recommendation (id, beneficiary_id, ranked jsonb, weights_version, engine_version,
                nqr_snapshot_sha, needs_financial_literacy bool, asset_grant_eligible bool,
                created_at, delivered_at)
outcome (beneficiary_id, qualification_code, status, status_date, source)
                 -- status: RECOMMENDED|ENROLLED|CERTIFIED|PLACED|DROPPED
                 -- updated from the mobiliser's call list, not a new officer screen.
                 -- This is Basic Issue 3 and the guidelines' 70% placement target.
```

Note what is *not* here: no `audio` table, no `recording_url`. Audio is transcribed,
normalised, confirmed, discarded — within the turn.

**And `raw_transcript` is erased at `CONFIRM` too.** Its purpose is fully discharged the
moment the normalised value is confirmed back to the beneficiary, and it is 26-60% wrong
anyway — so its evidentiary value is near zero while its disclosure risk is total. Keep a
hash if an extraction dispute must ever be defensible. *"We keep neither the voice nor the
words, only the confirmed answer"* is a stronger sentence than keeping either. See §9,
MAJOR 5 — and note that the commonly-cited three-year Rule 8 erasure does **not** apply to
a scheme like this.

Note also `nqr_snapshot_sha` and `weights_version` on every recommendation. In 2030
somebody will ask why this person was sent to this trade. The answer has to be a row.

### 2.2 The interview FSM

Seven mandated fields, in the PS's order, as an explicit state machine. Not an agent
(`decisions.md`, 2026-09-25).

```
ENTRY
  └─ LANG_SELECT        "हिंदी के लिए 1 …"        [DTMF 1-5, or spoken]
  └─ Q0 VILLAGE_BLOCK   resolved against the LGD block list by the same lexicon
        │               + phonetic matcher built for trades. REGISTRATION METADATA,
        │               not an eighth PS field — see §9, BLOCKER 3
  └─ CONSENT            ≤15 s script, spoken/DTMF yes  → consent_event
        │               names all four surfaces (IVR, WhatsApp, kiosk, worker visit)
        │  no → CLOSE_POLITE
  └─ IDENTIFY           4-digit resume PIN capture / check
        │  (PIN gate lives here, §1.2)
  ├─ Q1 EDUCATION           enum   ← eligibility input
  ├─ Q2 FAMILY_OCCUPATION   concept + years  ← eligibility input (RPL / experience substitution)
  ├─ Q3 CURRENT_LIVELIHOOD  concept + status
  ├─ Q4 SKILLS_INTERESTS    multi-label concepts
  ├─ Q5 MOBILITY_CONSTRAINT enum + radius_km  ← may branch to GUARDIAN_CHECK
  │       GUARDIAN_CHECK branches on DECISIONAL CAPACITY, not on disability —
  │       DPDP Rule 11 only bites when a guardian is appointed by a court, a
  │       designated authority, or a district local level committee. See §9, MAJOR 4
  ├─ Q6 EMPLOYMENT_PREF     enum{self, wage, either}
  ├─ Q7 LOCAL_ECONOMY       open + district table
  └─ READBACK           all seven, spoken, one sentence each → spoken yes
        │  "no, change Q3" → re-enter Q3 only
  └─ RECOMMEND          top 3, spoken, ≤60 s, with the reason for each
  └─ NEXT_STEP          nearest centre, what to do Monday, SMS/WA follow-up offer
  └─ CLOSE
```

Every `Qn` is the same five-state sub-machine:

```
   ASK ──▶ LISTEN ──▶ EXTRACT ──┬─ conf ≥ 0.85 ──▶ CONFIRM ──yes──▶ next Q
    ▲         │                 │                     │
    │         │                 ├─ 0.55–0.85 ─▶ CONFIRM(explicit readback)
    │         │                 │                     └─no──┐
    │         │                 └─ < 0.55 ────────────────▶ RE_ASK (max 2)
    │         │                                              │
    │         └── timeout / silence ──────────────────────▶ RE_ASK
    │                                                        │
    └────────────────────────────────────────────────────────┘
                     after 2 re-asks ──▶ DTMF_FALLBACK (closed set)
                                    └──▶ DEFER (leave unconfirmed, continue)
```

`DEFER` is why the system does not hang up on someone it cannot understand. An unconfirmed
field is a resumable field, and a profile missing Q7 still produces a NEAR-MISS-aware
recommendation — it just says so.

**Per-field extraction targets** (the schema an evaluator will count against R3):

| # | PS wording | Type | Values / shape | Used by |
|---|---|---|---|---|
| 1 | Educational background | enum | `none · primary(1-5) · middle(6-8) · secondary(10) · higher_sec(12) · iti_diploma · graduate_plus` | **eligibility gate** |
| 2 | Existing or traditional family occupations | concept + int | `{concept_id, years}` | **eligibility gate** via NSQF experience substitution + RPL routing |
| 3 | Current livelihood activities | concept + enum | `{concept_id, status: wage·self·casual·none}` | ranking, skill-transfer |
| 4 | Skills and interests | concept[] | multi-label over the trade concept graph | retrieval, ranking |
| 5 | Mobility and physical constraints | enum + int | `{constraint: none·distance·physical·care_duty, radius_km}` | **gate** (centre reachability) + **DPDP Rule 10 branch** |
| 6 | Self-employment vs wage employment | enum | `self · wage · either` | ranking weight + asset-grant path |
| 7 | Local economic realities and opportunities | concept[] + free | joined against the district opportunity table | ranking, officer aggregation |

Field 2 is the highest-value inference in the whole interview (`01-the-customer.md`
bottom line §3). *"I've done my father's weaving for twelve
years"* is not a biography answer — it is an eligibility claim that unlocks NSQF 2.5+
without schooling.

### 2.3 The extraction ladder

Best published WER on dialectal telephone Hindi is **26.8** (IndicWhisper); Google STT is
**59.9** (`02-tech-landscape.md` §1.1). The system is therefore built to be **wrong about
words and right about fields**, because a field is a classification over a closed set, not
a transcription.

Run cheapest-first, stop on first fire:

| # | Layer | Cost | Latency | Catches |
|---|---|---|---|---|
| 0 | **DTMF**, when the field is closed-set and we already re-asked | ₹0 | 0 ms | Everything, at 0 WER |
| 1 | **Vernacular trade lexicon**, phonetic key + fuzzy, over ASR `n`-best | ~₹0 | ~5 ms | ~70% of answers — the ones that are one trade word (`सिलाई`, `डेरी`, `thaiyal`, `nesavu`) |
| 2 | **Numeric / level regex** — "8th", "दसवीं", "पाँचवी", "बारह साल" | ~₹0 | ~2 ms | Q1 and the `years` half of Q2 — both eligibility inputs |
| 3 | **Small-LLM constrained enum classification** | 1 short call | 400-1200 ms | Compound, hedged, or negated answers |
| 4 | **Spoken confirmation** | 1 turn | ~4 s | Whatever the first three got wrong |

The lexicon is the unglamorous, highest-leverage asset. Each entry:

```jsonc
{
  "concept_id": "TRADE.TAILORING",
  "canonical":  { "hi": "सिलाई", "en": "tailoring" },
  "surface":    ["सिलाई","सिलाई-कढ़ाई","silai","darzi","दर्जी","thaiyal","தையல்","बुनाई-सिलाई"],
  "phonetic":   ["S400","T400"],            // Double Metaphone over the transliteration
  "dialect":    { "bho": ["सिलाई के काम"], "mag": ["सिवाई"] },
  "nco_2015":   ["7531.0100"],              // signal only — NCVET found 156/2157 mis-mapped
  "nqr_codes":  ["AMH/Q1947","AMH/Q1947.v2"]  // imported, never invented
}
```

Matching: exact surface → Double Metaphone / Soundex-for-Devanagari on each `n`-best
hypothesis → token-level Levenshtein ≤ 2 → IndicSBERT cosine ≥ 0.72 as the last
lexical resort. MuRIL is the embedding base because it covers 17 Indian languages **and
their transliterated forms**, and Roman-script Hindi is everywhere in both ASR output and
WhatsApp text.

We do **not** claim a Bhojpuri ASR model. We claim — and measure — that a Bhojpuri
utterance transcribed badly by a Hindi model still lands on the right concept, and we
publish WER next to field-extraction accuracy on a 30-utterance dialect test set. That
chart is the strongest slide available.

### 2.4 The recommender

Gate, then rank. Never rank, then gate.

```
STAGE 0  ELIGIBILITY GATE            (rules only, no model, no score)
   NSQF entry requirement  vs  (Q1 education  ∪  Q2 experience-substitution)
   physical constraint (Q5) vs  job-role physical demands
   radius_km (Q5)           vs  haversine to nearest PMKK / NSTI / ITI
   age band                 vs  PM-DAKSH routing rule (guidelines forbid overlap)
   → returns THREE buckets, always:
     ELIGIBLE  |  NEAR_MISS(gap: "one more year" / "Level 2 course first")  |  INELIGIBLE

STAGE 0.5  PM-DAKSH ROUTING            (the guidelines forbid overlap BY NAME)
   age 18-45 ∩ eligible category ∩ NSQF-standard STT  →  ROUTE_TO_PM_DAKSH
   spoken tail carries the ₹1,500/month SC stipend. Three lines; Basic Issue 4

STAGE 1  RETRIEVAL over ELIGIBLE only
   lexicon + IndicSBERT over {Q2 family occupation, Q3 current, Q4 skills/interests}
   → top ~30 NQR qualifications

STAGE 2  RANK, weights written down and versioned
   aspiration_fit · skill_transfer(RPL shortcut) · local_opportunity(Q7 ∩ district table)
   · pref_match(Q6) · duration_vs_mobility · asset_grant_eligibility(₹50k cap)
   · women's 15%/30% target nudge
   → top 3

STAGE 3  EXPLAIN ×3, from the same scored object
   beneficiary: one spoken sentence per recommendation, no scheme jargon
   officer:     matched fields + the eligibility proof
   auditor:     inputs, weights_version, engine_version, nqr_snapshot_sha
```

**NEAR_MISS is a feature, not a rejection.** *"You need one more year, or the Level 2
course first"* is literally R4's fourth output, "skill gaps requiring intervention".

Weighted linear score with a published sensitivity table, not TOPSIS. The weights are
judgement calls either way; writing them down is more honest than deriving them through a
technique whose main function is to make judgement calls look derived. (TOPSIS is 40 lines
if the deck wants the letters.)

Instrument **spread**: run the recommender over a synthetic district cohort and plot the
trade distribution. CAG found 40% of national certifications in 10 job-roles and 90% of
"Green Jobs" in one. If our output concentrates like that, we have automated the failure
with better UX.

### 2.5 Data provenance

| Dataset | Source | Mechanism | Rule |
|---|---|---|---|
| **2,814 NSQF qualifications** | `nqr.gov.in` | `POST /downloadSummaryFile` with the session's own CSRF token — reproduced end-to-end, `sha256 348bed87…`, `research/03-nqr-import.md` | Fields the source does not provide are **NULL, not guessed**. No invented QP codes, ever |
| **NSQF entry requirements** | NSQF 2023 gazette Annexure | Typed by hand, <100 rows | This *is* the eligibility engine |
| **NCO-2015 occupation bridge** | DGE Vol I / II-A | 8-digit code, last two digits encode QP-NOS | **Signal only.** NCVET's own audit: 156/2,157 mis-mapped, 256 unmappable |
| **District opportunity** | NCS/JobX, DSDP PDFs, Udyam density, centre locator | Hand-assembled, **2-3 pilot districts** | Every row carries `source` + `source_date`. No national map built on invented numbers |

---

## 3. Channel 1 — IVR, in depth

This is the channel the PS names **first**, and the only one that uses the voice network
instead of mobile data. It is also the hardest, so it gets the most words.

### 3.1 Services

| Concern | Choice | Why |
|---|---|---|
| Telephony | Indian CPaaS, **ordinary virtual number (not toll-free)** + missed-call → callback, on a **1600-series number with DLT Principal Entity registration** | Toll-free bills the *receiver* at a premium (₹1.20-2.50/min vs ₹0.40-0.90 on a normal DID) and was only ever chosen as a regulatory shield — which TCCCPR clause (za) makes unnecessary for a Government Voice Call. INR billing, media path in India. See §9, BLOCKER 2 + MINOR 1 |
| Media transport | Exotel **bidirectional WebSocket** stream | Not a DTMF menu. Live PCM both ways, so the caller hears a conversation |
| Endpointing | `webrtcvad` (or Silero VAD) over 20 ms frames | Energy thresholds fail on a noisy village line; a plain energy average is the classic weak link |
| ASR | **Bhashini or Sarvam, metered, as the pilot default**; IndicConformer-600M self-hosted (MIT) as the sovereign path we flip to on stage | One provider interface, four implementations, one config value. Always-on GPU costs ₹4.29 lakh/year idle and only beats metered API above ~47,700 interviews/month — see §9, MAJOR 1 |
| TTS | **Pre-rendered 8 kHz WAVs** for all fixed prompts; live TTS only for the recommendation tail | Kills ~29% of per-call cost and ~0.6 s of per-turn latency |
| Fallback input | **DTMF** on every closed-set field | 0 ms, ₹0, 0 WER. The safety net under a 26.8-WER ASR |

⚠ Inbound **toll-free** in India is frequently billed to the *receiver* at a higher
per-minute rate than outbound. The choice between toll-free and a normal virtual number is
a live cost question — see §7 and the checker's findings.

### 3.2 The wire protocol

Per Exotel's AgentStream docs
(`developer.exotel.com/docs/agentstream/websocket-protocol`). Exotel's Voicebot protocol is
JSON-over-WebSocket, modelled on Twilio Media Streams:

**Inbound (Exotel → us)**

```jsonc
{ "event": "connected", "protocol": "…", "version": "…" }

{ "event": "start", "stream_sid": "…",
  "start": { "stream_sid": "…", "call_sid": "…", "account_sid": "…",
             "from": "+9194…", "to": "+911800…",
             "custom_parameters": { … },
             "media_format": { "encoding": "audio/x-l16", "sample_rate": 8000, "channels": 1 } } }

{ "event": "media", "stream_sid": "…",
  "media": { "chunk": "42", "timestamp": "840", "payload": "<base64 PCM>" } }

{ "event": "dtmf", "stream_sid": "…", "dtmf": { "digit": "1" } }

{ "event": "stop",  "stream_sid": "…", "stop": { "call_sid": "…", "reason": "…" } }
```

**Outbound (us → Exotel)** — `media` to play audio, `clear` to flush the playback buffer
instantly (this is barge-in), `mark` to learn when a prompt finished playing:

```jsonc
{ "event": "media", "stream_sid": "…", "media": { "payload": "<base64 PCM>" } }
{ "event": "clear", "stream_sid": "…" }
{ "event": "mark",  "stream_sid": "…", "mark": { "name": "q4.ask.hi.v3.end" } }
```

### 3.3 One turn, in order, with the clock running

```
 t=0      caller finishes speaking
 t+0…240  VAD sees 12 consecutive non-speech 20 ms frames → ENDPOINT
 t+240    utterance buffer (8 kHz L16 mono) closed, ~1.2 s of audio
 t+250    polyphase resample 8k → 16k  (IndicConformer wants 16 kHz; expect loss, measure it)
 t+260    ASR request, n-best = 5, domain vocabulary primed with our own trade names
 t+560…1100  transcripts back
 t+565    LADDER: lexicon hit on n-best[1] → concept TRADE.TAILORING, conf 0.91
 t+570    FSM: conf ≥ 0.85 → CONFIRM state
 t+575    resolve say[] → local file prompts/hi/q4.confirm.tailoring.v3.wav  (no TTS)
 t+580    stream back as 20 ms frames, ~90 ms apart, real-time paced
 t+580    caller starts hearing the reply
 ──────────────────────────────────────────────────────────────────────────
 TOTAL perceived silence: ~580 ms.   Budget: 1800 ms.   Headroom: 1220 ms.
```

The LLM path (ladder layer 3) costs 400-1200 ms and blows the budget if it lands on the
hot path. Two defences: (a) the lexicon handles ~70% of turns so the LLM is the uncommon
path, and (b) when the LLM *is* invoked, play a 300 ms pre-rendered `"हम्म…"` over it. A
human says "hmm" while thinking; so does this.

Barge-in: the VAD runs **while the assistant is speaking**. Speech detected → send
`{"event":"clear"}`, stop the send queue, transition to LISTEN. Without this, an
impatient caller talks over a four-second prompt and neither side hears the other, which
is the single most demo-destroying IVR bug.

### 3.4 Inputs the IVR channel actually takes

| Input | Source | What it feeds |
|---|---|---|
| Caller MSISDN | `start.from` | `phone_hash` → identity, resume lookup, district prior |
| Dialled number | `start.to` | Which campaign / district / language default |
| PCM audio, 8 kHz mono | `media.payload` | The extraction ladder |
| DTMF digits | `dtmf.digit` | Language select, yes/no confirm, closed-set fallback |
| Hangup + reason | `stop` | `session.status = RESUMABLE`, FSM checkpoint |
| Wall-clock per turn | our own timers | Latency telemetry per turn — the thing to put on a slide |

### 3.5 When the call drops

Rural calls drop constantly; this is the normal path, not the error path.

```
`stop` frame received (or WebSocket closes without one)
  → flush the current utterance buffer; discard it if the field was not confirmed
  → session.status = RESUMABLE, session.fsm_state = <current Q>
  → DO NOT call back automatically (TRAI outbound rules, §7)
  → optional: one SMS / WhatsApp utility message, "आपकी बातचीत सुरक्षित है, वहीं से
    जारी रखने के लिए फिर कॉल करें" — if and only if consent covered it
Next contact on ANY channel → §1.2 resume gate → continue at the same field
```

`answer` rows survive; `session` rows do not matter. That distinction is the entire reason
the data model hangs answers off `beneficiary_id` rather than `session_id`.

---

## 4. Channel 2 — WhatsApp voice notes, in depth

### 4.1 Services

**Meta Cloud API, direct.** Not via Twilio. Direct is cheaper (no per-message markup) and
it is the only route on which replying with an **audio message** is straightforward. A
text reply goes to people who, by the PS's own framing, cannot read a form.

### 4.2 The flow

```
beneficiary holds the mic button, speaks, releases
   ↓  Meta POSTs our webhook:
      { entry[].changes[].value.messages[0] =
          { from: "9194…", id: "wamid.…", type: "audio",
            audio: { id: "<media_id>", mime_type: "audio/ogg; codecs=opus" } } }
   ↓  GET /v19.0/<media_id>            → a short-lived signed URL
   ↓  GET <url>  (Bearer token)        → the OGG/Opus bytes
   ↓  decode Opus → 16 kHz mono PCM    → THE SAME extraction ladder as IVR
   ↓  POST /v1/turn                    → { say: [...], expect: {...} }
   ↓  resolve say[] to pre-uploaded Meta media ids (uploaded ONCE at deploy, reused forever)
   ↓  POST /v19.0/<phone_number_id>/messages
      { type: "audio", audio: { id: "<our_media_id>" } }
      + when expect.kind == "enum": an interactive reply-buttons message
```

Pre-uploading the prompt audio to Meta once and reusing the media id is the WhatsApp
analogue of pre-rendered WAVs: zero synthesis, zero upload, per turn.

### 4.3 Where WhatsApp deliberately differs from IVR

The cost driver here is **per message**, not per minute. The obvious response — batch 2-3
questions into one voice note — was proposed, audited, and **rejected**: it turns WhatsApp
into a form read aloud, which is exactly what the PS's first sentence rejects (R1) and
what R7 penalises. The saving is **₹0.77 per beneficiary**, and ₹0 for roughly the first
100 beneficiaries each month, because the first 1,000 service messages per number per
month are free. Not worth the requirement.

**One question per message.** If cost genuinely bites at 100k scale, batch
*acknowledgement + next question* — never question + question. See §9, MAJOR 7.

What does legitimately differ: endpointing is the user's mic button rather than a VAD, the
turn has no latency budget, and the `expect` object renders as interactive reply buttons
instead of DTMF. All presentation, no logic.

### 4.4 The 1 October 2026 problem — six days away

Meta's India pricing today: ₹0.87 marketing / ₹0.12 utility / ₹0.11 authentication per
message, with service messages inside an open 24-hour window **free**. ⚠ **From 1 October
2026 service and utility messages inside that window become chargeable beyond a free
monthly allowance (~1,000).** Additionally ⚠ accounts without a payment method saved by
30 September may lose the ability to send them at all.

Consequences, already designed in:

1. Our cost model assumes **paid** replies (~₹3.10/beneficiary at ~10 replies) — not the
   free-tier number that expires on 1 October.
2. Batching (§4.3) is now a *cost* mechanism, not only a UX one — halving message count
   halves this channel's bill.
3. The cheapest channel in the whole system has no vendor in it at all (§5).

Re-check both ⚠ items against Meta's published pricing page before any number goes on a
slide.

---

## 5. Channel 3 — lightweight app / offline kiosk, and assisted mode

### 5.1 Why it exists

R5 names it; R6 ("low connectivity and low-tech") makes it the only channel that is
*structurally* immune to the constraint. It is also ₹0 per interview, which matters under a
5% administrative-expenses cap.

### 5.2 Stack

| Layer | Choice | Note |
|---|---|---|
| App | Android, minSdk 24, single activity, ~15 MB APK + models | Runs on a ₹6,000 handset |
| ASR | **Vosk**, ~50 MB per language, Apache-2.0 | Worse accuracy than the server path — and the extraction ladder is what absorbs that, exactly as it does for dialects |
| Prompts | The same pre-rendered WAVs, shipped in the APK | Prompt ids identical to IVR. Authored once |
| Storage | SQLite, same `answer` shape as Postgres | Rows are the unit of sync, not sessions |
| Sync | Outbox table, opportunistic, idempotent upsert on `(phone_hash, ordinal, field_no)` | Conflict rule: **confirmed beats unconfirmed; later `confirmed_at` wins** |
| Recommender | **Server by default; a cached district subset on device** | Full 2,814-row NQR + gate runs on device against a district-filtered snapshot |

Aeroplane-mode the phone on stage and complete an interview end to end.

### 5.3 Assisted mode — the fourth door reality demands

Same APK, different entry: an ASHA / Anganwadi / VLCC member runs the interview *for* a
beneficiary on the doorstep, with a call-list screen showing who in the village is pending,
who is NEAR_MISS, and who consented.

This is not a nice-to-have. **51.6% of rural women 15+ own no mobile phone**, and the
guidelines mandate **30% women** in every skill programme with a **15% ring-fenced fund**.
Without a doorstep mode the women's target is arithmetically unreachable.

Consent in assisted mode is recorded as spoken by the *beneficiary*, on the worker's
device, with the worker's id in `consent_event.evidence` — never as the worker's assertion.

---

## 6. Point B — what comes out

### 6.1 To the beneficiary (spoken, ≤60 s, never a PDF)

> *"आपने बारह साल बुनाई की है — इसके लिए आपको स्कूल की डिग्री नहीं चाहिए। हैंडलूम वीवर का
> कोर्स, NSQF लेवल 4, आपके ब्लॉक में — तीन महीने, आठ किलोमीटर दूर। आप इसके लिए योग्य हैं।"*

One sentence of reason per recommendation. No scheme jargon. Repeatable on demand by
calling back and pressing 9.

### 6.2 To the officer (the half four of five Basic Issues live in)

District demand aggregation → **Perspective Plan input** in the portal's format, at the
3.5-4× notional allocation the May 2023 revision's calendar expects, due the **first week
of April**; plus PM-DAKSH routing counts, a consent register, and an outcome tracker after
training. A dashboard alone is not enough; the output must be the statutory artefact.

### 6.3 To convergence partners

Batch-shaped structured export: *"here are 240 people in your block who want and are
eligible for QP `AGR/Q1201`"* — for SSDM, DSC, NSFDC/NSKFDC channelising agencies and
training partners. Exportable per-district, per-project, per-beneficiary, or it is a
parallel system nobody can audit.

---

## 7. Cost, and the constraint that drives it

> **This section's original numbers were audited and found wrong.** The corrected model —
> marginal *and* fixed, at 1,000 and 100,000 beneficiaries, with the legality of each call
> pattern — is in **§9, "The corrected cost model"**. The short version: the plan as first
> drafted was **₹488/head at 1,000**, not ₹5.60, because inbound toll-free bills the
> receiver at a premium and a ₹4.29 lakh/year always-on GPU was excluded. Corrected:
> **₹30.18/head at 1,000, ₹4.04 at 100,000.**

The three levers below survive the correction unchanged, and they are the reason the
corrected number is as low as it is.

1. **Pre-rendering fixed prompts saves ~29% of every call** and ~0.6 s per turn. The seven
   questions never change; there is no reason to pay a machine to re-read them 1,000 times.
2. **DTMF is free.** Every closed-set field that falls back to DTMF costs nothing and is
   perfectly accurate. Under a 26.8-WER ceiling this is the cheapest correctness in the
   system.
3. **The cheapest channel has no vendor in it.** Under a fixed scheme budget with a hard
   administrative cap, a ₹0-marginal-cost channel is not a footnote.

All three open questions handed to the checker came back **answered** (§9):

- Inbound toll-free **does** bill the receiver at a premium — ₹1.20-2.50/min vs ₹0.40-0.90
  on an ordinary DID. Toll-free is out.
- TRAI **is** settled, and it settles in our favour: TCCCPR clause (za) exempts a
  *"Government Voice Call"* from consent and from the Preference Register, provided it runs
  through DLT. So missed-call → callback is legal, with DLT registration and a 1600-series
  number.
- The GPU crossover is **~47,700 four-minute interviews per month**. Pilot scale is two
  orders of magnitude below it. Metered by default.

---

## 8. Privacy, by construction

| Obligation | Where it is implemented |
|---|---|
| Audio is the most sensitive artefact and the least necessary to keep | Transcribed → normalised → confirmed → **discarded within the turn**. No `recording_url` column exists |
| Consent must be spoken, logged, withdrawable | An FSM state, not a checkbox. `consent_event` rows with `script_version` |
| DPDP **Rule 11** — guardian consent for persons with disability (Rule 10 is *children*) | `GUARDIAN_CHECK` branches on **decisional capacity**, not on disability: is a guardian appointed by a court, a designated authority, or a **district local level committee** (National Trust Act)? Yes → defer to assisted mode where the order can be sighted. No → proceed normally. Firing on every mobility disclosure is itself a dignity failure |
| Caste + voice + location + phone is the crown-jewel tuple | The raw MSISDN is never stored — only `hmac(e164, server_pepper)`. Any third-party inference endpoint must be nameable, with jurisdiction |
| Shared handsets | `(phone_hash, ordinal)` + the name gate in §1.2 — nothing from a prior session is spoken before the gate passes |
| Purpose limitation across channels | Consent is per-**beneficiary**, not per-session, and the notice names all channels — otherwise consent given on an IVR call does not cover continuation on WhatsApp. **Flagged for legal check** |

---

## 9. Constraint checker — findings

A separate audit pass ran this spec against R1-R9, the five Basic Issues, the PM-AJAY
guidelines, DPDP Rules 2025 and TCCCPR. Sources retrieved 2026-09-26. Most severe first.
The fixes below are **already folded into §1-§8 above**; this section is the record of
what was wrong and why.

**Coverage before the fixes:** R1, R3, R5, R6, R8 covered · R2, R4, R7, R9 partial ·
**Basic Issues 3 and 4 missing** (1.5 of 5).

### BLOCKER 1 — resume keyed on a phone hash leaks *and* corrupts records

The handset is the shared unit, not the person. Brother redials → `READBACK` speaks his
sister's education, income and *mobility/physical constraints* disclosure aloud, and his
answers write into her `answer` rows under her `consent_event`. Unauthorised disclosure by
a State instrumentality, plus a false record that flows into a district aggregate and
eventually a UC naming her. Structurally, `phone_hash` as identity also admits **one
beneficiary per handset** — which defeats the 30% women target that assisted mode exists
to serve.

**A name gate is not enough — a relative can guess a name.** `phone_hash` becomes a
**non-unique lookup index**. At `CONSENT`, capture a 4-digit **resume PIN by DTMF**
(plumbing already exists, ₹0, 0 WER). On redial to a hash with an open `RESUMABLE`
session: *"continuing an earlier call? enter your four digits. to start a new one,
press 1."* **Reveal nothing, read back nothing, until the PIN clears.** Two failures → new
`beneficiary` row on the same hash. On WhatsApp, resume is **forward-only** — ask the next
unanswered field, never read prior answers into a chat log on a handset you cannot erase.
Kiosk/assisted needs no PIN; the mobiliser is present.

### BLOCKER 2 — the ₹5.60 figure is wrong on its own terms

Three independent errors, all checkable by a judge:

1. **Inbound toll-free bills the receiver at a premium**, not at the outbound rate. ₹5.60
   was derived from ₹0.80-1.00/min, which is the *outbound* benchmark. India benchmarks:
   inbound toll-free **₹1.20-2.50/min**, inbound on a normal DID **₹0.40-0.90/min**.
   Exotel's own support page confirms the mechanism — *"we utilise the software to make an
   outbound call to your users' phone numbers"* — i.e. you pay an outbound leg for every
   inbound call, before the toll-free premium. ⚠ **UNVERIFIED — Exotel's actual toll-free
   rate.** No Indian CPaaS publishes one; they all route to sales. Do not put a toll-free
   number on a cost slide without a written quote.
2. **Bidirectional streaming is a paid add-on.** Exotel's published plans (Dabbler
   ₹9,999/5mo … Influencer ₹49,499/11mo) state *"Voice Streaming (Agent Stream) is
   available separately with additional pricing"*. The whole IVR channel sits on an
   unbudgeted add-on. ⚠ **UNVERIFIED — AgentStream per-minute rate.**
3. **₹5.60 excluded the only large cost in the system** — see MAJOR 1.

### BLOCKER 3 — nothing captures where the beneficiary lives

None of the seven mandated fields is an address. Q7 asks the beneficiary's *opinion* about
their locality; it does not say which district to aggregate them into. A phone prefix does
not resolve to an Indian district, and the NQR carries no geography, so it cannot be
recovered downstream either. Without it, R4's *"region-specific opportunities"* cannot be
produced, the pilot-district opportunity table cannot be joined, and the district demand
report — the whole answer to Basic Issue 1 and to `decisions.md`'s "the customer is a
District Collector" — has no `GROUP BY`.

**Fix:** **Q0 — village/block**, asked before consent alongside the language pick,
resolved against the LGD block list by the same lexicon + phonetic matcher already built
for trades, confirmed by spoken readback. Village names are a closed set per state, so
this is the *easiest* field in the interview. Free on kiosk/assisted — the device knows
its own block. Present Q0 as **registration metadata, not an eighth PS field**, so
"seven fields, verbatim, in order" stays literally true.

### MAJOR 1 — self-hosted IndicConformer costs ₹4.29 lakh/year idle and does not carry the WER argument

The model card confirms 600M params, MIT, **16 kHz input, no streaming/cache-aware mode** —
so it is a full-utterance offline model. Sub-2 s is achievable at batch-1;
⚠ **UNVERIFIED — throughput at concurrency**, and the spec states no concurrency target.

Cost: cheapest INR-billed always-on L4/T4 is **₹49/hour** (E2E Networks) = ₹35,770/month =
**₹4,29,240/year**, paid whether anyone calls or not. Against **Sarvam STT at ₹30/hour of
audio**, break-even is **~47,700 four-minute interviews per month**. At 2-3 pilot
districts the self-hosted GPU is roughly **100× more expensive per beneficiary** than the
API it replaces.

Accuracy: **26.8 on GramVaani is IndicWhisper's number, not IndicConformer's.**
IndicConformer's cited 13.2 is Vaani-Benchmark at near-studio 16 kHz. Upsampling 8 kHz
telephony does not restore the missing band. ⚠ **UNVERIFIED — any published
IndicConformer WER on 8 kHz or dialectal Hindi.**

**Fix:** keep IndicConformer as the *provable sovereign path* — the config value you flip
on stage with the network off — and run **Bhashini or Sarvam metered** as the pilot
default. This is what `02-tech-landscape.md` §1.3 already said; this spec had hardened a
swappable shim into a standing bill. Run the 30-utterance dialect set through **both** and
publish both numbers: that costs a GPU-*hour*, not a GPU-*year*.

### MAJOR 2 — no NEAR-MISS producer, so one of R4's four outputs had nobody emitting it

`decisions.md` settled it on 2026-09-25 and the pipeline as first drafted discarded
ineligible candidates at Stage 0. **Fix:** the gate returns three buckets, and the spoken
tail carries one near-miss with its gap. A return-type change, not an architecture change.

### MAJOR 3 — no PM-DAKSH routing

`decisions.md` settled it, and the guidelines are stronger than a preference: *"only those
components or the beneficiaries which are **not** covered under the Scheme of PM-DAKSH
should be considered"*. As drafted we would recommend GIA-funded training to someone
PM-AJAY is forbidden to fund. **Fix:** Stage 0.5 — age 18-45 ∩ eligible category ∩
NSQF-standard STT ⇒ `ROUTE_TO_PM_DAKSH`, with the ₹1,500/month SC stipend in the spoken
tail. Answers Basic Issue 4 in the same breath.

### MAJOR 4 — DPDP: we cited the wrong rule, and the right one is narrower

**Rule 10 is children. Rule 11 is persons with disability**, and its test is that the
guardian be *"appointed by a court of law, or by a designated authority or by a local
level committee"* under the RPwD Act 2016 / National Trust Act 1999. So the branch must
**not** fire on every mobility disclosure — most beneficiaries with a physical constraint
have no court-appointed guardian and retain full capacity, and treating them as if they
did is itself a dignity failure.

**Fix:** branch on *decisional capacity*, not on disability. `GUARDIAN_CHECK` asks whether
a guardian has been appointed by a court, a designated authority, or a **local level
committee** — the last is the realistic one, it sits at district level under the National
Trust Act, and naming it aloud is the most credible sentence available on a DPDP slide.
Yes → defer to an assisted-mode session where the order can be sighted. No → proceed.

### MAJOR 5 — transcript retention was undefined, and the obvious citation is wrong

**Rule 8's three-year automatic erasure does not apply to us** — it bites only on the
Third Schedule classes (e-commerce ≥2 cr users, online gaming ≥50 lakh, social media
≥2 cr). Citing "three years" in the deck is a checkable error. The operative standard is
the **Second Schedule via Rule 5**: retain *"till required for such uses… or for
compliance with any law"*. Also: **Rules 3 and 5-16 commence 13 May 2027** — so
`decisions.md`'s *"DPDP Rules 2025 are in force"* is imprecise; the Act is, most Rules are
not yet.

**Fix — split the retention:**
- `value`, `confidence`, `method`, `confirmed_at`, `consent_event`, `recommendation` — these
  *are* the purpose and they carry the UC and the DL-PACC minute. Retain for the scheme's
  audit cycle, and name the law.
- `raw_transcript` — purpose fully discharged at `CONFIRM`, and it is 26-60% wrong anyway,
  so its evidentiary value is near zero while its disclosure risk is total. **Erase at
  `CONFIRM`**; keep a hash if an extraction dispute must be defensible. *"We keep neither
  the voice nor the words, only the confirmed answer"* is a stronger sentence than what
  this spec originally claimed.
- Erasure triggers: consent withdrawal, or recommendation delivered **and** the district
  aggregate frozen into the Perspective Plan submission.

### MAJOR 6 — no outcome tracking

Basic Issue 3 and the guidelines' own **70% placement target** (CAG measured 41%) were
both unanswered; the register ended at `recommendation`. **Fix:** one table —
`outcome(beneficiary_id, qualification_code, status, status_date, source)` over
`RECOMMENDED / ENROLLED / CERTIFIED / PLACED / DROPPED`, updated from the mobiliser's call
list, **not** a new officer screen. It converts the district report from *demand* into
*demand and delivery*, which is what a DL-PACC actually argues about.

### MAJOR 7 — WhatsApp question-batching traded R1 and R7 for ₹0.77

Batching makes WhatsApp a form read aloud — the exact thing the PS's first sentence
rejects. Service messages are **₹0.115 each after the first 1,000/month per number**, so
3-into-1 across ~10 turns saves ~₹0.77 per beneficiary and **₹0 for roughly the first 100
beneficiaries each month**. **Fix: one question per message.** If cost bites at 100k, batch
*acknowledgement + next question*, never question + question. §4.3 has been corrected.

Two things §4 got right and should keep: direct-to-Meta is correct (Exotel adds
**₹0.06/message** on top of Meta's rate), and the **30 September 2026 payment-method
deadline** is real — without a card on file Meta stops delivering service messages.

### MINOR 1 — TRAI: the outbound question is resolved, and it resolves *in our favour*

`01-the-customer.md` §9.2 marks this UNVERIFIED and defaults to inbound toll-free. The
**TCCCPR Second Amendment, 12 Feb 2025** settles it. New clause **(za)** defines a
*"Government Message or Government Voice Call"* as one made on the directions of the
Central or State Government or any constitutional body, and states: *"There shall not be
any requirement of seeking Consent for receipt of these communications nor shall there be
any option in the Preference Register to block such communications"* — **provided they go
through the DLT platform.** Amended clause (bw) excludes such communications from UCC when
*"in public interest"*. A PM-AJAY interview call is squarely inside both.

Two obligations attach, and neither was in the spec:
1. **DLT registration as a Principal Entity is mandatory** — an unregistered sender's
   traffic is treated as UCC.
2. **A voicebot is an auto-dialer.** Service/transactional auto-dialled calls run on the
   **1600 series**, and *"all senders shall notify the originating access provider in
   advance about the use of the Auto dialer/Robo-Calls."* TRAI has so far mandated 1600
   only for RBI/SEBI/PFRDA/IRDAI-regulated entities, so MoSJE is not yet compelled — but
   the series exists for exactly this traffic.

**Consequence:** budget a **1600-series number + DLT Principal Entity registration**, and
stop paying the toll-free premium for a regulatory shield we no longer need.

### MINOR 2-4

- **"DTMF on every closed-set field" overstates it.** Of the seven fields, exactly one
  (self vs wage) is natively DTMF-able; education is borderline. DTMF really covers the
  language pick, yes/no confirms and the new PIN — about 3 of ~11 turns. Keep it; don't
  let it anchor the cost model.
- **The Perspective Plan artefact is named but not specified** — no 3.5-4× notional
  projection, no multi-year horizon, no first-week-of-April date, no portal format. The
  differentiator was never the screen, it is the **format and the date**.
- **Two scheme hooks missing from `recommendation`**: the **financial-literacy component
  every course must carry** (Ch.3 ¶7A.a.iv) and the **₹50,000 / 50%-of-project-cost asset
  grant conditional on a bank loan**. Basic Issue 2 names both. Two boolean columns and one
  line in the spoken tail.

### The corrected cost model

Marginal per interview (4 min, ~11 turns, ~90 s of speech, ~600 chars of TTS tail; Sarvam
STT ₹30/hr, TTS ₹3/1,000 chars — Bhashini would be lower or free):

| Pattern | Telephony / messaging | Speech + LLM | **Marginal** | Legality |
|---|---|---|---|---|
| **A — as first drafted**: Exotel inbound toll-free | ₹4.80-10.00 ⚠ + AgentStream ⚠ | ₹2.63 | **₹7.43 - ₹13.88+** | Safe; no DLT needed |
| **B — missed-call → outbound callback** on a normal DID | ₹1.52 (streaming included, 30 s pulse) | ₹2.63 | **₹4.15** | Legal as a Government Voice Call; **needs DLT + 1600-series + auto-dialer pre-declaration** |
| **C — WhatsApp-first**, IVR as fallback | ₹1.15 (₹0 inside the free 1,000/month) | ₹2.63 | **₹3.78** (₹2.63 in free tier) | Outside TCCCPR; needs Meta payment method |
| **D — offline kiosk / assisted** | ₹0 | ₹0 | **₹0** | n/a |

Fixed per year: **₹4,77,000 as first drafted** (always-on L4 GPU + Exotel plan + toll-free
rental ⚠) vs **₹26,400 corrected** (metered speech API + a ₹200/month number + host).

All-in per beneficiary, one year:

| Scale | As first drafted | **C — WhatsApp-first** | **B — missed-call callback** |
|---|---|---|---|
| 1,000 | **₹488** | **₹30.18** | **₹30.55** |
| 100,000 | **₹15.37** | **₹4.04** | **₹4.41** |

**And the framing correction that matters most:** the 5% administrative cap was never the
binding constraint. PM-AJAY's admin head is ~₹107 crore nationally against a ₹2,140 crore
allocation; 100,000 beneficiaries at even ₹15.37 is ₹15.4 lakh — **0.014% of that head**.
Per-minute telephony was never going to break this scheme.

What *does* break it is the **shape** of the spend: a ₹4.29 lakh/year standing GPU bill
that a district PIU must justify before a single call is placed, in a scheme whose own
fifth Basic Issue is that there is nobody at ground level to justify it. Metered by
default; sovereign stack as the switch you demonstrate. Spend the saved ₹4 lakh on the two
things the 5% head is actually short of: **a native-speaker
prompt-writing pass (R7)** and **the 30-utterance dialect measurement (R2)**.

---

## 11. Dialogflow — evaluated, and the answer is "scaffold, not engine"

Raised as a suggestion: build this on **Dialogflow** (`dialogflow.cloud.google.com` — that
link is Dialogflow **ES**, the legacy console; **CX** is the current product). Evaluated
honestly, because it is a reasonable suggestion and the reasons it loses are specific.

### What Dialogflow would actually replace

Dialogflow gives you intent matching, entities, **slot filling with required parameters
and reprompt handlers**, and webhook fulfilment. Mapped onto §2, that is the **interview
FSM plus the NLU layer** — and nothing else. The eligibility gate, the NSQF table, the NQR
corpus and the recommender would still be **our** code, called from a Dialogflow webhook.

> So the direct answer to "can the output be generated from that application" is: **yes,
> but only by calling our backend.** Dialogflow would replace the cheapest and most
> auditable part of the system and none of the hard parts. That asymmetry is the whole
> argument.

### Why it loses as the engine — five specific reasons

| # | Problem | Why it is fatal *here* |
|---|---|---|
| 1 | **Dialogflow's ASR is Google STT** | Google STT scores **59.9 WER** on GramVaani — dialectal telephone Hindi. Worse than one word in two. Our entire technical thesis (§2.3) is an error-absorbing ladder over ASR **n-best**, and Dialogflow matches intents on a single transcript with no hook to insert a phonetic lexicon. The one thing we are better at is the one thing Dialogflow does not let us do |
| 2 | **No offline path** | Cloud-only. That deletes channel 3 (§5) outright — R6, the ₹0 marginal-cost channel, and the aeroplane-mode demo |
| 3 | **It does not remove the telephony vendor** | CX Phone Gateway does not issue Indian DIDs. We would still need Exotel/Plivo, still need DLT, still need the 1600-series — and now we also pay Google per second of audio on top |
| 4 | **Cost is per second of audio, on top of everything** | CX audio billing is roughly **₹5/min** ⚠ — several times the telephony leg it sits on. Verify against Google's current price list before quoting, but the order of magnitude is the point |
| 5 | **Data residency and the sovereign question** | Caste + voice + location + phone number, streamed to a US-headquartered processor, in a MoSJE room where Bhashini exists and is the politically correct answer. `02-tech-landscape.md` §7.1 already warns that *"we use Google"* is a weak answer here |

### Where it genuinely helps, and what to steal from it

- **Speed to a round-1 demo.** The seven-field slot-filling flow is an afternoon in CX
  versus a week hand-rolled. If the schedule slips, CX is a legitimate **temporary**
  implementation behind the §1.1 turn contract — that contract exists precisely so an
  engine can be swapped.
- **Steal the reprompt-handler design.** CX's per-parameter `reprompt_event_handlers`
  (first no-match, second no-match, no-input, then escalate) is exactly the §2.2 sub-FSM,
  refined by a team that ran it at scale. Copy the shape, not the product.
- **Keep it as a fifth provider implementation** behind the same interface as Bhashini /
  IndicConformer / Sarvam / Vosk, if anyone ever asks for it.

### The one-line answer for your senior

> *"Dialogflow's speech engine is Google STT, which scores 59.9 WER on dialectal telephone
> Hindi — it loses three words in five on exactly our user. Our whole design is a
> correction layer over ASR n-best, and Dialogflow only ever hands us one transcript. We
> will use its slot-filling pattern, and we will not use its ears."*

---

## 10. Build order

Only the sequence, because the sequence is where teams lose.

1. **Core first, with no channel at all.** FSM + extraction ladder + `answer` table,
   driven by a CLI that types transcripts in. Everything else plugs into this.
2. **NQR import + eligibility gate.** Already reproduced (`research/03-nqr-import.md`).
   Gate before ranker, always.
3. **Prompt authoring.** Seven questions × four re-prompts × N languages, with a native
   speaker. This is a writing problem, it needs several rounds, and it is the entire demo
   video. **Schedule it first because it slips first.**
4. **Kiosk app.** Cheapest channel, no vendor, proves the core is channel-agnostic.
5. **IVR.** Hardest. Do it against Exotel's mock/sandbox before the real number.
6. **WhatsApp.** Easiest of the three network channels once the core is done.
7. **Officer console + Perspective Plan artefact.** Four of five Basic Issues.
8. **The measurements** — 30-utterance dialect test set, WER vs field-extraction accuracy,
   recommendation spread over a synthetic cohort. Three charts.
