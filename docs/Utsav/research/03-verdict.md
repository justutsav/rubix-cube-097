# Verdict — what we're building, how big it is, and where it breaks

Synthesis of `01-the-customer.md` and `02-tech-landscape.md`, against
`docs/PROBLEM-STATEMENT.md`. This is the file to read if you read one.

---

## 1. What industry is this

Not "edtech". Not "a chatbot". **Public scheme delivery.**

The theme field says **Agriculture, FoodTech & Rural Development** — MoSJE chose rural
development over education, and the description says "local" five times. PM-AJAY's own
Annexure I is a catalogue of animal husbandry, sericulture, handloom, food processing,
minor irrigation and village-scale ISB units. The national skilling system, meanwhile,
actually delivered *Domestic Data Entry Operator* and *Telecom Customer Care Executive*.

**The industry is: a welfare ministry that has to buy skilling from a ministry it does
not control, for beneficiaries it cannot reach, through a district officer it cannot
staff.** Every one of those three clauses is quoted from a primary source in
`01-the-customer.md`.

And the failure is measured. CAG Report No. 20 of 2025: of **56.14 lakh** certified under
PMKVY STT, **41%** placed against PM-AJAY's own mandated **70%**; **40% of all certifications
in 10 job-roles**; **90.35% of "Green Jobs" certifications in the single role "Safai
Karmchari"**. MSDE's own written diagnosis to NSDC in July 2022: *"selection of job-roles
for skilling without any skill-gap analysis and assessment of market demand"* is the
**primary reason for poor placement**.

That sentence is the problem statement, written by the government, three years early.

## 2. What they actually want

**2.1 The PM-AJAY guidelines already require this system and have no instrument for it.**
Chapter 3 ¶7A.a.v.c: *"Identification of beneficiaries should be carried carefully after
assessing the interest of the candidates in the skill proposed to be imparted."* The only
prescribed mechanism is *"publicity"* followed by a Selection Committee meeting. The law
demands interest-assessment at scale and offers a poster.

**2.2 Four things they want that the PS does not say out loud.**

1. **Eligibility, not suggestion.** NSQF publishes hard entry requirements per level —
   including that **Levels 1-2 need no formal education at all**, and that **years of relevant
   experience substitute for schooling from Level 2.5 up**. A beneficiary saying *"I've done my
   father's weaving for twelve years"* is stating an eligibility claim. A recommendation they
   cannot enrol in manufactures the 41% one call at a time.
2. **The district, not just the person.** Four of the five "Basic Issues under GIA" are
   administrative — perspective plans, participant identification, placement, inter-department
   coordination, no ground staff. The decision-maker is a **District Collector chairing DL-PACC
   quarterly**, and the artefact is the **Perspective Plan uploaded to `pmajay.dosje.gov.in`** —
   due, per the May 2023 revision's calendar, **in the first week of April**.
   A recommendation that lives only on a beneficiary's phone is invisible to every committee
   in the scheme.
3. **Breaking the concentration.** If our recommendations across a district distribute like
   PMKVY's did, we have automated the failure with better UX. Spread is the metric.
4. **Not duplicating PM-DAKSH.** The guidelines forbid it by name. Routing to the sibling
   scheme when the sibling scheme is correct is three lines of code and instant credibility
   with a jury that owns both.

## 3. What do we build — app, web app, or something else?

**A voice-first multi-channel system with a web console for officers. Not "an app".**

The PS is internally in tension and the tension resolves cleanly:

- **Expected Solution** says *"application"* and *"the app"* → yes, build the Android app.
- **Detailed Description** names **three** channels: *IVR for feature phone users*,
  *WhatsApp voice-note interfaces*, *lightweight mobile or kiosk-based solutions*.
- **R6** says low-connectivity, low-tech.

So the deliverable is **one interview engine behind four thin transports**:

| Surface | Who | Why it is not optional |
|---|---|---|
| **Inbound IVR** (toll-free) | Feature-phone users; anyone whose handset is shared | PS names it **first**. Uses the voice network, not data — that is the point |
| **WhatsApp voice notes** | Smartphone households | PS names it second. 85.5% of households have a smartphone |
| **Offline Android kiosk/app** | Panchayat bhavan, CSC, training centre | PS names it third. The only surface that works with zero connectivity |
| **Assisted mode** (same app, in an ASHA/AWW/VLCC member's hands) | The mandated **30% women** participation | **51.6% of rural women 15+ own no mobile phone.** Without this the women's target is arithmetically unreachable. The PS doesn't name it; reality does |

Plus a **desktop web console** for the District PIU / DL-PACC, because §2.2's second point
has to land somewhere.

**Not a consumer app.** Not a login-first product. Not something requiring reading — including
the consent.

This is the opposite of PS 26154, where "dashboard, operator, desktop" was the whole answer.
Do not copy that instinct across; here the dashboard is the *second* product.

## 4. Scope

### Must ship — the PS names these; an evaluator will count them

- **Voice conversation replacing the form**, the **seven mandated fields in order**:
  educational background · traditional family occupation · current livelihood · skills and
  interests · mobility and physical constraints · self-employment vs wage preference ·
  local economic realities.
- **The four mandated outputs**: NSQF-aligned training programmes · trades and livelihood
  pathways · **skill gaps requiring intervention** · region-specific employment or enterprise
  opportunities.
- **Multiple languages**, working, demonstrated live — not a language dropdown over English.
- **All three named channels** running off one core. Three, not one.
- **Empathetic register** (R7) — the demo video is entirely made of this.
- A **spoken read-back and confirmation** before any recommendation. Calls drop; handsets are
  shared; a mis-heard "12th pass" silently changes the eligible qualification set.

### Should ship — this is where we win

- **Eligibility gate before ranking**, built from the published NSQF 2023 entry-requirement
  table, with **experience substitution** and a **NEAR-MISS** output that states the exact gap.
- **The dialect answer, measured.** No ASR model exists for Bhojpuri (5.05 crore speakers),
  Rajasthani (2.58 cr), Chhattisgarhi (1.62 cr) or Magahi (1.27 cr) — the total published
  corpus for four of those is ~18 hours. We absorb the error in a **vernacular trade lexicon
  with phonetic matching** and we **publish the WER alongside the field-extraction accuracy**.
  A chart showing extraction holding up while WER stays terrible is the best slide available.
- **The official NQR corpus** (2,814 qualifications), every field NULL-if-absent, `source` and
  `source_date` on every row. **No invented QP codes, ever.**
- **The officer half**: district demand aggregation → a **Perspective Plan input**, plus
  **PM-DAKSH routing**. Four of five Basic Issues. The point is not a dashboard; it is emitting
  the statutory artefact in the portal's format, at 3.5-4× notional allocation,
  by the first week of April.
- **Offline kiosk demo.** Put the phone in aeroplane mode on stage and complete an interview
  with Vosk + pre-rendered prompts.
- **DPDP compliance that is visible**: spoken consent as an FSM state, audio discarded after
  confirmed transcription, and a **guardian-consent branch** when the mobility/disability field
  discloses a condition — Rule 10 requires verifiable consent and *"a checkbox declaration is
  not sufficient"*. The PS's own schema triggers it.

### Nice to have

- Recommendation-spread chart over a synthetic district cohort (cheap, and it is the CAG
  argument made visual).
- Outcome tracking after training — the third Basic Issue.
- Sovereign-stack switch demonstrated live: Bhashini/IndicConformer/Sarvam-30B behind one
  config value.
- Callback scheduling so a woman can be reached on a phone she controls, at a time she chooses.

### Explicitly out of scope — say no now, not in week three

| Out | Why |
|---|---|
| Training a dialect ASR model | ~18 hours of corpus for four dialects. Not possible, and claiming it is worse than not doing it |
| An LLM "agent" that conducts the interview | Seven questions in a fixed order is an FSM. An agent is slower, unreproducible, wanders in front of judges, and destroys auditability |
| A national live labour-market feed | Two or three honest, sourced pilot districts beat a fabricated national map, and a jury member will be from one of those districts |
| Outbound automated calling at scale | TRAI's commercial-communications regime is unresolved for this case (`01-the-customer.md` §9.2). Inbound toll-free sidesteps it entirely |
| Re-implementing PM-DAKSH or SIA | MoSJE already shipped one; MSDE already shipped the other. Route to them; don't re-skin them |
| Enrolment, payments, stipend disbursement | PFMS/SNA territory. Out of a hackathon's reach and nobody is grading it |
| Multi-tenant auth, org management, billing | Nobody is grading it |

## 5. The hard parts, ranked

1. **The dialect claim being real and measured, not asserted.** The honest position is
   stronger than a fake one — but only with the measurement, which means recording a real
   30-utterance test set with a real speaker. First to schedule, first to slip.
2. **Sub-two-second turns on a live phone call.** Pre-rendered prompt audio and
   lexicon-before-LLM extraction get you there. One careless LLM call on the hot path
   destroys it, and it only ever shows up on a real call.
3. **The interview sounding human in five languages.** A writing problem, not an engineering
   one: seven questions × four re-prompts × five languages, warm, short, no scheme jargon.
   Needs a native speaker and several passes. It is also the entire demo video.
4. **Eligibility logic that is actually correct.** The framework's thirteen levels, multiple alternative
   entry routes each, experience substitutions, over an NCO occupation bridge that NCVET's own
   audit found **156 mis-mapped and 256 unmappable out of 2,157**. Wrong here is invisible in
   a demo and fatal in an audit.
5. **Opportunity data that is real.** The pressure to fabricate a district jobs feed will be
   enormous. Three districts, sourced and dated.
6. **The officer artefact matching the real Perspective Plan format.** Nobody on this team
   has yet opened `pmajay.dosje.gov.in` in a browser — its TLS chain broke automated fetch.
   Do that by hand, early, and screenshot what we claim.
7. **The SIA question.** MSDE + Meta + Sarvam shipped a multilingual **voice-note WhatsApp
   assistant that recommends NSQF courses, locates centres and surfaces jobs** on 17 May 2025.
   Somebody in the room knows. The answer must be one rehearsed paragraph, not an improvisation
   — see `02-tech-landscape.md` §7.1.
8. **Not becoming just another demo.** A voice pipeline, NQR discipline and a multi-surface
   product are each achievable alone. The win is *all three plus* dialect honesty and the
   district plan — and that is a scoping problem, not a talent problem.

## 6. The one-line pitch

> The PM-AJAY guidelines already require that a beneficiary's interest be assessed before
> they are put in a trade. For twenty years the instrument for that has been a poster on a
> wall. This is the instrument — a phone call, in their dialect, that ends in a qualification
> they are actually eligible for and a line in the district's Perspective Plan.
