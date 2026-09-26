#!/usr/bin/env python3
"""Build docs/Utsav/research/06-flowchart.excalidraw — the one-page flow, corrected.

Same shape as the hand-drawn version (entry -> adapters -> server -> core -> outputs -> officer),
with the gaps filled and the wiring fixed. Written as a generator so the slide diagram and the
technical spec cannot drift apart.

The five corrections against the hand-drawn version:

  1. Login moved off the shared entry and onto the two doors that can actually have one — the app
     and the officer. IVR and WhatsApp auto-identify from the caller's own number, because a
     keypad phone cannot log in and does not need to.
  2. "Is the reply complex?" replaced by the extraction ladder. The decision is per-field and
     cheapest-first, not per-turn, and the LLM only ever classifies into a closed set.
  3. The Core is filled in. It was an empty box holding the entire product.
  4. The Core now has an OUTPUT arrow. Nothing flowed out of it, so there was no spoken
     recommendation — the whole point for the person on the phone.
  5. Adapters no longer write to the database directly. Everything goes through the core, or the
     FSM ends up living in the adapters and the channels disagree by day three.

Run:  python3 scripts/build_flowchart.py
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from exlib import (  # noqa: E402
    BLU, DBLU, DGRN, DORG, DPUR, DRED, GREY, GRN, ORG, PUR, RED, TEA, WHITE, YEL,
    Scene, sBLU, sGRN, sORG, sPUR, sRED, sTEA,
)

OUT = Path(__file__).resolve().parent.parent / "docs/Utsav/research/06-flowchart.excalidraw"
s = Scene()

# Lane geometry. Four entry lanes across the top, converging to one spine.
LANES = [60, 700, 1340, 1980]     # IVR, WhatsApp, App, Officer
LW = 560                           # lane width
SPINE = 60                         # left edge of the full-width spine
SW = 2480                          # spine width

# ---------------------------------------------------------------------------- title
s.text("t1", SPINE, -140, "SIH26097 — PM-AJAY Voice Livelihood Assistant", 40)
s.text("t2", SPINE, -88, "One core, four doors, two outputs. Every box is something that exists in the repo.", 20, GREY)

# ---------------------------------------------------------------------------- 0. who
y = 0
s.text("h0", SPINE, y, "0 — WHO STARTS IT", 26, DBLU)
y += 40
s.box("who1", LANES[0], y, LW * 3 + 160, 62, BLU, sBLU,
      "SC BENEFICIARY  (the person the scheme is for)", 20)
s.box("who2", LANES[3], y, LW, 62, TEA, sTEA, "DISTRICT OFFICER / PIU", 20)

y += 80
s.arrow("a_who1", LANES[0] + 280, y - 18, 0, 26, sBLU)
s.arrow("a_who2", LANES[1] + 280, y - 18, 0, 26, sBLU)
s.arrow("a_who3", LANES[2] + 280, y - 18, 0, 26, sBLU)
s.arrow("a_who4", LANES[3] + 280, y - 18, 0, 26, sTEA)

# ---------------------------------------------------------------------------- 1. doors
s.text("h1", SPINE, y, "1 — THE FOUR DOORS", 26, DBLU)
y += 40
doors = [
    ("d1", LANES[0], BLU, sBLU, "CALLS THE NUMBER\n₹800 keypad phone · no data, no app\nPS names this channel FIRST"),
    ("d2", LANES[1], GRN, sGRN, "SENDS A WHATSAPP VOICE NOTE\n85.5% of households have a smartphone\nholds mic, speaks, releases"),
    ("d3", LANES[2], ORG, sORG, "OPENS THE APP\nown phone · panchayat kiosk ·\nOR an ASHA/AWW worker at her doorstep"),
    ("d4", LANES[3], TEA, sTEA, "OPENS THE CONSOLE\ndesktop or tablet, indoors"),
]
for eid, x, bg, st, lab in doors:
    s.box(eid, x, y, LW, 96, bg, st, lab, 16)

y += 116
for i, (x, col) in enumerate(zip(LANES, [sBLU, sGRN, sORG, sTEA])):
    s.arrow(f"a_d{i}", x + 280, y - 18, 0, 26, col)

# ---------------------------------------------------------------------------- 2. identity
s.text("h2", SPINE, y, "2 — IDENTITY  (this is where Login belongs — and where it does not)", 26, DBLU)
y += 40
s.box("id1", LANES[0], y, LW, 130, WHITE, sBLU,
      "NO LOGIN — AUTO-IDENTIFY\ncaller number from start.from\n→ hmac(e164, server pepper)\n→ phone_hash\nA keypad phone cannot log in,\nand does not need to.", 15)
s.box("id2", LANES[1], y, LW, 130, WHITE, sGRN,
      "NO LOGIN — AUTO-IDENTIFY\nsender number from the webhook\n→ the SAME phone_hash\nSo a call on Monday and a voice\nnote on Tuesday are one person.", 15)
s.box("id3", LANES[2], y, LW, 130, YEL, sORG,
      "LOGIN / SIGN-UP — PHONE OTP\nSupabase phone auth\nSame number → same phone_hash\n→ the IVR conversation is found\nSKIPPABLE: kiosk mode needs none", 15, sw=3)
s.box("id4", LANES[3], y, LW, 130, YEL, sTEA,
      "ROLE-BASED LOGIN\nofficer · mobiliser · admin\nPostgres RLS scopes every query\nto that person's district.\nNobody sees the country.", 15, sw=3)

y += 150
s.box("idnote", SPINE, y, SW, 96, RED, sRED,
      "THE RESUME RULE — nobody is ever locked out of a welfare line.\n"
      "On any re-contact the caller is offered RESUME or START NEW immediately. No PIN to proceed, ever.\n"
      "RESUME IS FORWARD-ONLY: ask the next unanswered question; nothing already given is spoken back.\n"
      "The 4-digit PIN gates only the two actions that REVEAL — the full readback, and the saved recommendation.", 16)

y += 116
s.arrow("a_id1", LANES[0] + 280, y - 18, 0, 26, sBLU)
s.arrow("a_id2", LANES[1] + 280, y - 18, 0, 26, sGRN)
s.arrow("a_id3", LANES[2] + 280, y - 18, 0, 26, sORG)

# ---------------------------------------------------------------------------- 3. adapters
s.text("h3", SPINE, y, "3 — THIN ADAPTERS  (transport in, prompt out. No interview logic lives here)", 26, DBLU)
y += 40
s.box("ad1", LANES[0], y, LW, 250, WHITE, sBLU, sw=2)
s.text("ad1t", LANES[0] + 16, y + 10, "IVR ADAPTER", 19, DBLU)
s.text("ad1b", LANES[0] + 16, y + 40,
       "· Exotel AgentStream, bidirectional WebSocket\n"
       "· 8 kHz L16 mono PCM, base64, 20 ms frames\n"
       "· VAD endpointing — 12 silent frames = 240 ms\n"
       "· Adaptive noise floor (a village line is not a lab)\n"
       "· BARGE-IN: caller speaks → send `clear`,\n"
       "  kill the send queue, go back to LISTEN\n"
       "· DTMF capture — language, yes/no, digits\n"
       "· Resample 8k → 16k (format fix, not quality)\n"
       "· Pre-rendered WAV playback, real-time paced\n"
       "· Call drops → session RESUMABLE, answers persist", 14)

s.box("ad2", LANES[1], y, LW, 250, WHITE, sGRN, sw=2)
s.text("ad2t", LANES[1] + 16, y + 10, "WHATSAPP ADAPTER", 19, DGRN)
s.text("ad2b", LANES[1] + 16, y + 40,
       "· Meta Cloud API DIRECT (no reseller markup)\n"
       "· Webhook → media_id → short-lived signed URL\n"
       "· Download OGG/Opus → decode → 16 kHz PCM\n"
       "· X-Hub-Signature-256 verified, else dropped\n"
       "· REPLIES AS A VOICE NOTE, never as text\n"
       "  (a text reply fails people who cannot read)\n"
       "· Prompt audio pre-uploaded once, media id reused\n"
       "· Interactive reply buttons when expect = enum\n"
       "· ONE QUESTION PER MESSAGE — batching was\n"
       "  costed at ₹0.77/head and rejected: it is a form", 14)

s.box("ad3", LANES[2], y, LW, 250, WHITE, sORG, sw=2)
s.text("ad3t", LANES[2] + 16, y + 10, "APP ADAPTER  (Capacitor / Android)", 19, DORG)
s.text("ad3b", LANES[2] + 16, y + 40,
       "· minSdk 24 — runs on a ₹6,000 handset\n"
       "· Mic → Web Audio → 16 kHz mono WAV\n"
       "· Native Android TTS for speech out\n"
       "· Tap to start, tap to stop, auto-stop on silence\n"
       "· IndexedDB now / SQLite on device — same row\n"
       "  shape as Postgres, same CHECK constraints\n"
       "· OUTBOX: syncs itself when signal returns.\n"
       "  She never has to remember to press sync\n"
       "· FALLBACK ASR on device when offline\n"
       "· Full interview completes in aeroplane mode", 14)

s.box("ad4", LANES[3], y, LW, 250, TEA, sTEA, sw=2)
s.text("ad4t", LANES[3] + 16, y + 10, "OFFICER CONSOLE", 19, "#0e7490")
s.text("ad4b", LANES[3] + 16, y + 40,
       "Reads the database directly (RLS-scoped).\n"
       "Does NOT go through /v1/turn — it is not\n"
       "an interview, it is a report.\n\n"
       "Detail in section 8.", 15)

y += 270
# Three channels converge on one contract.
s.elbow("cv1", LANES[0] + 280, y - 20, [[0, 0], [0, 40], [1180, 40], [1180, 70]], sBLU)
s.elbow("cv2", LANES[1] + 280, y - 20, [[0, 0], [0, 40], [540, 40], [540, 70]], sGRN)
s.elbow("cv3", LANES[2] + 280, y - 20, [[0, 0], [0, 40], [-100, 40], [-100, 70]], sORG)

y += 90
# ---------------------------------------------------------------------------- 4. contract
s.box("contract", 700, y, 1180, 96, YEL, sORG,
      "ONE CONTRACT — POST /v1/turn\n"
      "{ channel, channelRef, identity, utterance, localeHint }  →  { say[], expect, state, progress }\n"
      "No channel knows what is inside. If the FSM ever moves into an adapter, WhatsApp becomes a\n"
      "second copy of the same seven questions and they disagree by day three.", 16, sw=3)

y += 116
s.arrow("a_c", 1290, y - 18, 0, 26, sORG)

# ---------------------------------------------------------------------------- 5. speech
s.text("h5", SPINE, y, "5 — SPEECH  (server-side. This is the part that was unclear: it is NOT on the phone)", 26, DBLU)
y += 40
s.box("sp1", SPINE, y, 1200, 190, WHITE, sPUR, sw=2)
s.text("sp1t", SPINE + 16, y + 10, "SPEECH → TEXT", 19, DPUR)
s.text("sp1b", SPINE + 16, y + 40,
       "Audio is sent to the ASR provider, transcribed, and DISCARDED inside the turn.\n"
       "It is never written to disk and there is no recording_url column anywhere.\n\n"
       "PROVIDER IS ONE CONFIG VALUE — the switch is the differentiator, not the model:\n"
       "   Sarvam saaras:v3   LIVE — 228-322 ms measured, 22 languages, Indian region\n"
       "   Bhashini / ULCA    sovereign path, free for non-commercial\n"
       "   IndicConformer     MIT, self-hosted — the one you flip on stage\n"
       "   Vosk on-device     ~50 MB, genuinely offline, for the kiosk", 14)

s.box("sp2", 1300, y, 1240, 190, RED, sRED, sw=2)
s.text("sp2t", 1316, y + 10, "THE DIALECT PROBLEM, STATED HONESTLY", 19, DRED)
s.text("sp2b", 1316, y + 40,
       "Maithili IS covered (mai-IN) — it is Eighth Schedule.\n\n"
       "Bhojpuri 5.05 cr · Rajasthani 2.58 cr · Chhattisgarhi 1.62 cr · Magahi 1.27 cr\n"
       "≈ 11 crore speakers with NO model at Sarvam, at Bhashini, or open-source.\n"
       "They are sent to the Hindi model because there is nothing else to send them to.\n\n"
       "We do NOT claim a dialect model. We absorb the error in the lexicon below,\n"
       "and we publish WER beside field-extraction accuracy. Dual-pass for these four:\n"
       "a second call with language_code=unknown, to get a genuine alternate.", 14)

y += 210
s.arrow("a_sp", 1290, y - 18, 0, 26, sPUR)

# ---------------------------------------------------------------------------- 6. ladder
s.text("h6", SPINE, y, "6 — EXTRACTION LADDER  (replaces \"is the reply complex?\" — the decision is per FIELD, cheapest first)", 26, DBLU)
y += 44
rungs = [
    ("r0", BLU, sBLU, "RUNG 0   DTMF keypress / on-screen tap                    ₹0  ·  0 ms  ·  0 WER", 2),
    ("r1", GRN, sGRN, "RUNG 1   VERNACULAR LEXICON — phonetic + fuzzy over n-best    ~₹0 · ~5 ms · ~70% of turns", 3),
    ("r2", GRN, sGRN, "RUNG 2   Numeric / class-level regex — \"8th\", \"दसवीं\", \"बारह साल\"    ~₹0 · ~2 ms · Q1 and Q2-years", 2),
    ("r3", PUR, sPUR, "RUNG 3   LLM — ONLY \"which of these N options did they mean?\"      1 call · 400-1200 ms · uncommon", 2),
    ("r4", ORG, sORG, "RUNG 4   Spoken confirmation — catches whatever the rest got wrong   1 turn · ~4 s", 2),
]
for i, (eid, bg, st, lab, sw) in enumerate(rungs):
    s.box(eid, SPINE, y + i * 52, SW, 44, bg, st, lab, 15, sw=sw, align="left")

y += len(rungs) * 52 + 6
s.box("lad_n", SPINE, y, 1200, 120, YEL, sORG,
      "STOP ON THE FIRST RUNG THAT FIRES.\n"
      "Low confidence is a RE-ASK, not an error — which is what a\n"
      "considerate human interviewer does anyway.\n"
      "conf ≥ 0.85 → confirm · 0.55-0.85 → explicit readback · < 0.55 → re-ask (max 2)\n"
      "after 2 re-asks → DTMF fallback → else DEFER and move on.", 15)

s.box("llm_n", 1300, y, 1240, 120, PUR, sPUR,
      "WHAT THE LLM ACTUALLY RECEIVES\n"
      "The transcript, and a list of options. That is all.\n"
      "No name · no phone number · no district · no caste marker.\n"
      "OpenRouter (cheap, swappable) for the common case;\n"
      "Sarvam-M as the one-config-value sovereign switch for the jury.", 15)

y += 140
s.arrow("a_lad", 1290, y - 18, 0, 26, sPUR)

# ---------------------------------------------------------------------------- 7. core
s.text("h7", SPINE, y, "7 — THE CORE  (this was the empty box. It is the entire product)", 26, DPUR)
y += 44
s.box("corez", SPINE, y, SW, 430, "#e5dbff", sPUR, sw=1, opacity=30)

s.box("c1", SPINE + 24, y + 20, SW - 48, 54, TEA, sTEA,
      "1.  IDENTITY & SESSION RESOLVE — phone_hash → beneficiary. Answers hang off beneficiary_id, NEVER session_id.", 15)

s.box("c2", SPINE + 24, y + 88, 1180, 210, WHITE, sPUR, sw=2)
s.text("c2t", SPINE + 40, y + 96, "2.  INTERVIEW FSM — seven PS fields, in order, not an agent", 17, DPUR)
s.text("c2b", SPINE + 40, y + 124,
       "LANG_SELECT → Q0 village/block (registration metadata, not an 8th field)\n"
       "→ CONSENT (≤15 s, spoken, logged with script_version)\n"
       "→ Q1 education · Q2 family trade + years · Q3 current livelihood\n"
       "→ Q4 skills & interests · Q5 mobility/constraints · Q6 self vs wage\n"
       "→ Q7 local economy  →  READBACK (all seven, spoken yes)\n"
       "→ RECOMMEND → NEXT_STEP → CLOSE\n\n"
       "Q5 may branch to GUARDIAN_CHECK — on DECISIONAL CAPACITY, not on\n"
       "disability (DPDP Rule 11, not Rule 10).", 14)

s.box("c3", 1300, y + 88, 1240, 210, WHITE, sGRN, sw=2)
s.text("c3t", 1316, y + 96, "4.  RECOMMENDER — gate, THEN rank. Never rank then gate", 17, DGRN)
s.text("c3b", 1316, y + 124,
       "STAGE 0    ELIGIBILITY GATE — rules only, no model, no score.\n"
       "           NSQF entry rules vs (education ∪ experience substitution).\n"
       "           Returns THREE buckets: ELIGIBLE / NEAR_MISS(gap) / INELIGIBLE\n"
       "STAGE 0.5  PM-DAKSH ROUTING — the guidelines forbid overlap by name\n"
       "STAGE 1    RETRIEVE over the eligible set only\n"
       "STAGE 2    RANK — weights written down and versioned, + spread penalty\n"
       "STAGE 3    EXPLAIN ×3 — beneficiary / officer / auditor,\n"
       "           from the same scored object", 14)

s.box("c4", SPINE + 24, y + 316, SW - 48, 90, TEA, sTEA,
      "3.  PROFILE — per field: value, confidence, method (DTMF|LEXICON|REGEX|LLM), asr_engine, confirmed_at.\n"
      "raw_transcript is ERASED AT CONFIRM — a Postgres CHECK makes it impossible to keep. Audio was already gone.\n"
      "\"We keep neither the voice nor the words, only the confirmed answer.\"", 15)

y += 450
s.elbow("out1", 700, y - 20, [[0, 0], [0, 40], [-380, 40], [-380, 80]], sGRN)
s.elbow("out2", 1880, y - 20, [[0, 0], [0, 40], [400, 40], [400, 80]], sTEA)

y += 100
# ---------------------------------------------------------------------------- 8. outputs
s.text("h8", SPINE, y, "8 — TWO OUTPUTS, NOT ONE", 26, DGRN)
y += 40
s.box("b1", SPINE, y, 1200, 210, GRN, sGRN, sw=3)
s.text("b1t", SPINE + 16, y + 10, "B1 — TO THE BENEFICIARY, SPOKEN, ≤ 60 s", 19, DGRN)
s.text("b1b", SPINE + 16, y + 42,
       "Back down the SAME channel she arrived on.\n\n"
       "· Top 3 qualifications she is actually ELIGIBLE for\n"
       "· 1 NEAR-MISS with the exact gap — \"one more year\", or\n"
       "  \"do the Level 2 course first\".  THIS IS R4's 4th OUTPUT\n"
       "· One plain sentence of reason each. No scheme jargon.\n"
       "· PM-DAKSH hand-off + ₹1,500/month stipend, where it applies\n"
       "· ₹50,000 asset grant (needs a bank loan) where it applies\n"
       "· What to do on Monday, and the nearest centre\n"
       "· Repeatable on demand — call back and press 9", 14)

s.box("b2", 1300, y, 1240, 210, TEA, sTEA, sw=3)
s.text("b2t", 1316, y + 10, "B2 — TO POSTGRES, THEN TO THE OFFICER", 19, "#0e7490")
s.text("b2b", 1316, y + 42,
       "Every recommendation is stored with:\n"
       "   weights_version · engine_version · nqr_snapshot_sha · the inputs\n\n"
       "In 2030 somebody will ask why this person was sent to this trade.\n"
       "The answer has to be a ROW, not a prompt.\n\n"
       "NOTE THE DIRECTION: adapters never write to the database.\n"
       "Everything passes through the core first — otherwise the gate and\n"
       "the FSM can be bypassed and the register fills with ungated rows.", 14)

y += 230
s.arrow("a_b2", 1920, y - 20, 0, 28, sTEA)

# ---------------------------------------------------------------------------- 9. officer
s.text("h9", SPINE, y, "9 — THE OFFICER HALF  (four of the five \"Basic Issues under GIA\" live here)", 26, "#0e7490")
y += 44
cards = [
    ("o1", SPINE, "BASIC ISSUE 1 — PERSPECTIVE PLAN\n"
                  "Aggregated demand → the statutory artefact.\n"
                  "3.5-4× the notional allocation, multi-year.\n"
                  "DL-PACC submits via the portal\n"
                  "*** DUE THE FIRST WEEK OF APRIL ***\n"
                  "Demand data arriving in July is worthless.\n"
                  "The differentiator is the FORMAT and the DATE,\n"
                  "not the dashboard."),
    ("o2", SPINE + 630, "BASIC ISSUE 2 — IDENTIFICATION &\nFINANCIAL LINKAGE\n"
                        "· Verified beneficiary register\n"
                        "· Consent register — every row carries the\n"
                        "  script_version the person actually heard\n"
                        "· Financial-literacy module flag (compulsory\n"
                        "  in every course, Ch.3 ¶7A.a.iv)\n"
                        "· ₹50,000 asset-grant eligibility flag"),
    ("o3", SPINE + 1260, "BASIC ISSUE 3 — PLACEMENT\n"
                         "outcome: RECOMMENDED → ENROLLED →\n"
                         "CERTIFIED → PLACED → DROPPED\n"
                         "Updated from the mobiliser's call list,\n"
                         "NOT from a new officer screen.\n"
                         "Guidelines mandate 70% placement.\n"
                         "CAG measured PMKVY at 41%.\n"
                         "Turns 'demand' into 'demand AND delivery'."),
    ("o4", SPINE + 1890, "BASIC ISSUE 4 — CONVERGENCE\n"
                         "Batch export: \"240 people in this block\n"
                         "want and are eligible for QP AGR/Q1201\"\n"
                         "→ SSDM · DSC · NSFDC / NSKFDC ·\n"
                         "  training partners\n"
                         "+ PM-DAKSH routing counts\n"
                         "Per-district, per-project, per-beneficiary."),
]
for eid, x, lab in cards:
    s.box(eid, x, y, 590, 200, TEA, sTEA, lab, 14)

y += 220
s.box("o5", SPINE, y, 1200, 120, YEL, sORG,
      "BASIC ISSUE 5 — \"INADEQUATE TECHNICAL AND SUPPORT TEAM AT GROUND LEVEL\"\n"
      "The assistant IS the ground-level team. This is the scheme's own written statement of why\n"
      "automation. Every extra screen we add is a screen somebody must be trained on out of a\n"
      "5% administrative budget — so the mobiliser gets ONE list, not a console.", 15)

s.box("o6", 1300, y, 1240, 120, RED, sRED,
      "MEASURE SPREAD, NOT JUST RELEVANCE\n"
      "CAG: 40% of all certifications in 10 job-roles; 90.35% of \"Green Jobs\" in Safai Karmchari alone.\n"
      "If our recommendations concentrate the same way, we have automated the failure with better UX.\n"
      "So the ranker carries a spread PENALTY, and the console plots the distribution against that line.", 15)

y += 145
# ---------------------------------------------------------------------------- 10. cross-cutting
s.text("h10", SPINE, y, "10 — TRUE EVERYWHERE, ON EVERY CHANNEL", 26, DRED)
y += 44
s.box("x1", SPINE, y, 810, 170, WHITE, sRED, sw=2)
s.text("x1t", SPINE + 16, y + 10, "PRIVACY, BY CONSTRUCTION", 18, DRED)
s.text("x1b", SPINE + 16, y + 40,
       "· Audio discarded inside the turn. No recording_url column exists.\n"
       "· raw_transcript erased at CONFIRM — enforced by a DB CHECK,\n"
       "  on the server AND in the on-device SQLite schema.\n"
       "· Raw phone number never stored — only hmac(e164, pepper),\n"
       "  and the pepper never leaves the server.\n"
       "· Consent is an FSM STATE, logged with its script version,\n"
       "  withdrawable, and it names all four channels.\n"
       "· Guardian branch fires on decisional capacity, not disability.", 14)

s.box("x2", SPINE + 840, y, 810, 170, WHITE, sORG, sw=2)
s.text("x2t", SPINE + 856, y + 10, "CROSS-CHANNEL RESUME", 18, DORG)
s.text("x2b", SPINE + 856, y + 40,
       "One person, one profile. Sessions are disposable.\n\n"
       "IVR Monday 11:02, drops at Q4\n"
       "  → WhatsApp Monday 18:40, resumes AT Q4\n"
       "     → kiosk Tuesday, finishes Q5-Q7\n\n"
       "Confirmed answers are immutable. Only unconfirmed\n"
       "fields are ever re-asked. Multiple people per handset\n"
       "is the NORMAL case, carried by (phone_hash, ordinal).", 14)

s.box("x3", SPINE + 1680, y, 800, 170, WHITE, sGRN, sw=2)
s.text("x3t", SPINE + 1696, y + 10, "PROVENANCE", 18, DGRN)
s.text("x3b", SPINE + 1696, y + 40,
       "· NQR official export — 2,814 rows, sha-stamped.\n"
       "  Fields the source omits are NULL, never guessed.\n"
       "  NO INVENTED QP CODES, EVER. Prototype rows carry\n"
       "  qp_code = NULL and the UI says so in amber.\n"
       "· NSQF 2023 entry table — typed by hand, <100 rows.\n"
       "  This IS the eligibility engine.\n"
       "· NCO-2015 is a SIGNAL ONLY — NCVET found 156 of\n"
       "  2,157 mis-mapped and 256 unmappable.\n"
       "· Opportunity rows carry source + source_date or\n"
       "  are excluded from the Perspective Plan export.", 14)

y += 195
s.box("foot", SPINE, y, SW, 70, "#e5dbff", sPUR,
      "WHY AN FSM AND NOT AN LLM AGENT: every turn is replayable, every extraction is a logged (transcript → value, confidence)\n"
      "pair, and the model can never invent an eighth question in front of a jury. When CAG audits this in 2029, the answer is a row.", 16)

s.save(OUT)
