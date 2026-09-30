# Deck fixes — SIH 26097, per page

Reviewed 2026-09-28 against the primary sources in `docs/references/`, the codebase, and the
five fact-check passes behind `docs/Utsav/video/26097_Video_Script_source.md`.

Severity key:

- 🚨 **BLOCKER** — factually wrong or wrong-project. A judge can catch it.
- ⚠️ **CLAIM** — not supported by what we built. Soften or mark as planned.
- ✏️ **TYPO** — spelling/labelling.
- 💡 **UPGRADE** — correct but weaker than it could be.

---

## Page 2 — Problem / Proposed Solution / How it Addresses

### 🚨 BLOCKERS

1. **The title says "KALA SETU" — replace it with `Our Solution`.** ✅ *Decided.*
   "Kala Setu" is the artisan/handicraft project's name (SIH 26090 — *kala* = art) and has no
   connection to NSQF skilling for SC beneficiaries. There is no project title for 26097, and
   the page does not need one — it needs a label for what it contains.

   > **Page 2 title → `Our Solution`**

   Set it in the same type style as the other page headers (`TECHNICAL APPROACH`,
   `FEASIBILITY AND VIABILITY`, `IMPACT AND BENEFITS`) so the deck reads as one object. Right
   now page 2 is the only page whose header is a brand name rather than a section name, which
   is what made the leftover survive this long.

   *(Page 6 carries matching leftovers — see below. Two pages pointing the same way makes a
   copy-paste origin the likely explanation, so sweep all 26 slides for others.)*

2. **No officer half anywhere on this page.** Four of the PS's five "Basic Issues under GIA"
   are about officers, not beneficiaries. The 5-step flow ends at *"ACTIONABLE LIVELIHOOD
   RECOMMENDATIONS"* — i.e. at the beneficiary. A submission that stops there answers one
   bullet in five, and this is the page that defines our scope for the reader.
   **Add a step 6:** district demand → Perspective Plan → statutory calendar.

### ⚠️ CLAIMS

3. **Step 4, "NSQF-ALIGNED PATHWAY OPPORTUNITY MAPPING"** — "maps the beneficiary to suitable
   training" understates what is built and loses our strongest differentiator. The engine
   applies a **hard eligibility gate** (published NSQF entry requirements, with the
   schooling↔experience trade-off) *before* ranking, and emits a **NEAR-MISS with the exact
   gap** when she doesn't qualify. "Maps to suitable" is what every team will write.
   **Rename to "NSQF ELIGIBILITY CHECK & PATHWAY MAPPING"** and add the near-miss line.

### 🏗️ INCOMPLETE

4. Two empty phone mockups (right column) — fill or remove.
5. Empty white box below them — fill or remove.
6. **Solution Video / App Link both say "Click here" with no destination.** Judges do click these.

### ✏️ TYPOS

| Where | Wrong | Right |
|---|---|---|
| Problem box, icon 2 | `Limited awarness` | `Limited awareness` |
| Solution box, icon 2 | `Beneficiary assesment` | `Beneficiary assessment` |

*(The black Canva "exit full screen" bar across the title is a screenshot artifact, not a deck
problem — ignore.)*

---

## Page 4 — Feasibility and Viability

### 🚨 BLOCKERS

1. **The SIH logo says "SMART INDIA HACKATHON 2025".** Every other page says 2026. Fix the logo.

2. **"Can integrate with existing govt. portal"** (Integration feasibility). This is the same
   claim we removed from the flowchart, and it does not survive checking:
   - The word **"API" appears zero times** in the 46-page PM-AJAY guidelines (verified by
     word-boundary grep).
   - The PM-AJAY portal **and the official AJAY mobile app** were launched by MoSJE on
     **26 May 2026**, with role-based district and state logins already built in.
   - **No public or third-party API / developer documentation exists.**

   The jury owns that portal. **Rewrite to:** *"Produces the Perspective Plan input in the
   format the officer uploads to the PM-AJAY portal"* — same value, zero overclaim.

3. **Challenge 2 mitigation: "Convers in regional language and local dialects."** Dialect claims
   are the single most dangerous thing on this deck in front of MoSJE. Models *do* now exist
   (Bhashini's own ASR list carries Bhojpuri and Chhattisgarhi) and they are **still wrong
   roughly three words in ten** — Bhojpuri 27.8 WER, Chhattisgarhi 27.4, Magahi 30.4,
   Rajasthani 41.8 (ARTPARK-IISc SraVaani-1.0).
   **Rewrite to:** *"Handles dialect speech at published error rates — the field is classified
   over a closed set, with phonetic matching and spoken read-back, so a wrong transcript still
   produces a right answer."* That is both true and more expert-sounding.

### ⚠️ CLAIMS

4. **"Uses govt. verified dataset (NQR, NSQF, Skill India, PM-AJAY)."** NQR and NSQF are real
   and in-repo (`ai/data/nqr.json`, 2,814 rows, sha256-pinned; the NSQF gazette in
   `docs/references/`). **"Skill India" and "PM-AJAY" are not datasets we hold.** Drop both, or
   relabel that row `NQR + NSQF (imported) · PM-AJAY guidelines (policy source)`.

5. **Challenge 3 mitigation: "Direct linkage with local industry networks."** Not built, and
   "direct linkage" implies employer agreements we do not have. Soften to *"region-specific
   opportunity mapping"* — which is what the engine actually does.

6. **Challenge 1 mitigation: "Periodic profile updates to capture changing aspirations."**
   Reads as built; it is not. Either mark planned or fold it into the follow-up-call USP, where
   it belongs and is deliberate.

### 💡 UPGRADE

7. **Program Viability is generic.** *"Supports PM-AJAY livelihood & skill-development
   implementation"* could be any team. Replace with the statutory hook nobody else will have:
   *"Feeds the district's projects into the State's Perspective Plan on the Ch.3 ¶9 calendar —
   districts by 1st week April, State prioritises by 15 April, forwarded by 21 April."*

### ✏️ TYPOS

| Where | Wrong | Right |
|---|---|---|
| Feasibility, all four headings | `feasibilty` ×4 | `feasibility` |
| Integration feasibility | `scalibilty` | `scalability` |
| Viability, 4th heading | `Scalibility` | `Scalability` |
| Challenge 2, mitigation 1 | `Convers in` | `Converses in` |
| Challenge 2, mitigation 2 | `Accesible` | `Accessible` |
| Challenge 3, mitigation 3 | `Guidnce` | `Guidance` |
| Challenge 3, mitigation 3 | `enterprenership` | `entrepreneurship` |
| Challenge 2, mitigation 3 | `easy , step-by-step` | `easy, step-by-step` (space before comma) |

---

## Page 5 — Impact and Benefits

### ⚠️ CLAIMS

1. **"Onboards instantly through regional dialect voice calls."** Two problems: "instantly" and
   "dialect". See page 4 item 3 — claim the error rate, never the fluency.
   **Rewrite:** *"Onboards through a voice call in her language — no form, no typing."*

2. **"Connects trained candidates with verified local employers."** Not built. There is no
   employer registry and no verification step anywhere in the codebase.
   **Rewrite:** *"Surfaces region-specific employment and enterprise opportunities"* — the PS's
   own fourth mandated output, and what the engine actually emits.

3. **"Routes verified beneficiary profiles to relevant skilling platforms."** "Verified" implies
   identity verification (Aadhaar/SECC), which is **PS 25152's problem, not ours**. We confirm
   answers with the beneficiary; we do not verify identity against a government register.
   **Rewrite:** `verified` → `confirmed`.

4. **The integration diagram (SIDH ↔ NCS ↔ PM-AJAY ↔ Employer Verification).** Four live
   integrations are drawn; none is built. Either add a `PLANNED` band across that panel, or
   redraw it as *"one confirmed profile, reusable by"* — which is honest and still shows reach.

5. **"Works on 2G feature phones."** Technically muddled — an IVR call uses the **voice
   network**, not 2G data, which is a *stronger* claim.
   **Rewrite:** *"Works on any phone that can make a call — no data connection at all."*

6. **"Enables post-training employment follow-up through voice check-ins."** This is our
   follow-up-call USP and it is good — but it is **not built** (the `outcome` table is populated
   by a human today). On a proposed-solution slide that is acceptable; just keep the verb
   future-facing and don't let anyone demo it.

### 💡 UPGRADES

7. **The eligibility gate / NEAR-MISS does not appear anywhere on this page** — our clearest
   differentiator is missing from the impact story. Add to SC Beneficiaries:
   *"Tells her what she is eligible for — and for what she isn't, the exact gap."*

8. **SDG selection is right** (1, 4, 8, 10) and better-argued than most. No change.

9. **The "PMKVY data – not PM-AJAY beneficiaries" honesty note on page 6 is excellent.**
   Consider the same treatment here for anything marked planned. Visible scope-honesty scores.

---

## Page 6 — Research and References

### 🚨 BLOCKERS

1. **Leftover artisan-project references — wrong problem statement.** All four of these belong
   to the handicraft/marketplace deck, not to PS 26097:
   - **Ministry of Textiles** — *"Handicrafts, handloom and artisan development programs"*
   - **Ministry of MSME** — *"Digital market access, ONDC onboarding and catalog creation"*
   - **Ministry of Commerce and Industry** — *"Market access, e-commerce exports for artisan"*
   - **Research paper [3]** — *"Behera et al., 2005, SME digital-commerce adoption barriers in
     Odisha"*

   ONDC, catalog creation and e-commerce exports have no connection to NSQF skilling for SC
   beneficiaries. **Delete all four.** This is the same leftover pattern as "KALA SETU" on
   page 2.

2. **Our single strongest source is not cited on the page that cites sources.** The 41% figure
   in the middle panel comes from it:
   > **CAG Union Government (Civil) Performance Audit, Ministry of Skill Development and
   > Entrepreneurship, Report No. 20 of 2025 — PMKVY**, Para 3.6 (placement), Table 2.1(a)
   > (40% in 10 job-roles), Table 2.1(b) (90.35% of Green Jobs in one role).

   Add it, with the link. Also missing and worth adding:
   - **PM-AJAY Guidelines (Revised, May 2023)** — Ch.3 ¶7A.a.v.c (interest assessment),
     Ch.3 ¶9 p.26 (the statutory calendar), Ch.1 ¶6(c) (Perspective Plan authorship).
   - **NSQF Gazette Notification, June 2023** — the minimum-entry-criteria table our eligibility
     gate is built from.
   - **NQR** (`nqr.gov.in`) — the 2,814-qualification register, which is our actual corpus.

### 🚨 FACT

3. **"74.6% SC population lives in rural areas (Census 2011)."** The Census figure is **76.4%**.
   This looks like a digit transposition. **Verify and correct.**

   Everything else on the page checks out:

   | Claim | Verdict |
   |---|---|
   | 20.14 crore SC population, 16.63% of total | ✅ Census 2011 |
   | SC literacy **66.07%** | ✅ Census 2011 |
   | Overall literacy **72.98%**, gap **6.91pp** | ✅ arithmetic correct |
   | 56.14 lakh certified → 23.18 lakh placed ≈ **41%** | ✅ CAG Report No. 20 of 2025, Para 3.6 |

   One optional sharpening on the literacy gap: comparing SC to the **overall** rate understates
   it, because the overall rate includes SC. Against **non-SC (74.04%)** the gap is **7.97pp**.
   Both are defensible; the current framing is the conservative one, which is fine — just know
   the better number exists if you want it.

### 💡 UPGRADES

4. **Large empty area, bottom-left.** The obvious filler is the piece of research that is
   genuinely ours and that nobody else will have: **the dialect error-rate table.** Bhojpuri
   27.8 / Chhattisgarhi 27.4 / Magahi 30.4 / Rajasthani 41.8 WER, ~10.53 crore speakers, all
   non-scheduled. It is the page's strongest content and it currently isn't on it.

5. **Technical References ("Click here" ×3) have no visible destination.** Same as page 2 —
   fill or remove.

### ✏️ TYPOS

| Where | Wrong | Right |
|---|---|---|
| Page title | `RESEARCH AND REFRENCES` | `RESEARCH AND REFERENCES` |
| Right panel heading | `GOVERNMENT POLICIES & REFRENCES` | `GOVERNMENT POLICIES & REFERENCES` |
| Chart label, twice | `PMKYY ST/SP` | `PMKVY STT/SP` |
| Technical References, 1st | `Speech & Language AI` — no source link text | give it a real label |

---

## Cross-deck: three phrases to ban everywhere

Worth a find-and-check across all 26 slides, because each one is checkable and wrong:

1. **Any claim of API / data sync with the PM-AJAY portal.** No public API exists; the portal
   and its official app launched 26 May 2026 with district and state logins already in it.
   We produce what the officer uploads.
2. **Any claim of dialect support stated as fluency or coverage.** Claim the published error
   rate; never claim we solved it, and never claim no model exists (Bhashini carries two of the
   four — saying otherwise to MoSJE is fatal).
3. **"Verified" applied to beneficiaries.** Identity verification is PS 25152's problem. Ours
   is *confirmed* answers — a read-back the beneficiary agreed to.

And one to add everywhere it fits: **the four statutory dates.** Every team will have arrows
between a district and a state. Only a team that read page 26 has 1st week April → 15 April →
21 April → 1st week May.
