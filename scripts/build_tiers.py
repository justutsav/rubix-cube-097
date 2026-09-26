#!/usr/bin/env python3
"""Build docs/Utsav/research/08-deployment.excalidraw — what runs where.

The flowchart (07) answers "what happens, in what order". It cannot also answer "what is the
server and what is the database", because a flow ordered by TIME interleaves tiers: the handset
talks to a vendor, then to the server, then the server talks to the database, then the answer goes
back to the handset. Colour-coding a flowchart by tier fights the flow.

So this is a second diagram with one job: five horizontal bands, one per tier, and an explicit
statement of what crosses each boundary. A judge should be able to point at any box and say which
tier it is in without reading a word of the body text.

Every band has an empty dashed ICON SLOT on its left, sized for a symbol to be dropped in by hand.

Run:  python3 scripts/build_tiers.py
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from exlib import (  # noqa: E402
    BLU, DBLU, DGRN, DORG, DPUR, DRED, GREY, GRN, ORG, PUR, RED, TEA, WHITE, YEL,
    Scene, sBLU, sGRN, sORG, sPUR, sRED, sTEA,
)

OUT = Path(__file__).resolve().parent.parent / "docs/Utsav/research/08-deployment.excalidraw"
s = Scene(seed=808)

X = 60
ICON = 150          # icon slot is a square of this size
BODY_X = X + ICON + 40
W = 2200            # band width
BODY_W = W - ICON - 40
ZONES: set[str] = set()


def band(eid, y, height, bg, stroke, tier, subtitle, icon_hint):
    """One tier: a tinted background, an icon slot, a big label."""
    s.box(eid + "_z", X, y, W, height, bg, stroke, sw=3, opacity=18)
    ZONES.add(eid + "_z")

    # Icon slot — deliberately empty. The symbol goes in by hand.
    s.box(eid + "_icon", X + 20, y + 24, ICON, ICON, WHITE, GREY, sw=2, style="dashed")
    ZONES.add(eid + "_icon")
    s.text(eid + "_ih", X + 26, y + 24 + ICON / 2 - 18, icon_hint, 12, GREY)

    s.text(eid + "_t", BODY_X, y + 22, tier, 28, stroke)
    s.text(eid + "_s", BODY_X, y + 60, subtitle, 16, GREY)
    return y + 94


s.text("t1", X, -150, "WHAT RUNS WHERE — the server, the database, and everything else", 40)
s.text("t2", X, -96,
       "Five tiers. A box belongs to exactly one. The two sentences at the bottom are the whole answer.", 19, GREY)

y = 0

# ============================================================ 1 handset
y2 = band("b1", y, 250, BLU, sBLU, "1 · THE HANDSET",
          "The beneficiary's phone, a panchayat kiosk, or an ASHA worker's tablet.  NOT a server. NOT a database.",
          "icon:\nphone /\nkiosk")
col = (BODY_W - 40) / 3
s.fitbox("h1", BODY_X, y2, col, WHITE, sBLU, size=13, pad=12,
         title="Android app (Capacitor)", title_size=15, title_color=DBLU,
         label="· minSdk 24, ~5 MB APK\n· Records the mic at 16 kHz mono WAV\n"
               "· Native Android TTS speaks the prompts\n· Tap to start, tap to stop")
s.fitbox("h2", BODY_X + col + 20, y2, col, WHITE, sBLU, size=13, pad=12,
         title="@rc097/core runs HERE too", title_size=15, title_color=DBLU,
         label="The same FSM, ladder, eligibility gate and\nrecommender that the server runs.\n"
               "Zero dependencies, so it runs anywhere.\nThis is why the channels cannot drift.")
s.fitbox("h3", BODY_X + 2 * (col + 20), y2, col, WHITE, sBLU, size=13, pad=12,
         title="IndexedDB / SQLite  +  outbox", title_size=15, title_color=DBLU,
         label="A local store with the SAME row shape and\nthe SAME CHECK constraints as Postgres.\n"
               "A full interview completes with the radio\noff; the outbox syncs itself later.")
y += 250 + 40

# ============================================================ 2 vendors
y2 = band("b2", y, 235, RED, sRED, "2 · OUTSIDE VENDORS",
          "Not ours. We hold no data here — audio goes out, text comes back, nothing is stored.",
          "icon:\ncloud /\n3rd party")
s.fitbox("v1", BODY_X, y2, col, WHITE, sRED, size=13, pad=12,
         title="Exotel", title_size=15, title_color=DRED,
         label="The phone network. Holds the voice call\nand streams 20 ms PCM frames to us.\n"
               "⚠ AgentStream must be enabled by email\nbefore any of this can be tested.")
s.fitbox("v2", BODY_X + col + 20, y2, col, WHITE, sRED, size=13, pad=12,
         title="Meta WhatsApp Cloud API", title_size=15, title_color=DRED,
         label="Delivers the voice note to our webhook\nand plays our reply back.\n"
               "Direct, not through a reseller — no\nper-message markup, and audio replies work.")
s.fitbox("v3", BODY_X + 2 * (col + 20), y2, col, WHITE, sRED, size=13, pad=12,
         title="Sarvam  —  speech to text", title_size=15, title_color=DRED,
         label="saaras:v3. 228-322 ms measured.\n22 languages including Maithili.\n"
               "Our key never leaves our server, so the\nhandset never talks to Sarvam directly.")
y += 235 + 40

# ============================================================ 3 edge
y2 = band("b3", y, 350, PUR, sPUR, "3 · SERVER — part A:  EDGE FUNCTIONS",
          "Supabase, ap-south-1 (Mumbai).  Serverless: request in, response out, nothing stays alive between calls.",
          "icon:\nlambda /\nfunction")
s.fitbox("e1", BODY_X, y2, col, WHITE, sPUR, size=13, pad=12,
         title="asr", title_size=16, title_color=DPUR,
         label="Takes the recorded WAV, calls Sarvam,\nreturns the transcript.\n\n"
               "HOLDS THE VENDOR KEY. In the APK it\nwould be one unzip away from anyone.")
s.fitbox("e2", BODY_X + col + 20, y2, col, WHITE, sPUR, size=13, pad=12,
         title="turn", title_size=16, title_color=DPUR,
         label="Two jobs:\n· applies the app's offline event list\n  to Postgres (the outbox drain)\n"
               "· runs the core for IVR and WhatsApp\n\nThis is where DECISIONS are made.")
s.fitbox("e3", BODY_X + 2 * (col + 20), y2, col, WHITE, sPUR, size=13, pad=12,
         title="identity", title_size=16, title_color=DPUR,
         label="Turns a verified phone number into\nhmac(e164, server pepper) = phone_hash.\n\n"
               "Returns COUNTS ONLY — never a name,\na trade or an answer.")
s.fitbox("e4", BODY_X, y2 + 190, BODY_W, YEL, sPUR, size=14, pad=12,
         label="WHY SERVERLESS IS ENOUGH HERE: every one of these is a single request with a single answer. "
               "Nothing needs to stay alive,\nso there is no machine to pay for, patch or restart — and it scales to zero between interviews.")
y += 350 + 40

# ============================================================ 4 vm
y2 = band("b4", y, 290, ORG, sORG, "4 · SERVER — part B:  ALWAYS-ON VM",
          "Oracle Cloud, Mumbai or Hyderabad.  A process that must stay alive. This is the ONLY reason we need a VM at all.",
          "icon:\nserver /\nrack")
s.fitbox("m1", BODY_X, y2, col * 1.5 + 10, WHITE, sORG, size=13, pad=12,
         title="telephony service  (Node)", title_size=16, title_color=DORG,
         label="· Holds the Exotel WebSocket OPEN for the whole four-minute call\n"
               "· Streams 20 ms audio frames both ways, with barge-in\n"
               "· Receives Meta's WhatsApp webhooks\n"
               "· Runs @rc097/core — the same code as the phone and the edge function")
s.fitbox("m2", BODY_X + col * 1.5 + 30, y2, col * 1.5 + 10, RED, sRED, size=13, pad=12,
         title="WHY AN EDGE FUNCTION CANNOT DO THIS", title_size=16, title_color=DRED,
         label="A phone call is not a request and a response. It is a connection that stays\n"
               "open for minutes, pushing audio in both directions the whole time.\n\n"
               "Edge functions are short-lived request/response workers. No amount of\n"
               "configuration changes that shape. So: one small always-on machine.")
y += 290 + 40

# ============================================================ 5 database
y2 = band("b5", y, 430, TEA, sTEA, "5 · THE DATABASE",
          "Supabase Postgres, ap-south-1 (Mumbai).  Stores rows. Enforces rules. Calls nothing. Decides nothing.",
          "icon:\ndatabase\ncylinder")
s.fitbox("d1", BODY_X, y2, col, WHITE, sTEA, size=13, pad=12,
         title="What it holds", title_size=16, title_color="#0e7490",
         label="beneficiary · session · answer\nconsent_event · recommendation · outcome\n"
               "qualification · district · block\ndistrict_opportunity\nperspective_plan (+ lines)\n"
               "turn_telemetry · app_user\n\n15 tables, live and seeded.")
s.fitbox("d2", BODY_X + col + 20, y2, col, WHITE, sTEA, size=13, pad=12,
         title="What it REFUSES", title_size=16, title_color="#0e7490",
         label="A CHECK constraint makes it IMPOSSIBLE to\nstore a raw transcript against a confirmed\n"
               "answer. Not a policy — the database will\nreject the row.\n\n"
               "There is no audio table and no\nrecording_url column. The absence is\nthe feature.\n\n"
               "The same constraints exist in the\non-device SQLite schema.")
s.fitbox("d3", BODY_X + 2 * (col + 20), y2, col, WHITE, sTEA, size=13, pad=12,
         title="Who may read what", title_size=16, title_color="#0e7490",
         label="Row Level Security, per role:\n· a mobiliser sees only her own district\n"
               "· an officer sees only their district\n· a beneficiary never connects at all\n\n"
               "The anon key ships inside the APK and is\nPUBLIC by design — RLS is what protects\n"
               "the data, not that string.")
s.fitbox("d4", BODY_X, y2 + 250, BODY_W, YEL, sTEA, size=14, pad=12,
         label="THE DATABASE NEVER CALLS ANYTHING. It has no idea Sarvam or Exotel exist. It receives writes from the server, "
               "answers reads\nfrom the officer console, and rejects anything that breaks a constraint. Every decision in this system "
               "is made in tier 3 or 4.")
y += 430 + 50

# ============================================================ the answer
s.fitbox("ans", X, y, W, "#e5dbff", sPUR, size=18, pad=20, sw=3,
         label="THE SERVER is the code that DECIDES — the seven questions, the extraction ladder, the eligibility gate, the ranking —\n"
               "plus the code that talks to vendors on our behalf so a key never ships in an app.\n\n"
               "THE DATABASE is the rows that REMAIN, and the rules that refuse bad ones.\n\n"
               "The same core runs in three places: the handset, the edge function and the VM. The database runs in exactly one.")
y += s.byid("ans")["height"] + 40

# ============================================================ boundary crossings
s.text("bt", X, y, "WHAT CROSSES EACH BOUNDARY", 26, DBLU)
y += 40
rows = [
    ("x1", "handset  →  edge function", "a recorded WAV + a locale.  Never a name, never a number.", sBLU),
    ("x2", "edge function  →  vendor", "the audio only.  The key stays behind; the vendor never sees who it belongs to.", sPUR),
    ("x3", "handset  →  edge function", "the offline event list, when signal returns.  Idempotent, so replaying is harmless.", sBLU),
    ("x4", "VM  →  edge function", "the same event list, for IVR and WhatsApp turns.", sORG),
    ("x5", "edge function  →  database", "rows.  Beneficiary first, then session — the foreign key demands that order.", sPUR),
    ("x6", "database  →  officer console", "aggregates, scoped by RLS to that officer's own district.", sTEA),
    ("x7", "NEVER CROSSES ANYWHERE", "the raw audio, the raw phone number, and the transcript after confirmation.", sRED),
]
for i, (eid, left, right, col) in enumerate(rows):
    yy = y + i * 54
    s.box(eid + "_l", X, yy, 700, 46, WHITE, col, left, 16, sw=2, align="left")
    s.box(eid + "_r", X + 720, yy, W - 720, 46, WHITE if col != sRED else RED, col, right, 15, sw=2, align="left")

s.validate(zones=ZONES)
s.save(OUT)
