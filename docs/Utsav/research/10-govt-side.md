# 10 — The government side: who sees what, and who submits to whom

Working session, 2026-09-27. Utsav's questions verbatim, the answers, and the facts each
answer rests on. The beneficiary half of the flowchart was settled before this; everything
here is the officer half, from the dashboard to the PM-AJAY portal.

Two things changed as a result of this session:

1. **The submission chain was wrong in the earlier draft.** A District officer does *not*
   submit to the Ministry. District → State → Ministry, four dates. Utsav caught this.
2. **State and Central levels belong on the chart.** Justified by our own PS (Basic Issue 4),
   not borrowed from another team.

Sources are the guidelines PDF in `docs/references/PM-AJAY-Guidelines-Revised-May2023.pdf`
unless stated otherwise. Page/chapter cites are to that file.

---

## The starting point: the officer flow, in 2–3 word labels

Utsav's constraint was that every box label must be self-explanatory in two or three words,
because the flowchart has no room for sentences.

```
Monitoring Officer
      ▼
District Dashboard
 ├─ Reach & Women %
 ├─ Joined vs Placed
 ├─ Trade Spread
 ├─ Data Honesty
 └─ Convergence Report
      │
   confirmed demand
      ▼
Perspective Plan   (statutory · due 1st week April)
 ├─ Trade-wise Demand
 ├─ Gap Counts
 └─ 3.5–4× Cost Ask
      │
   DL-PACC submits
      ▼
PM-AJAY Portal
```

What each label means — for us, not for the chart:

| Label | Meaning |
|---|---|
| Reach & Women % | how many interviewed, women share against the 30% mandate |
| Joined vs Placed | enrolled → working, against the 70% placement mandate |
| Trade Spread | distinct trades and top-10 share — did we repeat PMKVY's concentration? |
| Data Honesty | unsourced rows, prototype rows, latency, shown as numbers |
| Convergence Report | per-block, per-trade demand for other departments to act on |
| Trade-wise Demand | the `district_demand` view, confirmed answers only |
| Gap Counts | near-miss totals — who needs a bridge course |
| 3.5–4× Cost Ask | the guidelines mandate projecting 3.5–4× the notional allocation |

**On renaming "Perspective Plan":** keep it. It is the statutory term. A jury member who
knows PM-AJAY recognises it instantly, and that recognition is the differentiator. Rename it
and we sound like we invented a dashboard. Gloss it in small text: *"the district's funded
training ask"*.

---

## Q1. "Convergence Export — is this a government word? Or do they use MIS report?"

Both *convergence* and *MIS* are theirs. *Export* is ours.

- **"Convergence"** — 37 occurrences in the guidelines, and it is in the committee names
  themselves: Project Appraisal **cum Convergence** Committee (PACC), Village Level
  **Convergence** Committee (VLCC).
- **"MIS"** — also theirs. Ch.5 ¶b: *"a centralized MIS portal would be in place, to capture
  the data on real time basis... gap analysis, plan preparation, evaluation, progress
  monitoring and provide a dashboard on a real time basis."*
- **"Export"** — developer word. Not in the document.

### Why not label it "MIS Report"

The MIS is **the Ministry's own portal**, run by a Technical Support Group, linked to other
government dashboards. We do not build it. Calling our CSV an "MIS Report" claims we *are*
the MIS — checkable, and false. We **feed** the MIS.

**Decision: "Convergence Report."** Their noun, neutral verb, no overclaim.

Runner-up: **"Gap Analysis"** — verbatim from the same MIS clause, and literally what the
data is. Use it instead if the label should say what it *contains* rather than who it is *for*.

Side note: "District Dashboard" is also safe vocabulary — the guidelines require the MIS to
*"provide a dashboard on a real time basis."*

---

## Q2. "What is trade in trade spread, and what is a convergence report?"

### Trade

The line of work. The ITI/NSQF word for an occupation you can be trained in. Our lexicon
(`ai/data/lexicon.json`) has 26:

> सिलाई (tailoring) · बुनाई (weaving) · चमड़े का काम (leather) · खेती (farming) ·
> पशुपालन (dairy) · राजमिस्त्री (construction) · ब्यूटी पार्लर · बढ़ई (carpentry) ·
> बिजली का काम (electrical) · नल का काम (plumbing) · …

**Trade Spread** = across how many of those 26 did our recommendations actually land?

It is on the dashboard because of the CAG finding in `decisions.md`: 40% of national
certifications sat in **10 job-roles**, and 90% of "Green Jobs" in **one**. If our engine
sends everyone to tailoring, we have automated PMKVY's failure with a nicer voice. Two
numbers: distinct trades recommended, and top-10 share. The number exists to catch us, not
to flatter us.

### Convergence Report

**Convergence** is PM-AJAY's core funding idea. The scheme mostly does not pay for things
itself — it pulls *other departments' existing schemes* into the village and gap-fills only
what is left. Hence the committee names.

So the report answers: *which other department should act, where, for how many people?*

```
District Sitapur · Biswan block
  सिलाई (tailoring)     34 people   (12 women)
  बिजली का काम          12 people
  पशुपालन (dairy)        9 people
```

The officer hands that to whoever already funds those trades — NRLM, DDU-GKY, NABARD, the
state skill mission. They act with their own money. PM-AJAY funds the remainder.

Built from the `district_demand` view, **confirmed answers only**. An unconfirmed answer is a
resumable field, not a data point to put in front of another department.

---

## Q3. "Should we make the district and state officer dashboards like this?"

Asked against a reference slide from another team showing: District Officer, State Officer,
two dashboards, MIS Verification, Fund Utilization, Verified MIS Data, Central PM-AJAY Team,
MongoDB, Data Sync via API.

**First answer given (partly wrong — see Q4):** don't copy it, because four of those things
are not built, and `init.sql:371` says *"A mobiliser sees her own district. An officer sees
their district. Nobody sees the country."*

**What survived that objection:** do not draw *Fund Utilization*, *MIS Verification*, or
*MongoDB*. We track no fund disbursement, we verify nobody's MIS, and we are on Postgres with
row-level security — which is precisely how three role-scoped views come out of one database.
Showing a Mongo icon and an inter-level API sync would be borrowing another stack's problems.

**What was wrong:** the conclusion that State and Central should be left off entirely. See
below.

**What was right and worth keeping:** the reference chart *ends at a government body*. Ours
ended at a floating "Convergence Report" with no destination. Every flow needs a terminus.

Other fixes noted on the current chart at this point:

1. The "Track / Beneficiary Progress / Scheme Impact" box is vague, and *Scheme Impact* is
   something we do not measure. Replace with the five dashboard labels.
2. "Convergence Report" was floating loose — it belongs inside the dashboard box.
3. **Perspective Plan was missing entirely.** It is the statutory artefact and the actual
   differentiator.
4. The DB → Officer arrow should be one-way *in*. The only arrow out of him is
   Perspective Plan → portal.

---

## Q4. "I think you have it wrong — can a district officer even submit to PM-AJAY?"

Utsav's challenge, verbatim:

> *"you tell me whether it was written somewhere in their PS or something that they have to
> make this for the District Officer or State officer? cause I think that they did this
> themselves... I don't think that it's the correct hierarchy and the officers from the
> district can't submit the data to the PM-AJAY — fact check these things, that's why an MIS
> Report is made."*

**He was right. The earlier arrow skipped the State.**

### The chain, verbatim from Ch.3 ¶9

| # | Who does what | By when |
|---|---|---|
| 1 | Ministry communicates **notional allocation** to States/UTs | 1st week April |
| 2 | Update physical & financial progress on the portal | 1st week April |
| 3 | **DL-PACC** appraises district projects → *"submission of the same to **State** through web portal"* | 1st week April |
| 4 | **SL-PACC** appraises district + state projects, *"**prioritization** of uploaded projects"* | **15 April** |
| 5 | **States/UTs forward** approved projects *"for consideration of the **Ministry** on the portal"* | **21 April** |
| 6 | **PACC in DoSJE** (the Ministry) appraises | 1st week May |
| 7 | Minutes of the PACC meeting uploaded to the PM-AJAY portal | 15 May |

District → State → Ministry. Four dates. One portal.

### Did the other team invent their levels? No — their PS names them

Their PS (25152, *Digital Mechanism for Beneficiary Identification under GIA*) states the
problem as: *"weak data sharing between **State and Central** systems."* State and Central are
in their problem text, which is why they drew three dashboards.

**Ours names it too**, differently. PS 26097 Basic Issues:

- *"Lack of proper road map and Planning of the **Perspective plans** from execution to
  implementation"*
- *"**Coordination Issues among the corporation, Ministry/Departments**"*

A Perspective Plan is a District→State→Ministry object. Coordination among
Ministry/Departments is multi-level by definition. **Neither Basic Issue can be answered from
a district-only screen.**

So: State and Central belong on the chart, justified by our own PS.

### The revised chart

```
                    PM-AJAY Portal (single centralized MIS, Ch.5 ¶b)
                              │
  District Officer  ──▶  State Officer  ──▶  Central PACC
   (DL-PACC)              (SL-PACC)          (DoSJE)
        │                     │                   │
  District Dashboard    State Dashboard     Ministry View
   ├ Reach & Women %     ├ Rank Districts    ├ Appraise Plans
   ├ Joined vs Placed    ├ Approve Plans     ├ Upload Minutes
   ├ Trade Spread        └ Forward to        └ Release Allocation
   ├ Data Honesty          Ministry
   └ Convergence Report
        │                     │                   │
   Perspective Plan  ──▶  prioritised  ──▶   approved
     by 1st wk Apr        by 15 Apr          by 1st wk May
```

**"Rank Districts"** is the State's own mandated verb — *"prioritization of uploaded
projects."* Nobody else will have that word, because it takes reading page 26.

The four dates along the bottom are the differentiator. Other teams have arrows; we would
have a statutory calendar.

### Two things deliberately not copied

1. **No "Data Sync via API" between levels.** The guidelines specify *"a **centralized** MIS
   portal... linked to the various dashboards of Government."* One portal, three role-scoped
   views. An API sync between our own levels invents a problem the scheme already solved.
2. **Not MongoDB.** Postgres + RLS is how one database yields three scoped views. Draw the DB
   once, not per level.

### Honesty marker

`init.sql:371` today reads *"Nobody sees the country."* The State and Central views do not
exist in code. With 2–3 months of build time that is fine, but they must be shaded as
**planned** on the slide. A jury that sees us distinguishing built from planned trusts the
built part more.

---

## Q5. "GIA Component — what's this? Is this a govt portal?"

**No. GIA = Grants-in-aid.** It is one of PM-AJAY's three components, not a portal.

Guidelines ¶3, *Scheme Components*:

| Component | Chapter | What |
|---|---|---|
| a. Adarsh Gram | 2 | develop SC-dominated villages |
| **b. Grants-in-aid (GIA)** | **3** | **District/State-level projects for socio-economic betterment of SCs** |
| c. Hostels | 4 | hostels in NIRF-ranked and government-funded institutions |

GIA funds **Comprehensive Livelihood Projects**, defined as:

- **Skill Development** — *"as per norms prescribed by the Ministry of Skill Development &
  Entrepreneurship"* (this is why NSQF alignment is not optional for us)
- **Asset grant** — *"upto Rs.50,000/- or 50% of the project cost, whichever is less... in
  case loan is taken by the beneficiary"*
- **Infrastructure** related to the project

Plus the constraint: *"There shall be no standalone individual asset distribution under the
scheme."* Projects must combine two or more of the above — *"an end-to-end solution for their
economic empowerment."*

**Our problem statement is GIA, Chapter 3.** The ₹50,000 line our engine already speaks
(`ai/engine/recommend.py`) comes from here.

### The five Basic Issues are deliverables

Already tracked in the repo as requirement **R9, status PARTIAL**
(`supabase/functions/_core/index.ts`).

| Basic Issue | Our answer | Built? |
|---|---|---|
| **BI-1** Roadmap & planning of Perspective Plans | `perspective_plan` + deadline counter | yes |
| **BI-2** Participants trained, and financial consultants | financial literacy in every course (Ch.3 ¶7A.a.iv) + ₹50k asset-grant flag | yes |
| **BI-3** Job placement after the skilling programme | `outcome` table, updated from the mobiliser's call list | yes |
| **BI-4** Coordination among corporation / Ministry / Departments | District → State → Ministry chain + Convergence Report | **partial** |
| **BI-5** Inadequate technical and support team at ground level | assisted mode (CSC VLE / VLCC) | yes |

**BI-4 is the justification for the State and Central dashboards, and it is in our own PS.**
When a judge asks why we have three levels, the answer is not "another team did it" — it is
*"Basic Issue 4, and the Ch.3 ¶9 calendar."*

One more thread in BI-4: it names **"the corporation"** — the SC Finance & Development
Corporations, the state bodies that actually issue livelihood loans. The ₹50,000 asset grant
is payable *"in case loan is taken"*, and the corporation is who gives that loan. That is a
coordination seam worth one line on the State dashboard, and one nobody else is likely to
notice.

---

## Q6. "So the flow is User → Database → District Officer → report → State Officer → report → PM-AJAY portal?"

Right shape. Two corrections.

### The two "some kind of report" boxes have statutory names

| Hop | Artefact | Who approves |
|---|---|---|
| District → State | **Perspective Plan** (district projects) | DL-PACC |
| State → Ministry | **Prioritised project list** | SL-PACC |

The second is the first one, ranked. The State does not author a new document — its mandated
verb is *"prioritization of uploaded projects."*

### It is one object with a status, not two reports

The schema already encodes the whole chain in one column (`init.sql:269`):

```sql
status in ('DRAFT','DL_PACC_SUBMITTED','SL_PACC_APPROVED','PACC_APPRAISED')
```

Four values, four hops. Do not build report-generation twice. One `perspective_plan` row whose
status advances. That column is the single source of truth for where any district sits in the
calendar.

```
Beneficiary
    ▼
Database  ◀── every interview lands here
    ▼
District Officer (DL-PACC)
    │  reads: dashboard + district_demand
    │  writes: Perspective Plan           status → DL_PACC_SUBMITTED   1st wk Apr
    ▼
State Officer (SL-PACC)
    │  reads: all district plans in the state
    │  writes: priority ranking           status → SL_PACC_APPROVED    15 Apr
    ▼
PM-AJAY Portal  (Ministry PACC)
       forwarded 21 Apr · appraised 1st wk May
       status → PACC_APPRAISED  ← we display it, we do not set it
```

Same database throughout. No re-storing, no API sync between levels.

**We do not build the Ministry screen.** The third box is the portal, greyed, as the terminus.
`PACC_APPRAISED` is the one status that comes *back* to us from outside.

### Basic Issue mapping for the diagram

- **BI-1, BI-2, BI-3** → the data (plan, financial literacy, placement outcomes) = District Dashboard
- **BI-4** → the transfer between bodies = the two arrows above
- **BI-5** → assisted mode at ground level

All five Basic Issues, one diagram.

---

## Q7. Converting the reference chart — what actually changes

Asked against the other team's full slide. The skeleton holds; the box *contents* swap, plus
three structural deletes.

### Swap table, by slot position

| Their box | Ours |
|---|---|
| District Dashboard | **District Dashboard** (keep) |
| ├ Beneficiary Verification Status | ├ **Reach & Women %** |
| ├ Fund Allocation Tracking | ├ **Joined vs Placed** |
| └ Project Progress Reports | ├ **Trade Spread** |
| — | ├ **Data Honesty** |
| — | └ **Convergence Report** |
| MIS Report Generation | **Perspective Plan** — ├ Trade-wise Demand · ├ Gap Counts · └ 3.5–4× Cost Ask |
| State Dashboard | **State Dashboard** (keep) |
| MIS Verification | **Rank Districts** |
| Track: Fund Utilization | **District Ranking** |
| Track: Beneficiary Progress | **Statewide Gap Counts** |
| Track: Scheme Impact | **Total Cost Ask** |
| Verified MIS Data | **Prioritised Plan** |
| Central PM-AJAY Team | **PM-AJAY Portal** (greyed — terminus, not ours) |

### Three structural deletes

1. **MongoDB icon.** We are on Postgres, already drawn once. Do not draw the database twice.
2. **"Data Sync via API" arrow.** The guidelines specify *"a **centralized** MIS portal."* One
   portal, three role-scoped views. A sync between our own levels invents a solved problem.
3. **"MIS Verification → Verified MIS Data" as two steps.** Collapse to one. The State does not
   verify, it **ranks**.

### Add the dates to the arrows

```
District Dashboard ──Perspective Plan──▶ State Dashboard
                     status: DL_PACC_SUBMITTED
                     1st week April

State Dashboard ──Prioritised Plan──▶ PM-AJAY Portal
                  status: SL_PACC_APPROVED
                  15 April → forwarded 21 April
```

Their chart has arrows. Ours would have a statutory calendar.

### One difference that is not just a label

Their flow is District Dashboard → *generates* MIS Report → State. Ours is District Dashboard
→ *advances the status on* the Perspective Plan → State. Same arrow, but it is one row changing
state, not a new document each hop.

### Left half of their chart — dropped

Field Officer, geo-tagged proof, Aadhaar/SECC/State-UT verification, Final Approval. That is
beneficiary *identification* — their PS (25152), not ours (26097). Our left half is the voice
interview.

---

## Open items out of this session

- Write the three-level chain and the four dates into the flowchart, State and Central shaded
  as planned.
- Decide whether `district_demand` should also feed a State-level rollup view, or whether the
  State view reads the same table under a widened RLS policy.
- The "corporation" (SC Finance & Development Corporation) appears in BI-4 and nowhere in our
  schema. Either model the loan linkage or state plainly that we stop at flagging eligibility.
