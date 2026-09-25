#!/usr/bin/env python3
"""Build docs/Utsav/research/05-diagrams.excalidraw from a compact element list.

Excalidraw's file format has no "label on a shape" concept -- a labelled box is
really two elements: the container, and a text element with containerId set,
listed back in the container's boundElements. Text elements also need explicit
width/height/fontFamily or the app drops them silently. Hand-writing that is
where the first attempt went wrong, so it is generated instead.

Run:  python3 scripts/build_diagram.py
"""

import json
import random
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "docs/Utsav/research/05-diagrams.excalidraw"

FONT = 2          # Helvetica -- readable at panorama zoom; 1 is Virgil/hand-drawn
LINE_HEIGHT = 1.25
CHAR_W = 0.55     # width of one char as a fraction of fontSize, Helvetica-ish

elements = []
_rng = random.Random(26097)


def _seed():
    return _rng.randint(1, 2 ** 31)


def _base(eid, etype, x, y, w, h, stroke="#1e1e1e", bg="transparent",
          stroke_width=2, opacity=100, style="solid"):
    return {
        "id": eid, "type": etype, "x": x, "y": y, "width": w, "height": h,
        "angle": 0, "strokeColor": stroke, "backgroundColor": bg,
        "fillStyle": "solid", "strokeWidth": stroke_width, "strokeStyle": style,
        "roughness": 1, "opacity": opacity, "groupIds": [], "frameId": None,
        "roundness": None, "seed": _seed(), "version": 1,
        "versionNonce": _seed(), "isDeleted": False, "boundElements": None,
        "updated": 1, "link": None, "locked": False,
    }


def _text_size(text, size):
    lines = text.split("\n")
    w = max(len(l) for l in lines) * size * CHAR_W
    h = len(lines) * size * LINE_HEIGHT
    return w, h


def txt(eid, x, y, text, size=16, color="#1e1e1e"):
    """Standalone text. x,y is the top-left corner."""
    w, h = _text_size(text, size)
    e = _base(eid, "text", x, y, w, h, stroke=color)
    e.update({
        "text": text, "originalText": text, "fontSize": size,
        "fontFamily": FONT, "textAlign": "left", "verticalAlign": "top",
        "containerId": None, "lineHeight": LINE_HEIGHT, "autoResize": True,
    })
    elements.append(e)
    return e


def box(eid, x, y, w, h, bg="transparent", stroke="#1e1e1e", label=None,
        size=16, sw=2, opacity=100, round_=True, label_color="#1e1e1e"):
    e = _base(eid, "rectangle", x, y, w, h, stroke=stroke, bg=bg,
              stroke_width=sw, opacity=opacity)
    if round_:
        e["roundness"] = {"type": 3}
    elements.append(e)
    if label:
        tid = eid + "_t"
        tw, th = _text_size(label, size)
        t = _base(tid, "text", x + (w - tw) / 2, y + (h - th) / 2, tw, th,
                  stroke=label_color)
        t.update({
            "text": label, "originalText": label, "fontSize": size,
            "fontFamily": FONT, "textAlign": "center", "verticalAlign": "middle",
            "containerId": eid, "lineHeight": LINE_HEIGHT, "autoResize": False,
        })
        e["boundElements"] = [{"type": "text", "id": tid}]
        elements.append(t)
    return e


def arr(eid, x, y, dx, dy, color="#1e1e1e", style="solid", head="arrow"):
    e = _base(eid, "arrow", x, y, abs(dx), abs(dy), stroke=color, style=style)
    e.update({
        "points": [[0, 0], [dx, dy]], "lastCommittedPoint": None,
        "startBinding": None, "endBinding": None,
        "startArrowhead": None, "endArrowhead": head, "elbowed": False,
        "roundness": {"type": 2},
    })
    elements.append(e)
    return e


# palette
BLU, GRN, ORG, PUR, RED, YEL, TEA = ("#a5d8ff", "#b2f2bb", "#ffd8a8",
                                     "#d0bfff", "#ffc9c9", "#fff3bf", "#c3fae8")
sBLU, sGRN, sORG, sPUR, sRED, sTEA = ("#4a9eed", "#22c55e", "#f59e0b",
                                      "#8b5cf6", "#ef4444", "#06b6d4")
GREY, DRED, DGRN, DBLU, DPUR, DORG = ("#757575", "#c62828", "#15803d",
                                      "#2563eb", "#6d28d9", "#b45309")

# ---------------------------------------------------------------- title
txt("tt", 30, -100, "SIH26097 - Voice Livelihood Assistant: full technical flow", 44)
txt("tt2", 30, -48, "Three inputs, one core, two outputs. Panels 1-11.", 22, GREY)

# ------------------------------------------------- 1 MASTER FLOW
txt("p1t", 30, 10, "1 - MASTER FLOW: point A to point B", 36)
box("p1z", 20, 60, 1460, 1030, "#dbe4ff", sBLU, sw=1, opacity=25)
txt("p1a", 40, 110, "A - the three inputs the PS names", 20, DBLU)
box("i1", 40, 150, 290, 80, BLU, sBLU, "Feature phone\ndials in", 18)
box("i2", 40, 260, 290, 80, GRN, sGRN, "WhatsApp\nvoice note", 18)
box("i3", 40, 370, 290, 80, ORG, sORG, "Kiosk / ASHA app\n(offline)", 18)
arr("ia1", 335, 190, 90, 0, sBLU)
arr("ia2", 335, 300, 90, 0, sGRN)
arr("ia3", 335, 410, 90, 0, sORG)
box("d1", 430, 150, 230, 80, PUR, sPUR, "IVR adapter", 18)
box("d2", 430, 260, 230, 80, PUR, sPUR, "WA adapter", 18)
box("d3", 430, 370, 230, 80, PUR, sPUR, "App adapter", 18)
txt("dn", 430, 462, "thin: transport in, prompt out. No logic.", 16, GREY)
arr("ta1", 665, 190, 110, 105, sPUR)
arr("ta2", 665, 300, 110, 0, sPUR)
arr("ta3", 665, 410, 110, -105, sPUR)
box("turn", 780, 255, 330, 90, YEL, sORG, "POST /v1/turn\nONE contract", 20)
arr("ta4", 945, 350, 0, 60, sPUR)
box("corez", 700, 415, 760, 510, "#e5dbff", sPUR, sw=1, opacity=35)
txt("corel", 720, 425, "THE CORE - no channel knows this exists", 20, DPUR)
box("c1", 730, 460, 700, 62, TEA, sTEA, "identity -> session resolve (resume or start)", 18)
box("c2", 730, 548, 700, 62, PUR, sPUR, "INTERVIEW FSM   consent -> Q1..Q7 -> readback", 18)
box("c3", 730, 636, 700, 62, PUR, sPUR, "EXTRACTION LADDER  lexicon -> regex -> LLM -> confirm", 17)
box("c4", 730, 724, 700, 62, TEA, sTEA, "PROFILE (Postgres) - per-field confidence + provenance", 17)
box("c5", 730, 812, 700, 62, GRN, sGRN, "RECOMMENDER  gate -> retrieve -> rank -> explain x3", 17)
for i, y in enumerate((522, 610, 698, 786)):
    arr(f"ca{i}", 1080, y, 0, 26, sPUR)
arr("oa1", 900, 880, -40, 80, sGRN)
arr("oa2", 1260, 880, 40, 80, sGRN)
txt("p1b", 600, 940, "B - two outputs, not one", 20, DGRN)
box("o1", 580, 975, 350, 95, GRN, sGRN, "B1  spoken recommendation\nsame channel, <= 60 s", 18)
box("o2", 960, 975, 480, 95, GRN, sGRN,
    "B2  district aggregation -> officer console\n-> Perspective Plan input (1st week April)", 17)
txt("p1n", 40, 520,
    "If the FSM ever lives inside\nthe IVR handler, WhatsApp\nbecomes a 2nd copy of the\nsame 7 questions and they\ndrift apart by day three.", 17, DRED)

# ------------------------------------------------- 2 IVR
txt("p2t", 1630, 10, "2 - IVR: the channel the PS names first", 34)
box("p2z", 1620, 60, 1460, 1030, "#dbe4ff", sBLU, sw=1, opacity=20)
box("v1", 1640, 110, 280, 80, BLU, sBLU, "Rs 800 keypad phone\nno data, no app", 17)
arr("va1", 1925, 150, 60, 0, sBLU)
box("v2", 1990, 110, 320, 80, ORG, sORG, "Indian CPaaS number\n+ voicebot streaming", 16)
arr("va2", 2150, 195, 0, 55, sORG)
box("v3", 1990, 255, 320, 70, PUR, sPUR, "WebSocket  8 kHz L16 mono", 16)
box("v4", 1640, 360, 670, 250, YEL, sORG, sw=1)
txt("v4t", 1660, 375, "Wire protocol (verified against working code)", 18, DORG)
txt("v4a", 1660, 408,
    "IN   connected\n     start   call_sid, from, to, media_format\n"
    "     media   base64 PCM, 20 ms chunks\n     dtmf    digit\n"
    "     stop    call_sid, reason", 16)
txt("v4f", 1660, 552, "OUT  media | clear (= barge-in) | mark", 16, sPUR)
box("s1", 2400, 110, 330, 64, BLU, sBLU, "VAD endpoint, 700 ms silence", 16)
arr("sa1", 2565, 178, 0, 24, sBLU)
box("s2", 2400, 205, 330, 64, BLU, sBLU, "resample 8k -> 16k", 16)
arr("sa2", 2565, 273, 0, 24, sBLU)
box("s3", 2400, 300, 330, 64, PUR, sPUR, "Bhashini / Sarvam metered ASR", 15)
arr("sa3", 2565, 368, 0, 24, sPUR)
box("s4", 2400, 395, 330, 64, PUR, sPUR, "extraction ladder (panel 8)", 16)
arr("sa4", 2565, 463, 0, 24, sPUR)
box("s5", 2400, 490, 330, 64, TEA, sTEA, "FSM state + answer row", 16)
arr("sa5", 2565, 558, 0, 40, sGRN)
box("s6", 2400, 600, 330, 80, GRN, sGRN, "pre-rendered 8 kHz WAV\nno TTS on the hot path", 16)
arr("sa6", 2395, 640, -85, -500, sGRN, style="dashed")
txt("sa6l", 2760, 615, "back down\nthe same line", 16, DGRN)
box("v5", 1640, 650, 670, 90, RED, sRED,
    "DTMF: language pick, yes/no, resume PIN\nRs 0  -  0 ms  -  0 WER  -  ~3 of 11 turns", 17)
box("v6b", 1640, 765, 1090, 95, ORG, sORG,
    "Call drops -> stop frame -> session.status = RESUMABLE, answer rows persist.\n"
    "Callback IS legal (TCCCPR cl. za) but needs DLT registration + 1600-series. See panel 11.", 16)
box("v7", 1640, 885, 1090, 95, PUR, sPUR,
    "Ordinary virtual number, NOT toll-free: toll-free bills the RECEIVER at Rs 1.20-2.50/min\n"
    "vs Rs 0.40-0.90 on a normal DID. It was only ever a regulatory shield we no longer need.", 16)

# ------------------------------------------------- 3 TURN CLOCK
txt("p3t", 3230, 10, "3 - One IVR turn, with the clock running", 36)
box("p3z", 3220, 60, 1460, 1030, "#d3f9d8", sGRN, sw=1, opacity=20)
txt("p3s", 3240, 95, "t = 0 is the moment the caller stops speaking", 19, DGRN)
txt("b1l", 3240, 150, "VAD endpointing", 18)
box("b1", 3560, 142, 120, 38, BLU, sBLU, "240 ms", 15)
txt("b2l", 3240, 210, "resample 8k -> 16k", 18)
box("b2", 3560, 202, 16, 38, BLU, sBLU)
txt("b2v", 3586, 210, "10 ms", 15, GREY)
txt("b3l", 3240, 270, "ASR, n-best 5", 18)
box("b3", 3560, 262, 150, 38, PUR, sPUR, "300 ms", 15)
txt("b4l", 3240, 330, "lexicon match (hit)", 18)
box("b4", 3560, 322, 10, 38, GRN, sGRN)
txt("b4v", 3584, 330, "5 ms", 15, GREY)
txt("b5l", 3240, 390, "prompt resolve (WAV)", 18)
box("b5", 3560, 382, 10, 38, GRN, sGRN)
txt("b5v", 3584, 390, "5 ms   (live TTS would be 400-900)", 15, GREY)
txt("b6l", 3240, 460, "PERCEIVED SILENCE", 19, DGRN)
box("b6", 3560, 450, 290, 44, sGRN, DGRN, "580 ms", 18, label_color="#ffffff")
txt("b7l", 3240, 528, "BUDGET", 19, DORG)
box("b7", 3560, 518, 900, 44, ORG, sORG,
    "1800 ms - humans assume the line is dead past ~2 s", 16)
box("p3n1", 3240, 610, 1400, 110, RED, sRED,
    "The LLM path costs 400-1200 ms and blows the budget if it lands on the hot path.\n"
    "Defence: lexicon takes ~70% of turns; when the LLM IS invoked, play a 300 ms \"hmm...\" over it.", 17)
box("p3n2", 3240, 740, 1400, 110, YEL, sORG,
    "Barge-in: VAD keeps running WHILE the assistant speaks. Speech detected -> send clear,\n"
    "kill the send queue, go to LISTEN. Without it, an impatient caller talks over a 4 s prompt.", 17)
box("p3n3", 3240, 870, 1400, 110, TEA, sTEA,
    "Pre-rendering the fixed prompts is not a micro-optimisation: it removes ~0.6 s per turn,\n"
    "~29% of per-call cost, and it is what makes the offline kiosk possible at all.", 17)

# ------------------------------------------------- 4 WHATSAPP
txt("p4t", 30, 1210, "4 - WHATSAPP VOICE NOTES: Meta Cloud API, direct", 34)
box("p4z", 20, 1260, 1460, 1030, "#d3f9d8", sGRN, sw=1, opacity=20)
box("w1", 40, 1320, 300, 80, GRN, sGRN, "holds mic, speaks,\nreleases", 17)
arr("wa1", 345, 1360, 50, 0, sGRN)
box("w2", 400, 1320, 330, 80, BLU, sBLU, "Meta webhook\nmessages[0].audio.id", 16)
arr("wa2", 735, 1360, 50, 0, sBLU)
box("w3", 790, 1320, 330, 80, BLU, sBLU, "GET /v19.0/<media_id>\n-> short-lived signed URL", 15)
arr("wa3", 955, 1405, 0, 45, sBLU)
box("w4", 790, 1455, 330, 75, PUR, sPUR, "download OGG / Opus", 16)
arr("wa4", 785, 1492, -50, 0, sPUR)
box("w5", 400, 1455, 330, 75, PUR, sPUR, "decode -> 16 kHz PCM", 16)
arr("wa5", 395, 1492, -50, 0, sPUR)
box("w6", 40, 1450, 300, 85, YEL, sORG, "THE SAME extraction\nladder + FSM as IVR", 16)
arr("wa6", 190, 1540, 0, 50, sORG)
box("w7", 40, 1595, 460, 95, GRN, sGRN,
    "POST /messages  type=audio\npre-uploaded media id, reused forever", 16)
box("w8", 530, 1595, 460, 95, GRN, sGRN,
    "+ interactive reply buttons\nwhenever expect.kind == enum", 16)
box("w9", 1020, 1595, 430, 95, RED, sRED,
    "We reply by VOICE, not text.\nA text reply fails people who cannot read.", 16)
box("w10b", 40, 1730, 1410, 110, RED, sRED,
    "REJECTED BY THE AUDIT - batching 2-3 questions per message makes WhatsApp a form read aloud,\n"
    "which is exactly what R1 forbids and R7 penalises. The saving is Rs 0.77 per beneficiary, and Rs 0\n"
    "for the first 1,000 messages a month. ONE QUESTION PER MESSAGE. Batch ack + next Q, never Q + Q.", 16)
box("w11", 40, 1870, 1410, 130, RED, sRED,
    "1 OCTOBER 2026 - service/utility messages inside the 24 h window become chargeable\n"
    "beyond a free monthly allowance (~1,000), at Rs 0.115 each. Our cost model assumes PAID replies.\n"
    "The free tier is ending. Payment method must be on file by 30 Sept.", 17)
box("w12", 40, 2030, 1410, 90, PUR, sPUR,
    "Direct to Meta, not via Twilio or Exotel: no per-message markup (Exotel adds Rs 0.06/message),\n"
    "and audio replies are straightforward. Twilio routing pushes you to text - for people who cannot read.", 16)

# ------------------------------------------------- 5 KIOSK
txt("p5t", 1630, 1210, "5 - KIOSK / APP / ASSISTED MODE: Rs 0 per interview", 33)
box("p5z", 1620, 1260, 1460, 1030, "#e5dbff", sPUR, sw=1, opacity=20)
box("k1", 1650, 1320, 330, 80, ORG, sORG, "Android, ~15 MB APK\nruns on a Rs 6,000 phone", 16)
box("k2", 2000, 1320, 330, 80, ORG, sORG, "Vosk ~50 MB on-device\nASR, Apache-2.0", 16)
box("k3", 2350, 1320, 330, 80, ORG, sORG, "same pre-rendered WAVs\nshipped inside the APK", 15)
box("k4", 1650, 1420, 330, 80, TEA, sTEA, "SQLite, same answer\nrow shape as Postgres", 16)
box("k5", 2000, 1420, 330, 80, TEA, sTEA, "outbox, opportunistic\nsync when signal returns", 15)
box("k6", 2350, 1420, 330, 80, TEA, sTEA, "district-filtered NQR\nsnapshot + gate on device", 15)
arr("ka1", 2160, 1505, 0, 45, sTEA)
box("k7", 1650, 1555, 1030, 90, GRN, sGRN,
    "idempotent upsert on (phone_hash, ordinal, field_no)\n"
    "conflict rule: confirmed beats unconfirmed; later confirmed_at wins", 17)
box("k8", 1650, 1685, 1400, 150, PUR, sPUR,
    "ASSISTED MODE - the fourth door the PS does not name and reality demands\n"
    "Same APK in an ASHA / AWW / VLCC member's hands, on the doorstep.\n"
    "51.6% of rural women 15+ own NO phone; guidelines mandate 30% women + a 15% ring-fenced fund.\n"
    "Without this, the women's target is arithmetically unreachable.", 16)
box("k9", 1650, 1865, 1400, 90, RED, sRED,
    "Consent is recorded as spoken BY the beneficiary, on the worker's device,\n"
    "with the worker's id in consent_event.evidence - never as the worker's assertion.", 16)
box("k10", 1650, 1985, 1400, 90, GRN, sGRN,
    "Aeroplane-mode the phone on stage and complete a full interview.\n"
    "Rs 0 marginal cost, and R6 is satisfied structurally.", 17)

# ------------------------------------------------- 6 RESUME
txt("p6t", 3230, 1210, "6 - IDENTITY + CROSS-CHANNEL RESUME", 36)
box("p6z", 3220, 1260, 1460, 1030, TEA, sTEA, sw=1, opacity=20)
txt("p6s", 3245, 1300, "One person, one profile. Sessions are disposable.", 19, "#0e7490")
box("r1", 3245, 1340, 400, 90, BLU, sBLU, "IVR  11:02 Mon\ndrops at Q4", 17)
arr("ra1", 3650, 1385, 50, 0, sTEA)
box("r2", 3705, 1340, 400, 90, GRN, sGRN, "WhatsApp 18:40 Mon\nresumes AT Q4", 17)
arr("ra2", 4110, 1385, 50, 0, sTEA)
box("r3", 4165, 1340, 400, 90, ORG, sORG, "Kiosk, Tuesday\nfinishes Q5 - Q7", 17)
box("r4", 3245, 1465, 1320, 80, TEA, sTEA,
    "answer rows hang off beneficiary_id, NOT session_id - that one line is the whole mechanism", 17)
box("r5", 3245, 1565, 1320, 70, PUR, sPUR,
    "Confirmed answers are immutable. Only unconfirmed fields are ever re-asked.", 17)
box("r6", 3245, 1665, 1320, 90, RED, sRED,
    "THE BUG A PHONE-HASH KEY CREATES: handsets are shared. The brother redials and lands\n"
    "inside his sister's half-finished interview - wrong profile AND a DPDP disclosure to him.", 17)
arr("ra3", 3900, 1760, 0, 35, sRED)
box("r7b", 3245, 1800, 1320, 175, YEL, sORG,
    "FIX (revised by the audit) - a name gate is NOT enough, a name is guessable by a relative\n"
    "phone_hash becomes a NON-UNIQUE lookup index, never an identity.\n"
    "At CONSENT, capture a 4-digit resume PIN by DTMF (already-built plumbing, Rs 0, 0 WER).\n"
    "On redial: \"continuing an earlier call? enter your four digits. to start new, press 1.\"\n"
    "REVEAL NOTHING, READ BACK NOTHING until the PIN clears. Two failures -> new record.", 15, sw=3)
box("r8", 3245, 2000, 1320, 90, GRN, sGRN,
    "Multiple beneficiaries per handset is the NORMAL case in this scheme, not an edge case -\n"
    "so the data model carries it from day one instead of retrofitting a unique constraint later.", 16)
box("r9", 3245, 2100, 1320, 90, RED, sRED,
    "On WhatsApp, resume is FORWARD-ONLY: ask the next unanswered field, never read prior\n"
    "answers back into a chat log that lives on a possibly-shared handset you cannot erase.", 16)

# ------------------------------------------------- 7 FSM
txt("p7t", 30, 2410, "7 - INTERVIEW FSM: the 7 PS fields, in order, not an agent", 32)
box("p7z", 20, 2460, 1460, 1030, "#e5dbff", sPUR, sw=1, opacity=20)
fsm = [
    ("fq0", 2510, RED, sRED, "Q0  village / block   (ADDED by audit)", 15, 3),
    ("f0", 2572, BLU, sBLU, "LANG_SELECT   DTMF 1-5 or spoken", 16, 2),
    ("f1", 2634, RED, sRED, "CONSENT   <= 15 s, spoken, logged", 16, 2),
    ("f2", 2696, TEA, sTEA, "IDENTIFY   PIN gate + resume", 16, 2),
    ("q1", 2758, YEL, sORG, "Q1  Educational background", 16, 2),
    ("q2", 2820, YEL, sORG, "Q2  Family / traditional occupation", 16, 2),
    ("q3", 2882, PUR, sPUR, "Q3  Current livelihood", 16, 2),
    ("q4", 2944, PUR, sPUR, "Q4  Skills and interests", 16, 2),
    ("q5", 3006, RED, sRED, "Q5  Mobility / physical constraints", 16, 2),
    ("q6", 3080, PUR, sPUR, "Q6  Self-employment vs wage", 16, 2),
    ("q7", 3142, PUR, sPUR, "Q7  Local economic realities", 16, 2),
    ("f3", 3204, TEA, sTEA, "READBACK   all 7, spoken yes", 16, 2),
    ("f4", 3266, GRN, sGRN, "RECOMMEND  top 3 + 1 NEAR_MISS", 16, 2),
    ("f5", 3328, GRN, sGRN, "NEXT_STEP -> CLOSE", 16, 2),
]
for eid, y, bg, sc, lab, fs, sw in fsm:
    box(eid, 40, y, 400, 52, bg, sc, lab, fs, sw=sw)
txt("q5n", 48, 3062, "-> GUARDIAN_CHECK, on decisional capacity (DPDP Rule 11)", 13, DRED)
txt("sfl", 490, 2500, "Every Qn is the same 5-state sub-machine", 19, DPUR)
box("sf1", 490, 2535, 150, 54, BLU, sBLU, "ASK", 17)
arr("sfa1", 645, 2562, 30, 0, sBLU)
box("sf2", 680, 2535, 150, 54, BLU, sBLU, "LISTEN", 17)
arr("sfa2", 835, 2562, 30, 0, sBLU)
box("sf3", 870, 2535, 160, 54, PUR, sPUR, "EXTRACT", 17)
arr("sfa3", 1035, 2562, 30, 0, sPUR)
box("sf4", 1070, 2535, 180, 54, GRN, sGRN, "CONFIRM", 17)
txt("th1", 490, 2615, "conf >= 0.85   -> CONFIRM, next Q", 17, DGRN)
txt("th2", 490, 2645, "0.55 - 0.85    -> explicit spoken readback", 17, DORG)
txt("th3", 490, 2675, "conf < 0.55    -> RE_ASK, max 2", 17, DRED)
txt("th4", 490, 2705, "after 2        -> DTMF, else DEFER", 17, DPUR)
box("sf5", 490, 2745, 230, 54, ORG, sORG, "RE_ASK (max 2)", 16)
box("sf6", 740, 2745, 230, 54, BLU, sBLU, "DTMF fallback", 16)
box("sf7", 990, 2745, 260, 54, TEA, sTEA, "DEFER -> resumable", 16)
txt("sfn", 490, 2812,
    "DEFER is why the system never hangs up on someone it cannot understand.", 16, GREY)
box("p7n", 490, 2855, 960, 175, YEL, sORG,
    "Q1 + Q2 are not biography - they are the eligibility inputs.\n"
    "\"I've done my father's weaving for twelve years\" is an ELIGIBILITY CLAIM:\n"
    "NSQF 2.5+ is reachable on experience alone, with no schooling, via RPL.\n"
    "The highest-value inference in the interview.", 16)
box("p7n2", 490, 3055, 960, 130, PUR, sPUR,
    "Why an FSM and not an LLM agent: every turn is replayable, every extraction is a logged\n"
    "(transcript -> value, confidence) pair, and the model can never invent an eighth question\n"
    "in front of a jury. When CAG audits this in 2029, the answer is a row, not a prompt.", 16)
box("p7n4", 490, 3210, 960, 135, TEA, sTEA,
    "Q0 is registration metadata, NOT an eighth PS field - so \"seven fields, verbatim, in order\"\n"
    "stays literally true. It exists because NOTHING in the seven captures where the person lives,\n"
    "and without a district there is no GROUP BY for the officer half, and no join to the\n"
    "opportunity data that R4's \"region-specific\" output depends on.", 15)

# ------------------------------------------------- 8 LADDER
txt("p8t", 1630, 2410, "8 - EXTRACTION LADDER: assume the transcript is wrong", 32)
box("p8z", 1620, 2460, 1460, 1030, RED, sRED, sw=1, opacity=18)
txt("p8s", 1645, 2500,
    "Word Error Rate on GramVaani - telephone-quality, dialectal Hindi (AI4Bharat Vistaar)", 17, DRED)
box("wer1", 1645, 2530, 719, 44, RED, sRED, "Google STT   59.9  - loses 3 words in 5", 17)
box("wer2", 1645, 2586, 508, 44, ORG, sORG, "Azure / Nvidia   ~42", 17)
box("wer3", 1645, 2642, 322, 44, YEL, sORG, "IndicWhisper 26.8 BEST", 15)
txt("werN", 1990, 2652,
    "Still 1 word in 4 wrong. So the unit is a FIELD, not a word.", 16, DRED)
ladder = [
    ("l0", 2720, BLU, sBLU, "0   DTMF, once a closed-set field has been re-asked      Rs 0 - 0 ms - 0 WER", 2),
    ("l1", 2790, GRN, sGRN, "1   lexicon, phonetic + fuzzy over ASR n-best            ~Rs 0 - ~5 ms - ~70% of turns", 3),
    ("l2", 2860, GRN, sGRN, "2   numeric / level regex: 8th, dasvin, barah saal       ~Rs 0 - ~2 ms - Q1, Q2-years", 2),
    ("l3", 2930, PUR, sPUR, "3   small LLM, constrained decode into a closed enum     1 call - 400-1200 ms - uncommon", 2),
    ("l4", 3000, ORG, sORG, "4   spoken confirmation                                 1 turn - ~4 s - everything else", 2),
]
for eid, y, bg, sc, lab, sw in ladder:
    box(eid, 1645, y, 1400, 60, bg, sc, lab, 16, sw=sw)
txt("lN", 1645, 3072,
    "Cheapest first, stop on first fire. Low confidence is a RE-ASK, not an error - "
    "which is what a considerate human does anyway.", 16, GREY)
box("lex", 1645, 3110, 1400, 230, YEL, sORG, sw=1)
txt("lexT", 1665, 3125, "One lexicon entry - the highest-leverage asset in the build", 18, DORG)
txt("lex1", 1665, 3158,
    "concept_id  TRADE.TAILORING\n"
    "surface     silai, silai-kadhai, darzi, thaiyal, buni-silai\n"
    "phonetic    S400, T400   (Double Metaphone over transliteration)\n"
    "dialect     bho: silai ke kaam   -   mag: sivai", 16)
txt("lex5", 1665, 3270, "nco_2015    7531.0100          <- SIGNAL ONLY, 156/2157 mis-mapped", 16, DRED)
txt("lex6", 1665, 3298, "nqr_codes   AMH/Q1947          <- IMPORTED, never invented", 16, DGRN)
txt("p8n", 1645, 3355,
    "We do NOT claim a Bhojpuri ASR model (~18 h of corpus exists for 4 dialects). We claim, and MEASURE,\n"
    "that a badly transcribed Bhojpuri utterance still lands on the right CONCEPT - WER published next to\n"
    "field-extraction accuracy. That chart is the strongest slide available.", 16, DRED)

# ------------------------------------------------- 9 RECOMMENDER
txt("p9t", 3230, 2410, "9 - RECOMMENDER: gate, then rank. Never rank, then gate.", 31)
box("p9z", 3220, 2460, 1460, 1030, "#d3f9d8", sGRN, sw=1, opacity=20)
box("g0", 3245, 2500, 1400, 135, RED, sRED,
    "STAGE 0   ELIGIBILITY GATE - rules only, no model, no score\n"
    "NSQF entry requirement vs (Q1 education  U  Q2 experience substitution)\n"
    "Q5 constraint vs job-role demands - radius vs haversine to nearest PMKK / NSTI / ITI\n"
    "-> returns THREE buckets:  ELIGIBLE  |  NEAR_MISS (with the exact gap)  |  INELIGIBLE", 16, sw=3)
box("gpd", 3245, 2645, 1400, 62, ORG, sORG,
    "STAGE 0.5   PM-DAKSH ROUTING - the guidelines forbid overlap by name. Hand off, don't re-skin.", 15)
arr("ga1", 3945, 2710, 0, 22, sGRN)
box("g1", 3245, 2735, 1400, 80, BLU, sBLU,
    "STAGE 1   RETRIEVAL over the ELIGIBLE set only\n"
    "lexicon + IndicSBERT over Q2 + Q3 + Q4  ->  top ~30 NQR qualifications", 16)
arr("ga2", 3945, 2818, 0, 22, sGRN)
box("g2", 3245, 2843, 1400, 100, PUR, sPUR,
    "STAGE 2   RANK - weighted, weights written down and versioned\n"
    "aspiration fit - skill transfer (RPL) - local opportunity - Q6 preference - duration vs mobility\n"
    "asset grant (Rs 50k, needs a bank loan) - financial-literacy module - women's 15%/30%", 15)
arr("ga3", 3945, 2946, 0, 22, sGRN)
txt("g3l", 3245, 2976, "STAGE 3   EXPLAIN x3 - from the same scored object", 19, DGRN)
box("e1", 3245, 3005, 450, 95, GRN, sGRN,
    "BENEFICIARY\none spoken sentence,\nno scheme jargon", 16)
box("e2", 3720, 3005, 450, 95, BLU, sBLU,
    "OFFICER\nmatched fields +\nthe eligibility proof", 16)
box("e3", 4195, 3005, 450, 95, TEA, sTEA,
    "AUDITOR\ninputs, weights_version,\nengine_version, nqr_sha", 15)
box("outc", 3245, 3120, 1400, 62, ORG, sORG,
    "THEN: outcome(beneficiary, qp_code, RECOMMENDED / ENROLLED / CERTIFIED / PLACED / DROPPED)", 15)
box("prov", 3245, 3195, 1400, 110, TEA, sTEA,
    "PROVENANCE: NQR official export, 2,814 rows, sha256 348bed87... - NSQF 2023 entry table, typed by hand\n"
    "NCO-2015 = signal only (NCVET: 156/2157 mis-mapped, 256 unmappable) - 2-3 pilot districts, sourced + dated\n"
    "Fields the official source does not provide are NULL, not guessed. No invented QP codes, ever.", 15)
box("spread", 3245, 3320, 1400, 105, YEL, sORG,
    "MEASURE SPREAD, NOT JUST RELEVANCE - CAG: 40% of certifications in 10 job-roles;\n"
    "90.35% of \"Green Jobs\" in Safai Karmchari alone. If our output concentrates like that,\n"
    "we automated the failure with better UX.", 15)

# ------------------------------------------------- 10 COST
txt("p10t", 30, 3590, "10 - COST PER BENEFICIARY: corrected after the constraint audit", 32)
box("p10z", 20, 3640, 4660, 450, "#dbe4ff", sBLU, sw=1, opacity=20)
txt("p10s", 45, 3672,
    "All-in, one year, per beneficiary - marginal PLUS fixed. The fixed line is where the real money was hiding.",
    18, DBLU)
txt("c1l", 45, 3718, "Plan as written", 18, DRED)
box("cb1", 340, 3710, 976, 40, RED, sRED, "Rs 488 per head at 1,000 people", 16)
txt("c2l", 45, 3776, "Missed-call callback", 18)
box("cb2", 340, 3768, 611, 40, ORG, sORG, "Rs 30.55  (needs DLT + 1600-series)", 15)
txt("c3l", 45, 3834, "WhatsApp-first", 18, DGRN)
box("cb3", 340, 3826, 604, 40, GRN, sGRN, "Rs 30.18  cheapest legal at 1,000", 15)
txt("c4l", 45, 3892, "Same, at 100,000", 18, DGRN)
box("cb4", 340, 3884, 81, 40, sGRN, DGRN)
txt("c4v", 435, 3892, "Rs 4.04  -  fixed cost amortises, marginal does not", 17, DGRN)
txt("c5l", 45, 3950, "Kiosk / assisted", 18)
box("cb5", 340, 3942, 14, 40, sGRN, DGRN, round_=False)
txt("c5v", 366, 3950, "Rs 0   - no call, no data, no vendor", 18, DGRN)
txt("c6v", 45, 4005,
    "Fixed per year: plan as written Rs 4,77,000 (always-on L4 GPU at Rs 49/hr)  vs  "
    "corrected Rs 26,400 (metered speech API + Rs 200/mo number).", 17, DRED)
txt("c7v", 45, 4035,
    "Self-hosted GPU only beats Sarvam at Rs 30/hr of audio above ~47,700 four-minute interviews "
    "PER MONTH. Pilot scale is nowhere near it.", 17, DRED)
box("lev", 1500, 3700, 1540, 300, YEL, sORG,
    "THE 5% ADMIN CAP WAS NEVER THE BINDING CONSTRAINT\n\n"
    "PM-AJAY's admin head is ~Rs 107 crore nationally.\n"
    "100,000 beneficiaries at Rs 15 is Rs 15.4 lakh - 0.014% of it.\n\n"
    "What breaks the scheme is the SHAPE of the spend: a Rs 4.29 lakh/year\n"
    "standing GPU bill a district PIU must justify before a single call.\n\n"
    "Metered API by default. Self-hosted sovereign stack as the switch\n"
    "you demonstrate on stage. Spend the saved Rs 4 lakh on the two things\n"
    "the 5% head is short of: a native-speaker prompt pass, and the dialect measurement.", 16)
box("open", 3090, 3700, 1560, 300, RED, sRED,
    "TRAI: THE OUTBOUND QUESTION IS RESOLVED, AND IT RESOLVES FOR US\n\n"
    "TCCCPR 2nd Amendment, 12 Feb 2025, new clause (za):\n"
    "a \"Government Voice Call\" needs NO consent and CANNOT be blocked\n"
    "in the Preference Register - provided it goes through the DLT platform.\n\n"
    "So outbound callback is legal. Two obligations attach:\n"
    "  1. DLT Principal Entity registration is mandatory.\n"
    "  2. A voicebot is an auto-dialer -> 1600-series, pre-declared.\n\n"
    "Which means we can stop paying the toll-free premium for a\n"
    "regulatory shield we no longer need.", 15)

# ------------------------------------------------- 11 AUDIT
txt("p11t", 30, 4200, "11 - CONSTRAINT AUDIT: what a separate checker agent found wrong", 32, DRED)
box("p11z", 20, 4250, 4660, 1120, RED, sRED, sw=1, opacity=18)
txt("p11s", 45, 4285,
    "Audited against PS R1-R9, the five Basic Issues, the PM-AJAY guidelines, DPDP Rules 2025 and TCCCPR. "
    "Sources retrieved 26 Sept 2026.", 18, DRED)
blockers = [
    ("bk1", 45, "BLOCKER 1 - resume on a phone hash\nleaks and corrupts records\n"
                "Brother redials, READBACK speaks his sister's\ndisability disclosure aloud, and his answers\n"
                "overwrite hers under her consent record.\nFIX: DTMF resume PIN. See panel 6."),
    ("bk2", 1590, "BLOCKER 2 - the Rs 5.60 figure is wrong\nInbound toll-free bills the RECEIVER at a\n"
                  "premium (Rs 1.20-2.50/min), Exotel AgentStream\nis a paid add-on, and the GPU was excluded.\n"
                  "Real figure: Rs 488/head at 1,000. See panel 10."),
    ("bk3", 3135, "BLOCKER 3 - nothing captures WHERE they live\nNone of the seven PS fields is an address, and\n"
                  "the NQR has no geography. So R4's region-specific\noutput and the whole officer half had no GROUP BY.\n"
                  "FIX: Q0 village/block against LGD. See panel 7."),
]
for eid, x, lab in blockers:
    box(eid, x, 4325, 1520, 150, sRED, "#991b1b", lab, 15, label_color="#ffffff")
majors_a = [
    ("mj1", 45, "MAJOR - self-hosted ASR is Rs 4.29 lakh/yr idle\nand does not even carry the WER argument:\n"
                "26.8 is IndicWhisper's number, not IndicConformer's.\nFIX: Bhashini/Sarvam metered by default,\n"
                "self-hosted as the switch you demo."),
    ("mj2", 1590, "MAJOR - no NEAR_MISS producer, so R4's fourth\noutput (skill gaps requiring intervention) had\n"
                  "nobody emitting it. Contradicts decisions.md.\nFIX: the gate returns three buckets, not one.\n"
                  "Return-type change, not an architecture change."),
    ("mj3", 3135, "MAJOR - no PM-DAKSH routing. The guidelines say\nonly beneficiaries NOT covered by PM-DAKSH may be\n"
                  "considered. We would have recommended GIA money\nPM-AJAY is forbidden to spend. FIX: Stage 0.5."),
]
for eid, x, lab in majors_a:
    box(eid, x, 4495, 1520, 130, ORG, sORG, lab, 15)
majors_b = [
    ("mj4", 45, "MAJOR - DPDP: we cited the wrong rules.\nRule 10 is CHILDREN. Rule 11 is persons with\n"
                "disability, and it only bites when a guardian is\nappointed by a court / designated authority /\n"
                "LOCAL LEVEL COMMITTEE. So branch on decisional\ncapacity, not on disability - treating every\n"
                "mobility disclosure as incapacity is its own harm."),
    ("mj5", 1590, "MAJOR - retention was undefined, and Rule 8's\n3-year erasure does NOT apply to us (Third Schedule\n"
                  "is e-commerce / gaming / social media only).\nFIX: erase raw_transcript at CONFIRM, keep the\n"
                  "normalised value. \"We keep neither the voice nor\nthe words, only the confirmed answer.\"\n"
                  "Note: most DPDP Rules commence 13 May 2027."),
    ("mj6", 3135, "MAJOR - no outcome tracking anywhere.\nBasic Issue 3 (\"job placement after the skilling\n"
                  "programme\") and the guidelines' own 70% placement\ntarget - which CAG measured at 41% - were both\n"
                  "unanswered. FIX: one outcome table, updated from\nthe mobiliser's call list, not a new officer screen."),
]
for eid, x, lab in majors_b:
    box(eid, x, 4645, 1520, 150, YEL, sORG, lab, 15)
box("mn1", 45, 4815, 2280, 120, PUR, sPUR,
    "MINOR - cross-channel resume is a NOTICE defect, not a purpose defect. The purpose is unchanged;\n"
    "what breaks is that the spoken consent script never named Meta as a recipient. FIX: name all four\n"
    "surfaces in the one consent script, and gate the first turn on any NEW channel behind a one-line\n"
    "purpose restatement. Same turn as the resume PIN - one prompt buys both.", 15)
box("mn2", 2375, 4815, 2280, 120, PUR, sPUR,
    "MINOR - \"DTMF on every closed-set field\" overstates it. Of the seven mandated fields exactly one\n"
    "(self vs wage) is natively DTMF-able; education is borderline. DTMF really covers language pick,\n"
    "yes/no confirms and the new PIN - about 3 of 11 turns. Keep it, but don't let it anchor the cost model.", 15)
box("mn3", 45, 4955, 2280, 120, TEA, sTEA,
    "MINOR - Perspective Plan is named but not specified: no 3.5-4x notional-allocation projection,\n"
    "no multi-year horizon, no first-week-of-April date, no portal format.\n"
    "The differentiator was never the screen - it is the FORMAT and the DATE.", 15)
box("mn4", 2375, 4955, 2280, 120, TEA, sTEA,
    "MINOR - two scheme hooks missing from recommendation: the financial-literacy component that every\n"
    "course must carry (Ch.3 7A.a.iv), and the Rs 50,000 / 50%-of-project-cost asset grant that is\n"
    "conditional on a bank loan. Basic Issue 2 names both. Two boolean columns and one spoken line.", 15)
box("cov", 45, 5095, 4610, 110, YEL, sORG,
    "COVERAGE BEFORE THE FIXES:   R1 R3 R5 R6 R8 covered   -   R2 R4 R7 R9 partial   -   "
    "Basic Issues 3 and 4 MISSING   (1.5 of 5)\n"
    "R2 is partial for one reason only: the dialect measurement does not exist yet. decisions.md says "
    "\"we publish the measurement\" -\n"
    "until the 30-utterance test set is recorded, R2 is a claim and not a fact. "
    "It is the first thing to schedule and the first thing that will slip.", 16)


def main():
    scene = {
        "type": "excalidraw", "version": 2,
        "source": "https://excalidraw.com",
        "elements": elements,
        "appState": {"gridSize": None, "viewBackgroundColor": "#ffffff"},
        "files": {},
    }
    OUT.write_text(json.dumps(scene, ensure_ascii=False, indent=1))

    # Self-check: the bug this script exists to prevent is silently-dropped text.
    ids = {e["id"] for e in elements}
    texts = [e for e in elements if e["type"] == "text"]
    assert texts, "no text elements at all"
    for t in texts:
        assert t["width"] > 0 and t["height"] > 0, f"{t['id']} has zero size"
        assert t["fontFamily"] and t["fontSize"], f"{t['id']} missing font"
        if t["containerId"] is not None:
            assert t["containerId"] in ids, f"{t['id']} points at a missing container"
    for e in elements:
        for b in (e.get("boundElements") or []):
            assert b["id"] in ids, f"{e['id']} binds a missing text {b['id']}"
    assert len(ids) == len(elements), "duplicate element id"
    print(f"{OUT}  ok: {len(elements)} elements, {len(texts)} text")


if __name__ == "__main__":
    main()
