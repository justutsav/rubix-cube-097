#!/usr/bin/env python3
"""Build docs/Utsav/research/09-server-core.excalidraw — the inside of the server box.

The one-page flowchart has to keep "SERVER CORE" small. This is that box opened up, drawn against
what ai/engine actually does — flow.py, extract.py, eligibility.py, recommend.py — not against an
idealised design.

It also draws the half that was missing everywhere: what happens AFTER the recommendation. The
interview ending is not the product ending. She has to be able to act on it, the village worker has
to know to visit, and the district has to find out whether she ever got a job.

Run:  python3 scripts/build_servercore.py
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from exlib import (  # noqa: E402
    BLU, DBLU, DGRN, DORG, DPUR, DRED, GREY, GRN, ORG, PUR, RED, TEA, WHITE, YEL,
    Scene, sBLU, sGRN, sORG, sPUR, sRED, sTEA,
)

OUT = Path(__file__).resolve().parent.parent / "docs/Utsav/research/09-server-core.excalidraw"
s = Scene(seed=909)

X, W = 60, 2060
ZONES: set[str] = set()
mid = X + W / 2


def down(eid, y, colour=sPUR, label=None, dy=34):
    s.arrow(eid, mid, y, 0, dy, colour)
    if label:
        s.text(eid + "_l", mid + 16, y + 4, label, 14, GREY)
    return y + dy + 12


s.text("t1", X, -140, "INSIDE THE SERVER — one turn, start to finish", 38)
s.text("t2", X, -90, "Drawn from ai/engine: flow.py · extract.py · eligibility.py · recommend.py.  Short version of what each stage does.", 18, GREY)

y = 0
s.box("in", X + 600, y, 860, 54, BLU, sBLU, "AUDIO ARRIVES  —  from any of the three bridges", 18)
y += 54 + 10
y = down("a0", y, sBLU)

# ---------------------------------------------------------------- 1 speech
s.text("h1", X, y, "1 · SPEECH → TEXT", 24, DPUR)
y += 36
half = (W - 40) / 2
a = s.fitbox("sp1", X, y, half, WHITE, sPUR, size=14, pad=14,
             title="Two engines, one falls back to the other", title_size=16, title_color=DPUR,
             label="SARVAM  saaras  —  cloud, paid, best on a bad line\n"
                   "VOSK  —  offline, free, 80 MB, runs on the box\n\n"
                   "Sarvam returns 429 or takes over 2 s  →  Vosk answers\n"
                   "and the call carries on. Measured, not assumed.")
b = s.fitbox("sp2", X + half + 40, y, half, YEL, sORG, size=14, pad=14,
             title="Measured on a simulated phone line", title_size=16, title_color=DORG,
             label="                      clean      bad line (noise+loss)\n"
                   "Vosk      WER      2%            36%\n"
                   "Sarvam  WER      3%            11%\n"
                   "Answers understood: Vosk 68% · Sarvam 89%\n"
                   "Both well inside the 1.8 s turn budget.")
y += max(a["height"], b["height"]) + 10
y = down("a1", y, sPUR, "n-best text")

# ---------------------------------------------------------------- 2 ladder
s.text("h2", X, y, "2 · UNDERSTAND THE ANSWER  —  cheapest first, stop when one fires", 24, DPUR)
y += 36
rungs = [
    ("Rung 0", "KEYPAD / TAP", "free · instant · never wrong", BLU, sBLU),
    ("Rung 1", "LEXICON  —  sounds-like match on trade words", "~70% of answers · ~5 ms", GRN, sGRN),
    ("Rung 2", "REGEX  —  numbers, class levels, years", "~2 ms · Q1 and Q2-years", GRN, sGRN),
    ("Rung 3", "LLM  —  only 'which of these options?'", "uncommon · 400-1200 ms", PUR, sPUR),
    ("Rung 4", "ASK HER TO CONFIRM  —  spoken readback", "catches what the rest got wrong", ORG, sORG),
]
for i, (n, what, cost, bg, st) in enumerate(rungs):
    yy = y + i * 46
    s.box(f"r{i}a", X, yy, 150, 38, bg, st, n, 15, sw=2)
    s.box(f"r{i}b", X + 160, yy, 1180, 38, bg, st, what, 15, sw=2, align="left")
    s.box(f"r{i}c", X + 1350, yy, W - 1350, 38, WHITE, st, cost, 14, sw=2, align="left")
y += len(rungs) * 46 + 6

s.fitbox("thr", X, y, W, RED, sRED, size=15, pad=14,
         label="HOW SURE IS IT?    0.85 and above → confirm and move on    ·    0.55 to 0.85 → read it back to her first    ·    below 0.55 → ask again\n"
               "Two spoken tries, then the keypad menu twice, then DEFER — move on and come back. The call never ends because we could not understand her.")
y += s.byid("thr")["height"] + 10
y = down("a2", y, sPUR, "one confirmed field")

# ---------------------------------------------------------------- 3 core
s.text("h3", X, y, "3 · THE CORE  —  three parts, in this order", 24, DGRN)
y += 36
core_top = y
s.box("cz", X - 14, y - 10, W + 28, 10, "#e5dbff", sPUR, sw=1, opacity=25)
ZONES.add("cz")

a = s.fitbox("c1", X, y, W, WHITE, sPUR, size=14, pad=14,
             title="3a · INTERVIEW — seven questions, fixed order, never an agent", title_size=17, title_color=DPUR,
             label="language  →  q0 village  →  CONSENT  →  q1 school  →  q2 family trade  →  q2 years  →  q3 what she earns from\n"
                   "  →  q4 what she wants to learn  →  q5 how far / any constraint  →  q6 own work or a job  →  q7 local demand\n"
                   "  →  READ ALL SEVEN BACK  →  recommend\n\n"
                   "q5 may branch to a guardian check — on decisional capacity, never on disability.\n"
                   "PRESS # AT ANY TIME  →  a real person calls her back. Nobody is trapped in a menu.")
y += a["height"] + 12

hw = (W - 40) / 2
b = s.fitbox("c2", X, y, hw, WHITE, sGRN, size=14, pad=14,
             title="3b · ELIGIBILITY GATE — rules only, no model", title_size=17, title_color=DGRN,
             label="Her schooling and her years of work, against the\nNSQF entry table. Three answers, always:\n\n"
                   "ELIGIBLE        she can enrol today\n"
                   "NEAR-MISS      with the exact gap —\n"
                   "                     'one more year', or 'do Level 2 first'\n"
                   "INELIGIBLE     and why\n\n"
                   "881 expired courses are never ranked.")
c = s.fitbox("c3", X + hw + 40, y, hw, WHITE, sTEA, size=14, pad=14,
             title="3c · RECOMMENDER — ranks inside the eligible set only", title_size=17, title_color="#0e7490",
             label="Scores on written-down, versioned weights:\nwhat she wants · what she can already do ·\nlocal demand · own-work vs job · distance\n\n"
                   "Returns TOP 3, and the rules that keep it honest:\n   at most 2 from any one sector\n   no duplicate titles\n   plus the best NEAR-MISS\n\n"
                   "1,198 of 2,814 are actually recommendable.")
y += max(b["height"], c["height"]) + 14

d = s.fitbox("c4", X, y, W, TEA, sTEA, size=14, pad=14,
             label="WRITTEN WITH EVERY RECOMMENDATION: the answers used, the weights version, the engine version, the register's sha256.\n"
                   "In 2030 'why was she sent to this trade' has to be answerable from a row.")
y += d["height"] + 14
z = s.byid("cz"); z["y"] = core_top - 10; z["height"] = y - core_top + 4

# two arrows out
s.elbow("o1", mid, y, [[0, 0], [0, 30], [-640, 30], [-640, 70]], sGRN)
s.elbow("o2", mid, y, [[0, 0], [0, 30], [640, 30], [640, 70]], sTEA)
y += 86

# ---------------------------------------------------------------- 4 outputs
s.text("h4", X, y, "4 · WHAT COMES BACK", 24, DGRN)
y += 36
a = s.fitbox("b1", X, y, hw, GRN, sGRN, size=14, pad=14, sw=3,
             title="TO HER — spoken, on the same channel, under a minute", title_size=16, title_color=DGRN,
             label="'You have done twelve years of weaving. For this\ncourse you do not need a school certificate.'\n\n"
                   "· the three options, one plain sentence each\n· the near-miss and exactly what would close it\n"
                   "· PM-DAKSH instead, if that fits her better\n· ₹50,000 help if she starts her own work\n"
                   "· what to do on Monday, and where\n· press 9 to hear it again, any time")
b = s.fitbox("b2", X + hw + 40, y, hw, TEA, sTEA, size=14, pad=14, sw=3,
             title="TO THE DATABASE — and from there, the officer", title_size=16, title_color="#0e7490",
             label="answers · consent · the recommendation · outcome\n\n"
                   "Rolls up to: demand by block and trade,\nthe Perspective Plan, the consent register,\n"
                   "placement tracking.\n\nAdapters never write here. Only the core does.")
y += max(a["height"], b["height"]) + 14
y = down("a4", y, sORG)

# ---------------------------------------------------------------- 5 after
s.text("h5", X, y, "5 · AFTER THE RECOMMENDATION  —  the part that was missing", 24, DORG)
y += 36
s.fitbox("why", X, y, W, RED, sRED, size=15, pad=14,
         label="A recommendation she cannot act on is the CAG's 41% placement figure being made one call at a time.\n"
               "The interview ending is not the product ending — so every channel has a next step, and somebody is told to follow up.")
y += s.byid("why")["height"] + 14

third = (W - 80) / 3
a = s.fitbox("n1", X, y, third, WHITE, sBLU, size=13, pad=14,
             title="ON THE CALL", title_size=16, title_color=DBLU,
             label="Straight after the three options:\n\n"
                   "'Shall I send this to you on WhatsApp?'\n     → 1 yes · 2 no\n\n"
                   "'Should the village worker come and\n help you enrol?'\n     → 1 yes → she is added to the\n        worker's call list\n\n"
                   "'Press 9 to hear it again.'\n\nPress # at any time for a human.")
b = s.fitbox("n2", X + third + 40, y, third, WHITE, sORG, size=13, pad=14,
             title="IN THE APP  —  MY PLAN", title_size=16, title_color=DORG,
             label="The plan stays. She can open it any day.\n\n"
                   "· the three options and the gap, spoken\n  again on a tap\n"
                   "· what to carry: Aadhaar, caste\n  certificate, bank passbook, photo\n"
                   "· nearest centre and how far\n"
                   "· 'I WANT TO ENROL' → tells the worker\n"
                   "· a reminder before the batch starts")
c = s.fitbox("n3", X + 2 * (third + 40), y, third, WHITE, sTEA, size=13, pad=14,
             title="AND THEN, MONTHS LATER", title_size=16, title_color="#0e7490",
             label="The worker updates one list on her phone:\n\n"
                   "RECOMMENDED → ENROLLED → CERTIFIED\n       → PLACED     (or DROPPED, and why)\n\n"
                   "Not a new officer screen — the list she\nalready works from.\n\n"
                   "This is Basic Issue 3, and the only way\nthe district learns whether any of it\nactually worked.")
y += max(a["height"], b["height"], c["height"]) + 16

s.fitbox("loop", X, y, W, "#e5dbff", sPUR, size=15, pad=16, sw=3,
         label="AND IT LOOPS BACK: a NEAR-MISS is not a rejection. 'One more year' or 'do the Level 2 course first' becomes a task on the\n"
               "worker's list too — so the same person is re-interviewed when the gap closes, instead of being counted as a failure.")

s.validate(zones=ZONES)
s.save(OUT)
