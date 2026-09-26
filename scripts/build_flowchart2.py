#!/usr/bin/env python3
"""Build docs/Utsav/research/07-flowchart.excalidraw — v2, with the layout fixed.

What was wrong with v1, and is fixed here:

  1. The district officer sat in the same row as the three beneficiary doors, so it read as a
     FOURTH beneficiary channel. It is not — the officer never touches an adapter or the FSM. The
     officer now has its own column, on the far side of a divider, with its own top-to-bottom flow.
  2. The officer column had no arrows at all after the role-based login.
  3. Nothing connected the database to the officer, so the reporting half looked unattached to
     the system that feeds it. There is now an explicit arrow crossing the divider.
  4. Section 4's heading was missing, so the numbering jumped 3 → 5.
  5. Free-floating text sized by eye spilled outside its boxes. Every box is now measured from its
     own text, and `Scene.validate` re-checks fit, overlap and containment before the file is
     written — the checks a reviewer had to perform by eye on v1.

Run:  python3 scripts/build_flowchart2.py
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from exlib import (  # noqa: E402
    BLU, DBLU, DGRN, DORG, DPUR, DRED, GREY, GRN, ORG, PUR, RED, TEA, WHITE, YEL,
    Scene, sBLU, sGRN, sORG, sPUR, sRED, sTEA,
)

OUT = Path(__file__).resolve().parent.parent / "docs/Utsav/research/07-flowchart.excalidraw"
s = Scene()

# ---------------------------------------------------------------------------- geometry
# Main column is the BENEFICIARY journey. The officer lives across a divider because the officer
# does not travel this path at all — they read what it produces.
MX = 60                 # main column left
LANE = 600              # one door lane
GAP = 60
MW = LANE * 3 + GAP * 2  # 1920 — main column width
L = [MX, MX + LANE + GAP, MX + 2 * (LANE + GAP)]  # 60, 720, 1380

DIV = MX + MW + 80      # 2060 — divider
OX = DIV + 60           # 2120 — officer column left
OW = 640                # officer column width

ZONES: set[str] = set()


def head(eid, y, text, colour=DBLU, x=MX):
    s.text(eid, x, y, text, 24, colour)
    return y + 38


# ---------------------------------------------------------------------------- title
s.text("t1", MX, -150, "SIH26097 — PM-AJAY Voice Livelihood Assistant", 40)
s.text("t2", MX, -96, "One core, three doors for the beneficiary, one console for the officer. Every box exists in the repo.", 19, GREY)

# ============================================================================ MAIN COLUMN
y = 0
y = head("h0", y, "0 — WHO STARTS IT")
s.box("who", MX, y, MW, 56, BLU, sBLU, "SC BENEFICIARY  —  the person the scheme exists for", 20)
y += 56
s.arrow("a0a", L[0] + LANE / 2, y + 6, 0, 30, sBLU)
s.arrow("a0b", L[1] + LANE / 2, y + 6, 0, 30, sBLU)
s.arrow("a0c", L[2] + LANE / 2, y + 6, 0, 30, sBLU)
y += 50

# ---------------------------------------------------------------------------- 1 doors
y = head("h1", y, "1 — THREE DOORS INTO THE SAME INTERVIEW")
doors = [
    ("d1", L[0], BLU, sBLU,
     "CALLS THE TOLL NUMBER\n₹800 keypad phone. No data, no app.\nThe PS names this channel FIRST."),
    ("d2", L[1], GRN, sGRN,
     "SENDS A WHATSAPP VOICE NOTE\n85.5% of households have a smartphone.\nHolds the mic, speaks, releases."),
    ("d3", L[2], ORG, sORG,
     "OPENS THE APP\nHer own phone, a panchayat kiosk, or an\nASHA / AWW worker at her doorstep."),
]
dh = 0
for eid, x, bg, st, lab in doors:
    e = s.fitbox(eid, x, y, LANE, bg, st, label=lab, size=15, pad=16, min_h=92)
    dh = max(dh, e["height"])
y += dh
for i, x in enumerate(L):
    s.arrow(f"a1{i}", x + LANE / 2, y + 6, 0, 30, [sBLU, sGRN, sORG][i])
y += 50

# ---------------------------------------------------------------------------- 2 identity
y = head("h2", y, "2 — IDENTITY  (phone number is the key — but only one door can show a login)")
ids = [
    ("i1", L[0], WHITE, sBLU,
     "NO LOGIN — AUTO-IDENTIFY\ncaller number from start.from\n→ hmac(e164, server pepper)\n→ phone_hash\nA keypad phone cannot log in,\nand does not need to."),
    ("i2", L[1], WHITE, sGRN,
     "NO LOGIN — AUTO-IDENTIFY\nsender number from the webhook\n→ the SAME phone_hash.\nSo a call on Monday and a voice\nnote on Tuesday are one person."),
    ("i3", L[2], YEL, sORG,
     "LOGIN / SIGN-UP — PHONE OTP\nSame number → same phone_hash\n→ the earlier IVR conversation\n   is found and offered.\nSKIPPABLE — kiosk mode needs none."),
]
ih = 0
for eid, x, bg, st, lab in ids:
    e = s.fitbox(eid, x, y, LANE, bg, st, label=lab, size=14, pad=16, min_h=130)
    ih = max(ih, e["height"])
y += ih + 16

s.fitbox("resume", MX, y, MW, RED, sRED, size=15, pad=16,
         label="THE RESUME RULE — nobody is ever locked out of a welfare line.\n"
               "On any re-contact she is offered RESUME or START NEW immediately. No PIN to proceed, ever.\n"
               "RESUME IS FORWARD-ONLY: ask the next unanswered question; nothing already given is spoken back.\n"
               "The 4-digit PIN gates only the two actions that REVEAL — the full readback, and the saved recommendation.")
y = s.byid("resume")["y"] + s.byid("resume")["height"]
for i, x in enumerate(L):
    s.arrow(f"a2{i}", x + LANE / 2, y + 6, 0, 30, [sBLU, sGRN, sORG][i])
y += 50

# ---------------------------------------------------------------------------- 3 adapters
y = head("h3", y, "3 — THIN ADAPTERS  (transport in, prompt out. No interview logic lives here)")
ads = [
    ("ad1", L[0], sBLU, DBLU, "IVR ADAPTER",
     "· Exotel AgentStream, bidirectional WebSocket\n"
     "· 8 kHz L16 mono PCM, base64, 20 ms frames\n"
     "· VAD endpointing — 12 silent frames = 240 ms\n"
     "· Adaptive noise floor: a village line is not a lab\n"
     "· BARGE-IN — she speaks, we send `clear`, kill\n"
     "  the send queue and go back to LISTEN\n"
     "· DTMF capture: language, yes/no, digits\n"
     "· Resample 8k → 16k (a format fix, not quality)\n"
     "· Pre-rendered WAV playback, real-time paced\n"
     "· Call drops → RESUMABLE, answers persist"),
    ("ad2", L[1], sGRN, DGRN, "WHATSAPP ADAPTER",
     "· Meta Cloud API DIRECT — no reseller markup\n"
     "· Webhook → media_id → short-lived signed URL\n"
     "· Download OGG/Opus → decode → 16 kHz PCM\n"
     "· X-Hub-Signature-256 verified, else dropped\n"
     "· REPLIES AS A VOICE NOTE, never as text — a\n"
     "  text reply fails people who cannot read\n"
     "· Prompt audio uploaded once, media id reused\n"
     "· Reply buttons when expect = enum\n"
     "· ONE QUESTION PER MESSAGE. Batching saves\n"
     "  ₹0.77/head and was rejected: it is a form"),
    ("ad3", L[2], sORG, DORG, "APP ADAPTER  (Capacitor / Android)",
     "· minSdk 24 — runs on a ₹6,000 handset\n"
     "· Mic → Web Audio → 16 kHz mono WAV\n"
     "· Native Android TTS for speech out\n"
     "· Tap to start, tap to stop, auto-stop on silence\n"
     "· IndexedDB now / SQLite on device — same row\n"
     "  shape and same CHECKs as Postgres\n"
     "· OUTBOX syncs itself when signal returns. She\n"
     "  never has to remember to press sync\n"
     "· On-device fallback ASR when offline\n"
     "· A full interview completes in aeroplane mode"),
]
ah = 0
for eid, x, st, tc, title, body in ads:
    e = s.fitbox(eid, x, y, LANE, WHITE, st, label=body, size=13, pad=14, title=title, title_size=17, title_color=tc)
    ah = max(ah, e["height"])
y += ah + 10

# Three lanes converge on one contract. Sharp elbows, not curves.
mid = MX + MW / 2
for i, (x, col) in enumerate(zip(L, [sBLU, sGRN, sORG])):
    sx = x + LANE / 2
    s.elbow(f"cv{i}", sx, y, [[0, 0], [0, 34], [mid - sx, 34], [mid - sx, 74]], col)
y += 90

# ---------------------------------------------------------------------------- 4 contract
y = head("h4", y, "4 — ONE CONTRACT")
s.fitbox("contract", MX + 180, y, MW - 360, YEL, sORG, size=15, pad=16, sw=3,
         label="POST /v1/turn\n"
               "{ channel, channelRef, identity, utterance, localeHint }  →  { say[], expect, state, progress }\n"
               "No channel knows what is inside. If the FSM ever moves into an adapter, WhatsApp becomes a\n"
               "second copy of the same seven questions and they disagree by day three.")
y = s.byid("contract")["y"] + s.byid("contract")["height"]
s.arrow("a4", mid, y + 6, 0, 30, sORG)
y += 50

# ---------------------------------------------------------------------------- 5 speech
y = head("h5", y, "5 — SPEECH  (server-side. This is the part that was unclear: it is NOT on the phone)")
half = (MW - GAP) / 2
e1 = s.fitbox("sp1", MX, y, half, WHITE, sPUR, size=13, pad=14, title="SPEECH → TEXT", title_size=17, title_color=DPUR,
              label="Audio is sent to the ASR provider, transcribed, and DISCARDED\n"
                    "inside the turn. It is never written to disk, and no\n"
                    "recording_url column exists anywhere in the schema.\n\n"
                    "THE PROVIDER IS ONE CONFIG VALUE — the switch is the\n"
                    "differentiator, not the model:\n"
                    "   Sarvam saaras:v3   LIVE — 228-322 ms measured, Indian region\n"
                    "   Bhashini / ULCA    the sovereign path, free non-commercial\n"
                    "   IndicConformer     MIT, self-hosted — flip it on stage\n"
                    "   Vosk on-device     ~50 MB, genuinely offline, for the kiosk")
e2 = s.fitbox("sp2", MX + half + GAP, y, half, RED, sRED, size=13, pad=14,
              title="THE DIALECT PROBLEM, STATED HONESTLY", title_size=17, title_color=DRED,
              label="Maithili IS covered (mai-IN) — it is Eighth Schedule.\n\n"
                    "Bhojpuri 5.05 cr · Rajasthani 2.58 cr\n"
                    "Chhattisgarhi 1.62 cr · Magahi 1.27 cr\n"
                    "≈ 11 crore speakers with NO model at Sarvam, at Bhashini,\n"
                    "or anywhere open-source. They go to the Hindi model because\n"
                    "there is nothing else to send them to.\n\n"
                    "We do NOT claim a dialect model. The error is absorbed by the\n"
                    "lexicon below, and WER is published beside field accuracy.\n"
                    "Dual-pass for those four: a second call with language_code=unknown.")
y += max(e1["height"], e2["height"])
s.arrow("a5", mid, y + 6, 0, 30, sPUR)
y += 50

# ---------------------------------------------------------------------------- 6 ladder
y = head("h6", y, "6 — EXTRACTION LADDER  (this replaces “is the reply complex?” — the decision is per FIELD, cheapest first)")
rungs = [
    ("r0", BLU, sBLU, "RUNG 0    DTMF keypress / on-screen tap                                    ₹0  ·  0 ms  ·  0 WER", 2),
    ("r1", GRN, sGRN, "RUNG 1    VERNACULAR LEXICON — phonetic + fuzzy over ASR n-best           ~₹0  ·  ~5 ms  ·  ~70% of turns", 3),
    ("r2", GRN, sGRN, "RUNG 2    Numeric / class-level regex — “8th”, “दसवीं”, “बारह साल”            ~₹0  ·  ~2 ms  ·  Q1 and Q2-years", 2),
    ("r3", PUR, sPUR, "RUNG 3    LLM — ONLY “which of these N options did they mean?”              1 call  ·  400-1200 ms  ·  uncommon", 2),
    ("r4", ORG, sORG, "RUNG 4    Spoken confirmation — catches whatever the rest got wrong        1 turn  ·  ~4 s", 2),
]
for i, (eid, bg, st, lab, sw) in enumerate(rungs):
    s.box(eid, MX, y + i * 50, MW, 42, bg, st, lab, 14, sw=sw, align="left")
y += len(rungs) * 50 + 8

n1 = s.fitbox("lad_n", MX, y, half, YEL, sORG, size=14, pad=14,
              label="STOP ON THE FIRST RUNG THAT FIRES.\n"
                    "Low confidence is a RE-ASK, not an error — which is what a\n"
                    "considerate human interviewer does anyway.\n\n"
                    "conf ≥ 0.85 → confirm\n"
                    "0.55 – 0.85  → explicit spoken readback\n"
                    "< 0.55        → re-ask, max 2\n"
                    "after 2       → DTMF fallback, else DEFER and move on")
n2 = s.fitbox("llm_n", MX + half + GAP, y, half, PUR, sPUR, size=14, pad=14,
              label="WHAT THE LLM ACTUALLY RECEIVES\n"
                    "The transcript, and a list of options. That is all.\n\n"
                    "No name · no phone number · no district · no caste marker.\n\n"
                    "OpenRouter for the common case — cheap and swappable.\n"
                    "Sarvam-M as the one-config-value sovereign switch, because\n"
                    "“we can run this on Indian infrastructure” is a sentence\n"
                    "worth being able to say in a MoSJE room.")
y += max(n1["height"], n2["height"])
s.arrow("a6", mid, y + 6, 0, 30, sPUR)
y += 50

# ---------------------------------------------------------------------------- 7 core
y = head("h7", y, "7 — THE CORE  (this was the empty box. It is the entire product)", DPUR)
core_top = y
s.box("corez", MX - 14, y - 10, MW + 28, 10, "#e5dbff", sPUR, sw=1, opacity=30)  # resized below
ZONES.add("corez")

c1 = s.fitbox("c1", MX, y, MW, TEA, sTEA, size=14, pad=14,
              label="1.  IDENTITY & SESSION RESOLVE — phone_hash → beneficiary. "
                    "Answer rows hang off beneficiary_id, NEVER session_id.\n"
                    "     That one line is what lets a dropped call on Monday finish on a kiosk on Tuesday.")
y += c1["height"] + 14

c2 = s.fitbox("c2", MX, y, half, WHITE, sPUR, size=13, pad=14,
              title="2.  INTERVIEW FSM — seven PS fields, in order, not an agent",
              title_size=16, title_color=DPUR,
              label="LANG_SELECT\n"
                    "→ Q0 village / block   (registration metadata, not an 8th field)\n"
                    "→ CONSENT   ≤15 s, spoken, logged with its script_version\n"
                    "→ Q1 education\n"
                    "→ Q2 family trade + years        ← the eligibility inputs\n"
                    "→ Q3 current livelihood\n"
                    "→ Q4 skills & interests\n"
                    "→ Q5 mobility / constraints\n"
                    "→ Q6 self-employment vs wage\n"
                    "→ Q7 local economy\n"
                    "→ READBACK   all seven, spoken yes\n"
                    "→ RECOMMEND → NEXT_STEP → CLOSE\n\n"
                    "Q5 may branch to GUARDIAN_CHECK — on DECISIONAL CAPACITY,\n"
                    "not on disability. DPDP Rule 11, not Rule 10.")
c3 = s.fitbox("c3", MX + half + GAP, y, half, WHITE, sGRN, size=13, pad=14,
              title="4.  RECOMMENDER — gate, THEN rank. Never rank then gate",
              title_size=16, title_color=DGRN,
              label="STAGE 0     ELIGIBILITY GATE — rules only. No model, no score.\n"
                    "            NSQF entry rules vs (education ∪ experience substitution)\n"
                    "            Returns THREE buckets, always:\n"
                    "               ELIGIBLE  ·  NEAR_MISS (with the exact gap)  ·  INELIGIBLE\n\n"
                    "STAGE 0.5   PM-DAKSH ROUTING — the guidelines forbid overlap\n"
                    "            by name, so where PM-DAKSH fits, we hand off\n\n"
                    "STAGE 1     RETRIEVE over the eligible set only\n\n"
                    "STAGE 2     RANK — weights written down and versioned,\n"
                    "            plus a SPREAD PENALTY so concentration is priced in\n\n"
                    "STAGE 3     EXPLAIN ×3 — beneficiary / officer / auditor,\n"
                    "            all from the same scored object")
y += max(c2["height"], c3["height"]) + 14

c4 = s.fitbox("c4", MX, y, MW, TEA, sTEA, size=14, pad=14,
              label="3.  PROFILE — per field: value, confidence, method (DTMF | LEXICON | REGEX | LLM), asr_engine, confirmed_at.\n"
                    "     raw_transcript is ERASED AT CONFIRM — a Postgres CHECK makes keeping it impossible. The audio was already gone.\n"
                    "     “We keep neither the voice nor the words, only the confirmed answer.”")
y += c4["height"] + 16

# Resize the core zone now that its contents are known.
z = s.byid("corez")
z["height"] = y - core_top + 4
z["y"] = core_top - 10

# Two outputs diverge.
s.elbow("o_b1", mid, y, [[0, 0], [0, 34], [-(MW / 4), 34], [-(MW / 4), 74]], sGRN)
s.elbow("o_b2", mid, y, [[0, 0], [0, 34], [MW / 4, 34], [MW / 4, 74]], sTEA)
y += 90

# ---------------------------------------------------------------------------- 8 outputs
y = head("h8", y, "8 — TWO OUTPUTS, NOT ONE", DGRN)
b1 = s.fitbox("b1", MX, y, half, GRN, sGRN, size=13, pad=14, sw=3,
              title="B1 — TO THE BENEFICIARY, SPOKEN, ≤ 60 s", title_size=16, title_color=DGRN,
              label="Back down the SAME channel she arrived on.\n\n"
                    "· Top 3 qualifications she is actually ELIGIBLE for\n"
                    "· 1 NEAR-MISS with the exact gap — “one more year”, or\n"
                    "  “do the Level 2 course first”.  THIS IS R4's FOURTH OUTPUT\n"
                    "· One plain sentence of reason each. No scheme jargon\n"
                    "· PM-DAKSH hand-off + ₹1,500/month stipend where it applies\n"
                    "· ₹50,000 asset grant (needs a bank loan) where it applies\n"
                    "· What to do on Monday, and the nearest centre\n"
                    "· Repeatable on demand — call back and press 9")
b2 = s.fitbox("b2", MX + half + GAP, y, half, TEA, sTEA, size=13, pad=14, sw=3,
              title="B2 — TO POSTGRES, AND THEN TO THE OFFICER", title_size=16, title_color="#0e7490",
              label="Every recommendation is stored with:\n"
                    "   weights_version · engine_version · nqr_snapshot_sha · the inputs\n\n"
                    "In 2030 somebody will ask why this person was sent to this trade.\n"
                    "The answer has to be a ROW, not a prompt.\n\n"
                    "NOTE THE DIRECTION: adapters NEVER write to the database.\n"
                    "Everything passes through the core first — otherwise the gate\n"
                    "and the FSM can be bypassed, and the register quietly fills\n"
                    "with ungated rows nobody can defend.")
b2h = b2["height"]
y += max(b1["height"], b2h)

# The arrow that was missing in v1 — and which v2 initially drew into empty space, because the
# officer column is far shorter than the beneficiary column and B2 sits well below the console it
# feeds. It now runs up the gutter between the two columns and lands on the console's left edge.
# Deferred: the console's position is not known until the officer column has been laid out.
B2_RIGHT = MX + half + GAP + half
B2_MID = s.byid("b2")["y"] + b2h / 2
y += 40

# ---------------------------------------------------------------------------- 10 cross-cutting
y = head("h10", y, "9 — TRUE EVERYWHERE, ON EVERY CHANNEL", DRED)
third = (MW - GAP * 2) / 3
x1 = s.fitbox("x1", MX, y, third, WHITE, sRED, size=13, pad=14,
              title="PRIVACY, BY CONSTRUCTION", title_size=16, title_color=DRED,
              label="· Audio discarded inside the turn. No\n"
                    "  recording_url column exists.\n"
                    "· raw_transcript erased at CONFIRM — enforced\n"
                    "  by a DB CHECK, on the server AND in the\n"
                    "  on-device SQLite schema.\n"
                    "· Raw phone number never stored — only\n"
                    "  hmac(e164, pepper), and the pepper never\n"
                    "  leaves the server.\n"
                    "· Consent is an FSM STATE, logged with its\n"
                    "  script version, withdrawable, and it names\n"
                    "  all four surfaces.\n"
                    "· Guardian branch fires on decisional\n"
                    "  capacity, never on disability.")
x2 = s.fitbox("x2", MX + third + GAP, y, third, WHITE, sORG, size=13, pad=14,
              title="CROSS-CHANNEL RESUME", title_size=16, title_color=DORG,
              label="One person, one profile. Sessions are\n"
                    "disposable.\n\n"
                    "IVR Monday 11:02, drops at Q4\n"
                    "   → WhatsApp Monday 18:40, resumes AT Q4\n"
                    "      → kiosk Tuesday, finishes Q5-Q7\n\n"
                    "Confirmed answers are immutable. Only\n"
                    "unconfirmed fields are ever re-asked.\n\n"
                    "Several people per handset is the NORMAL\n"
                    "case here, carried by (phone_hash, ordinal)\n"
                    "— 51.6% of rural women own no phone.")
x3 = s.fitbox("x3", MX + 2 * (third + GAP), y, third, WHITE, sGRN, size=13, pad=14,
              title="PROVENANCE", title_size=16, title_color=DGRN,
              label="· NQR official export — 2,814 rows, sha-\n"
                    "  stamped. Fields the source omits are NULL,\n"
                    "  never guessed.\n"
                    "· NO INVENTED QP CODES, EVER. Prototype rows\n"
                    "  carry qp_code = NULL and the UI says so\n"
                    "  in amber on every recommendation.\n"
                    "· NSQF 2023 entry table — typed by hand,\n"
                    "  under 100 rows. This IS the gate.\n"
                    "· NCO-2015 is a SIGNAL ONLY — NCVET found\n"
                    "  156 of 2,157 mis-mapped, 256 unmappable.\n"
                    "· Opportunity rows carry source + source_date\n"
                    "  or are excluded from the Plan export.")
y += max(x1["height"], x2["height"], x3["height"]) + 20

s.fitbox("foot", MX, y, MW, "#e5dbff", sPUR, size=15, pad=16,
         label="WHY AN FSM AND NOT AN LLM AGENT: every turn is replayable, every extraction is a logged (transcript → value, confidence)\n"
               "pair, and the model can never invent an eighth question in front of a jury. When CAG audits this in 2029, the answer is a row.")
main_bottom = s.byid("foot")["y"] + s.byid("foot")["height"]

# ============================================================================ OFFICER COLUMN
oy = 0
s.text("oh", OX, oy, "THE OFFICER — a different person, a different path", 24, "#0e7490")
oy += 38
s.box("ow", OX, oy, OW, 56, TEA, sTEA, "DISTRICT OFFICER / PIU", 20)
oy += 56
s.arrow("oa0", OX + OW / 2, oy + 6, 0, 30, sTEA)
oy += 50

o1 = s.fitbox("o_door", OX, oy, OW, TEA, sTEA, size=15, pad=16,
              label="OPENS THE CONSOLE\nDesktop or tablet, indoors, literate.\nNever touches an adapter or the FSM.")
oy += o1["height"]
s.arrow("oa1", OX + OW / 2, oy + 6, 0, 30, sTEA)
oy += 50

o2 = s.fitbox("o_login", OX, oy, OW, YEL, sTEA, size=14, pad=16, sw=3,
              label="ROLE-BASED LOGIN\nofficer · mobiliser · admin\n\n"
                    "Postgres RLS scopes every query to that\nperson's own district. Nobody sees the\n"
                    "country, and a mobiliser sees only her\nown villages.")
oy += o2["height"]
s.arrow("oa2", OX + OW / 2, oy + 6, 0, 30, sTEA)
oy += 50

o3 = s.fitbox("o_console", OX, oy, OW, WHITE, sTEA, size=14, pad=16, sw=3,
              title="OFFICER CONSOLE", title_size=17, title_color="#0e7490",
              label="Reads the database directly.\nIt is not an interview, it is a report —\n"
                    "so it does NOT go through /v1/turn.\n\nFed by B2, on the left.")
oy += o3["height"] + 16

s.text("o_bi", OX, oy, "Four of the five “Basic Issues under GIA” live below.", 15, GREY)
oy += 30

cards = [
    ("bi1", "BASIC ISSUE 1 — PERSPECTIVE PLAN",
     "Aggregated confirmed demand becomes the\nstatutory artefact.\n\n"
     "· 3.5-4× the notional allocation\n· multi-year horizon\n"
     "· DL-PACC submits via the portal\n\n"
     "*** DUE THE FIRST WEEK OF APRIL ***\n"
     "Demand data arriving in July is worthless.\n"
     "The differentiator is the FORMAT and the\nDATE, not the dashboard."),
    ("bi2", "BASIC ISSUE 2 — IDENTIFICATION\nAND FINANCIAL LINKAGE",
     "· Verified beneficiary register\n"
     "· Consent register — every row carries the\n  script_version she actually heard\n"
     "· Financial-literacy module flag, compulsory\n  in every course (Ch.3 ¶7A.a.iv)\n"
     "· ₹50,000 asset-grant eligibility flag,\n  conditional on a bank loan"),
    ("bi3", "BASIC ISSUE 3 — PLACEMENT",
     "outcome: RECOMMENDED → ENROLLED →\nCERTIFIED → PLACED → DROPPED\n\n"
     "Updated from the mobiliser's call list,\nNOT from a new officer screen.\n\n"
     "Guidelines mandate 70% placement.\nCAG measured PMKVY at 41%.\n\n"
     "Turns “demand” into “demand AND delivery”,\nwhich is what a DL-PACC argues about."),
    ("bi4", "BASIC ISSUE 4 — COORDINATION",
     "Batch export, convergence-shaped:\n“240 people in this block want and are\n"
     " eligible for QP AGR/Q1201”\n\n"
     "→ SSDM · DSC · NSFDC / NSKFDC\n→ training partners\n\n"
     "Plus PM-DAKSH routing counts.\nPer-district, per-project, per-beneficiary."),
    ("bi5", "BASIC ISSUE 5 — NO GROUND STAFF",
     "“Inadequate technical and support team at\nground level” — the scheme's own written\n"
     "statement of why automation.\n\n"
     "The assistant IS the ground-level team.\n\n"
     "Every screen we add is a screen somebody\nmust be trained on out of a 5% admin\n"
     "budget — so the mobiliser gets ONE list,\nnot a console."),
]
for eid, title, body in cards:
    e = s.fitbox(eid, OX, oy, OW, TEA, sTEA, size=13, pad=14, title=title, title_size=15, title_color="#0e7490", label=body)
    oy += e["height"] + 12

spread = s.fitbox("o_spread", OX, oy, OW, RED, sRED, size=13, pad=14,
                  title="AND THE ONE THAT DECIDES IT", title_size=15, title_color=DRED,
                  label="MEASURE SPREAD, NOT JUST RELEVANCE.\n\n"
                        "CAG: 40% of all certifications in 10 job-roles.\n"
                        "90.35% of “Green Jobs” in Safai Karmchari alone.\n\n"
                        "If our recommendations concentrate the same\nway, we have automated the failure with\n"
                        "better UX. So the ranker carries a spread\npenalty and the console plots the\n"
                        "distribution against that line.")
oy += spread["height"]

# Now that the console has a position, connect the database to it. Up the gutter, across the
# divider, into the console's left edge — the one and only link between the two halves.
con = s.byid("o_console")
con_mid = con["y"] + con["height"] / 2
s.elbow("to_officer", B2_RIGHT, B2_MID,
        [[0, 0], [34, 0], [34, con_mid - B2_MID], [OX - B2_RIGHT - 6, con_mid - B2_MID]],
        sTEA, sw=3)
s.text("to_officer_l", B2_RIGHT + 44, (B2_MID + con_mid) / 2 - 20,
       "district\naggregation\nfeeds the\nconsole", 13, "#0e7490")

# Divider, tall enough for both columns.
s.vline("div", DIV, -60, max(main_bottom, oy) + 40)

s.validate(zones=ZONES)
s.save(OUT)
