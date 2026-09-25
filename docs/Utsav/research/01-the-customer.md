# The customer — MoSJE, and behind MoSJE, a District Collector with no staff

Research pass, 2026-09-25. Sibling file: `02-tech-landscape.md` (how you'd build it).

> **Sourcing note — and a correction.** This file was first written against the
> **February 2022** PM-AJAY guidelines pulled from `socialjustice.gov.in`. The **Revised May
> 2023** guidelines were then found; both were diffed. **The May 2023 revision is the operative document and the
> one the problem statement is written against** — see §2.4. Every quotation below has been
> re-checked against it; where the two differ, the change is called out. Both PDFs are in
> `docs/references/`.
>
> Also read in full: **CAG Performance Audit Report No. 20 of 2025 on PMKVY** and the
> **NSQF Gazette Notification of 6 June 2023**. `pmajay.dosje.gov.in` served its TLS chain
> incompletely (`unable to get local issuer certificate`) and PIB returns 403 to automated
> fetch — items depending on those are marked. Everything unconfirmed is marked **UNVERIFIED**.

---

## 1. The ministry, and why it is not the ministry you'd expect

- **Ministry of Social Justice and Empowerment (MoSJE)**, **Department of Social Justice
  and Empowerment (DoSJE)**. Not MSDE. Not MoRD. A welfare ministry running a skilling
  programme.
- That is the whole tension. MSDE owns the skilling machinery — NCVET, NSQF, the NQR, the
  Sector Skill Councils, Common Cost Norms, Skill India Digital Hub. MoSJE owns the
  **beneficiary** and the **money**, and has to buy the machinery from a ministry it does
  not control. Read the guidelines and you can watch this happen: PM-AJAY's skilling clauses
  are almost entirely *references to MSDE's rules*.
- MoSJE's own skilling scheme, **PM-DAKSH**, runs in parallel (§6). The PM-AJAY guidelines
  explicitly forbid overlap with it. One ministry, two skilling schemes, an explicit
  non-duplication clause between them — that is the coordination problem the PS's fourth
  "Basic Issue" is naming.

## 2. PM-AJAY — the scheme, from its own guidelines

**Origin.** Three earlier schemes — **SCA to SCSP**, **Babu Jagjivan Ram Chhatrawas Yojana
(BJRCY)** and **Pradhan Mantri Adarsh Gram Yojana (PMAGY)** — were *"merged into one scheme,
namely Pradhan Mantri Anusuchit Jaati Abhyuday Yojana (PM-AJAY), from 2021-22 for better
convergence of public money and optimal utilization of resources"* (Ch.1 ¶1f).
[Guidelines PDF](https://socialjustice.gov.in/writereaddata/UploadFile/31121740857806.pdf)

**Objectives** (Ch.1 ¶2a, first and most important): *"Reduce poverty of the SC communities
by generation of additional employment opportunities through skill development, income
generating schemes and other initiatives."*

**Three components and the money split** (Ch.1 ¶¶3-4):

| Component | Share of total allocation |
|---|---|
| Adarsh Gram (SC-dominated village development) | **up to 50%** |
| Administration, Monitoring & Evaluation (TSG + PIUs) | **up to 5%** (1% Centre, 4% States) |
| Construction/Repair of Hostels not covered by States | **up to 2%** |
| **Grants-in-aid (GIA) for District/State projects** | **the balance** |

**100% Centrally funded** (Ch.1 ¶5a). States may add their own money; they are not required to.

**GIA's inter-State split** (Ch.3 ¶6) is formulaic: 50% by SC population share, 50% by
*weighted* SC population where the weight is `(State SCSP allocation ÷ State Annual Plan) ÷
(SC population ÷ total population)`. Implemented in **28 States/UTs**. 2% of the component is
earmarked for NE States that run an SCSP.

**Scale.** ₹2,140 crore allocated to PM-AJAY in **2025-26**
([IMPRI](https://www.impriindia.com/insights/policy-update/ministry-of-social-justice-and-empowerment-mosje-schemes-budget-allocation-and-beneficiary-coverage-2026/)).
Cumulatively, **₹7,142.692 crore released under the GIA component**, reported as having
*"benefited 34.61 lakh people through skill development, livelihood promotion, income-generating
projects and other interventions"*; 16,022 villages declared Adarsh Gram, ₹11,186 crore released
across all three components since 2014-15
([ommcom/PIB-sourced](https://ommcomnews.com/india-news/pm-ajay-benefits-over-47-5-lakh-people-transforms-16759-villages-govt/),
[tmv](https://tmv.in/article/16022-villages-declared-adarsh-gram-under-pm-ajay-rs-11186-crore-released)).
**UNVERIFIED — how many of the 34.61 lakh were *skill-trained* as opposed to given an asset
or benefiting from infrastructure.** The ministry does not appear to publish the split. Do
not put a "lakh trained" number on a slide.

### 2.1 The GIA skilling clauses, which are the actual spec

Chapter 3 is where SIH26097 lives. The binding text:

- **Floor on skilling:** *"At least **10%** of the SCA released in a year has to be utilized
  for skill development programmes"* (Ch.3 ¶7A.a.i).
- **Need assessment is already mandatory and already failing:** the same clause continues —
  *"The quantum of skill development training need to be carried out should be based on a
  **real need assessment** of such skilling and only when the entire framework for such skilling
  in terms of the requirements of implementation agency, **selection of beneficiaries**,
  monitoring and financial outlays required to achieve the outputs and outcomes indicated are
  worked out."*
- **Non-duplication with PM-DAKSH, in the guidelines themselves:** *"only those components or
  the beneficiaries which are not covered under the Scheme of PM-DAKSH should be considered."*
- **Four training categories with fixed durations** (Ch.3 ¶7A.a.ii) — this is the enum a
  recommender must emit:

  | Category | Duration per guidelines |
  |---|---|
  | Up-skilling / **RPL** | 32-80 hours, spaced over up to one month |
  | **Short Term Courses** (focus on women and self-employment) | 200-600 hours, up to 5 months, *"or as stipulated in National Occupational Standards (NOS) and Qualification Packs (QPs)"* |
  | **Entrepreneurial Development Programme (EDP)** | normally 80 hours (10 days) |
  | **Long Term Courses** (for those educated to 10th class or more) | 6 months to 1 year |

- **NSQF compliance is mandatory, by name:** *"All Training Partners must ensure compliance of
  **National Skill Qualification Framework (NSQF)** for the courses imparted & pursuance of
  **Common Norms** issued by MSDE"* (Ch.3 ¶7A.a.iv.b).
- **The skill-gap clause:** *"The **Skill Gap Analysis report of National Skill Development
  Corporation (NSDC)** shall be factored while proposing the skilling areas/job roles… The same
  are to be duly endorsed by relevant **District Skilling Authority** or authorized functionary
  of State Skill Development Mission, confirming that the proposals are relevant to the
  District/State, **in terms of aspiration of the target group and availability of job market**"*
  (Ch.3 ¶7A.a.iv.a).
- **Financial literacy is compulsory in every course:** *"All training programmes must
  necessarily have a component of financial literacy and preparation of basic project proposal
  to enable linkage with Banks for assistance to start a self-employment venture."*
  That clause is the PS's second Basic Issue ("trained and skilled Financial consultants").
- **Targeted outcome: 70%.** STT, EDP and LTT each carry *"overall placement of the trained
  persons should be **70%** in wage/self-employment"*; for LTT, *"at least 70% of those employed
  being in wage employment"* (Ch.3 ¶7A.a.vi.b). Hold that number against §5.
- **Asset grant ceiling:** *"financial assistance **upto Rs.50,000/- or 50% of the project
  cost, whichever is less**, would be provided to such SC beneficiary/household, **in case loan
  is taken** by the beneficiary for such acquisition/creation of assets"*, and *"There shall be
  **no standalone individual asset distribution** under the scheme"* (2023, Ch.3 ¶2a.ii).
  ⚠ **Changed in 2023.** 2022 said *"50% of the **asset** cost"* and *"towards loans taken"*;
  2023 says *"50% of the **project** cost"* and extends it to **groups**. Different denominator,
  different ceiling in practice.
- **Eligibility:** *"There will be no fixed income limits… However, it shall be ensured that
  while selecting beneficiaries, **priority is accorded to the families/persons having annual
  income not more than Rs. 2.50 lakh per annum**. **SC members of SC majority group** will also
  be eligible"* (2023, Ch.3 ¶3a).
  ⚠ **Changed in 2023.** 2022 read *"SHGs having SC majority members will also be eligible"* —
  the unit of eligibility moved from **the SHG** to **the SC individual inside it**. That matters
  to us: the interview enrols a person, not a group.
- **Women:** *"**At least 15%** of the total Grants released to the States/UTs will be utilized
  exclusively on viable income generating economic development schemes/programmes for SC women"*
  and *"participation of **at least 30% women candidates** may be ensured in the skill development
  programmes"* (2023, Ch.3 ¶4a, ¶4d).
  ⚠ **Changed in 2023.** The Feb 2022 text read *"Up to 15%"* — a ceiling. The revision made it
  a **floor**. If a pitch quotes "up to 15%", it is quoting a superseded document.
- **Infrastructure ceiling:** up to **30%** of Central Assistance released in a year
  (2023, Ch.3 ¶4c). Unchanged.

### 2.2 The sentence the entire problem statement is built on

Chapter 3, ¶7A.a.v.c, on selection of beneficiary trainees:

> *"**Identification of beneficiaries should be carried carefully after assessing the interest
> of the candidates in the skill proposed to be imparted.**"*

And ¶7A.a.v.a, on how they are found today:

> *"Mobilization of the candidates will be done through various means of **publicity** by the
> State and/or District Administration."*

The law already requires interest-assessment. The only prescribed mechanism for it is a
**publicity campaign followed by a Selection Committee meeting**. SIH26097 is asking for the
instrument that clause has never had.

### 2.3 What projects are even allowed — Annexure I

Annexure I ("Illustrative list of projects under various domains") is the closed-ish world a
recommendation must stay inside. Ten domains: **Agriculture & Soil Conservation** (incl. honey
bee keeping, sericulture), **Horticulture**, **Minor Irrigation**, **Animal Husbandry** (milch
cattle, poultry, goat/sheep, pigs & duck), **Fisheries**, **Food Processing**, **Forestry,
Ecology and Environment**, **Handicrafts and Handlooms**, **Industry, Service and Business (ISB)**
— 21 sub-items from leather and carpentry through beauty parlour, plumbing, auto repair, IT/ITeS,
media, healthcare, banking — and **Cooperatives**.

Annexure I is **unchanged between the 2022 and 2023 revisions**. Note what that list *is*:
a rural, largely self-employment, largely traditional-trade catalogue.
It maps far better onto a beneficiary's *existing family occupation* than onto the
"Domestic Data Entry Operator / Telecom Customer Care Executive" roles PMKVY actually delivered
(§5). **The scheme's own annexure disagrees with the national skilling system's revealed
behaviour**, and our recommender sits between them.

### 2.4 The May 2023 revision, and the phrase the PS lifted out of it

**This is the most important structural fact in the file, and it is why the version matters.**

The February 2022 guidelines contain the words *"Perspective Plan"* **zero times**. The
May 2023 revision contains them **seventeen times**. And the problem statement's very first
"Basic Issue under GIA Component" reads:

> *"Lack of proper road map and Planning of **the Perspective plans** from execution to
> implementation"*

That phrase, with that capitalisation, exists in exactly one place: the revised guidelines.
**The PS is written against the May 2023 document.** Anyone pitching against the 2022
version is answering a question that was superseded three years ago.

**What the revision changed (Ch.1 ¶6c):**

> *"Starting from the financial year **2023-24**, the State/UT would submit a **'Perspective
> Plan'** for the entire approved period of the scheme implementation i.e. **upto 2025-26**
> indicating the activities to be carried out along with the activity-wise targets and funds
> requirement for each of the years."*

So the GIA planning artefact stopped being an **annual** action plan and became a **multi-year
Perspective Plan** with annual physical and financial targets, amendable each year via PACC.
Consequences that land directly on us:

| Change | 2022 | 2023 | Why we care |
|---|---|---|---|
| Planning artefact | Annual Action Plan | **Perspective Plan to 2025-26**, amended yearly | Demand data has to be projected forward, not just counted this year |
| Funds projection | **1.5-2×** notional allocation | **about 3.5-4×** notional allocation (Ch.1 ¶6c.vi) | Districts must now over-plan by 4×. They need *more* candidate projects, which is exactly what aggregated interviews generate |
| Hostels | inside the GIA plan | *"shall **not** be a part of the Perspective Plan… separate sub-portal"* (¶6c.iii) | Out of our scope, cleanly |
| District PIU role | monitoring | *"assisting the **identification/designing of projects for the Perspective Plan** under the Grant in Aid component"* (Ch.5 ¶5c.i) | **The PIU's job description now literally includes the thing we are building an input for** |

**And the revision added a hard annual calendar** (Ch.3 ¶9) — the first time the scheme has
one:

| # | Activity | Deadline |
|---|---|---|
| 1 | Ministry communicates notional allocation to States/UTs | **1st week of April** |
| 2 | Physical and financial progress of preceding FY updated on the portal | **by 1st week of April** |
| 3 | **DL-PACC** appraises/approves district projects, submits to State **through the web portal** | **by 1st week of April** |
| 4 | **SL-PACC** appraises, approves and **prioritises** district + state projects | **by 15 April** |
| 5 | State forwards approved projects to the Ministry on the portal | **by 21 April** |
| 6 | **PACC** in DoSJE appraises | **1st week of May** |
| 7 | PACC minutes uploaded to the PM-AJAY web portal | **by 15 May** |

> **Read that as a product requirement.** A District Collector has to produce a prioritised,
> portal-uploadable project list **in the first week of April**, projecting 3.5-4× the money
> they will get, for a multi-year plan. Beneficiary demand data that arrives in July is
> worthless. **Our district report has a deadline, and it is the first week of April.**

**One thing to check before the pitch: the scheme's approved period runs "upto 2025-26",
which has now ended.** **UNVERIFIED — whether PM-AJAY has been extended beyond 2025-26 and
whether a further guidelines revision exists.** Find out; "the scheme you are pitching for
expired" is a bad surprise.

**Also changed, smaller:** PIUs are now to be staffed by *"persons having adequate experience
in need assessment, project design and management, **data analysis and software development**
and management as well as some young professionals having high social consciousness and
**preferably belong to the Scheduled Castes (SCs) category**"* (Ch.5 ¶5c). The hostel head
became *"utilized for **Central Institutions**"* rather than "not covered by the States", and
GIA infrastructure narrowed to *"common utility purposes"*.

---

## 3. Who actually executes — the chain, and where it breaks

From Chapter 5 of the guidelines:

| Body | Chaired by | Meets |
|---|---|---|
| Central Advisory Committee | **Union Minister, SJ&E** | once a year |
| State Advisory Committee | State Minister, SJ&E | once a year |
| **Central PACC** (Project Appraisal cum Convergence Committee) | **Secretary, DoSJE** | once in six months |
| **SL-PACC** | **Principal Secretary, Social Welfare Dept.** | once in six months |
| **DL-PACC** | **District Collector** | once a quarter |
| **VLCC** (Village Level Convergence Committee) | **Sarpanch/Pradhan**, all SC Panchayat members, AWWs, ASHA workers | once a quarter |

**Project Implementation Units (PIUs)** at State and District level and a **Technical Support
Group (TSG)** at the Centre are funded out of the 5% admin head. National technical resource
support is **NIRD&PR, Hyderabad**; at State/District level, **SIRD/ETCs** (Ch.7 ¶1).

**The planning artefact** for GIA is the **Perspective Plan**, *"uploaded in the online portal
for PM-AJAY, namely https://pmajay.dosje.gov.in"* (2023, Ch.1 ¶6c) — see §2.4 for what changed
and the April/May calendar it now runs on. District projects go DL-PACC → SL-PACC (prioritised)
→ PACC. Funds projection must be **about 3.5-4× the notional allocation** so that rejections
don't leave money on the table. (Adarsh Gram still uses an Annual Action Plan; **GIA does not**.)

**Money moves through PFMS/SNA**: Centre → State RBI account → Single Nodal Account **within
21 days**, zero-balance subsidiary accounts for IAs, daily EAT-module updates (Ch.6). Release
is 50% + 50%, the second tranche gated on a UC for ≥50% of the previous year's grant (Ch.3 ¶8).

**Design consequence.** The decision-maker is a **District Collector, quarterly**, working from
a plan uploaded to a portal, spending money that must be certified. Any output our system
produces has to survive that pipeline: it must be *aggregable to a district*, *defensible in a
DL-PACC minute*, and *traceable to a named beneficiary* for the UC. A recommendation that exists
only as a chat message on a beneficiary's phone is invisible to every one of those six committees.

---

## 4. The MIS that already exists, and what it does not do

The guidelines mandate (Ch.5 ¶5b): *"a centralized MIS portal would be in place, to capture the
data on real time basis of each of the component of the scheme. This MIS will have facility to
capture **gap analysis**, plan preparation, evaluation, progress monitoring and provide a
dashboard on a real time basis."*

So: PM-AJAY already has a portal, a dashboard, a TSG, PIUs, and a mandate to do "gap analysis".
What it demonstrably does **not** have is any beneficiary-facing surface — the portal is an
officer's fund-and-project MIS. **UNVERIFIED — the exact module list of `pmajay.dosje.gov.in`**
(the host's TLS chain failed automated fetch; check it by hand on a browser before claiming
anything about it in a pitch, and screenshot what you claim).

This matters for positioning: **we are not replacing the PM-AJAY MIS.** We are the missing
intake layer in front of it, and the Perspective-Plan-input generator behind it.

---

## 5. The evidence that the current system mis-matches people to trades

This is the part to know cold, because it is the only *hard, audited, Government-of-India*
evidence that the PS's premise is true. Source throughout: **CAG Union Government (Civil)
Performance Audit, Ministry of Skill Development and Entrepreneurship, Report No. 20 of 2025 —
PMKVY**
([PDF](https://cag.gov.in/webroot/uploads/download_audit_report/2025/Report-No.-20-of-2025_PA-PMKVY_English-PDF-A-06943abec463479.68516873.pdf)).
PMKVY is not PM-AJAY — but PM-AJAY GIA skilling is executed *through* the same SSDMs, Sector
Skill Councils, NSQF QPs and MSDE Common Norms, so its failure modes are inherited.

**5.1 Placement.** Of **56.14 lakh** candidates certified under STT/Special Projects in **724
job-roles**, **23.18 lakh (41.29%)** were placed, in **498 job-roles** across 35 sectors
(Para 3.6). Against PM-AJAY's own mandated **70%** target. By phase: PMKVY 1.0 **16.74%**,
2.0 **51.08%**, 3.0 **13.47%**.

**5.2 The mismatch, quantified.** ~**40% of all certifications concentrated in just 10
job-roles** (Table 2.1(a)). Top of the list:

| Job-role | Certified | Share |
|---|---|---|
| Self Employed Tailor | 4,52,690 | 8.06% |
| Field Technician Computing & Peripherals | 4,02,782 | 7.17% |
| Retail Sales Associate | 2,38,320 | 4.25% |
| Retail Trainee Associate | 2,18,745 | 3.90% |
| Sewing Machine Operator | 2,09,367 | 3.73% |
| Domestic Data Entry Operator | 1,87,431 | 3.34% |

And within sectors (Table 2.1(b)): **Green Jobs — 90.35% of certifications in a single role,
"Safai Karmchari"**; Management — 67.93% "Unarmed Security Guards"; Healthcare — 67.06%
"General Duty Assistant".

> That first row deserves a pause. In a scheme whose sibling programmes exist to lift SC and
> safai-karamchari households *out of* hereditary sanitation work, the national skilling system's
> single most-delivered "Green Job" was Safai Karmchari. Nine in ten. This is what
> "supply-driven skilling" looks like in a table.

**5.3 The Ministry's own diagnosis.** In a July 2022 communication to NSDC, MSDE *"identified
**selection of job-roles for skilling without any skill-gap analysis and assessment of market
demand** as the primary reason for poor placement"* (Para 2.1.2). CAG's verdict on the system
level: *"there was **no institutionalized mechanism** to align PMKVY interventions with sector
or state-specific skill gaps identified in the NPSDE"* (Para 2.1.1), and the NPSDE *"does not
specify **micro-level skill gaps**, such as the specific job-roles in which these requirements
exist"* (Para 2.1.2).

**Recommendation 1 of the audit**, verbatim: *"Ministry should align its skill trainings with
skill-gaps identified in job-roles across sectors and States in line with market demand."*

**5.4 District-level convergence, which the PS's fourth Basic Issue also names.** PMKVY 3.0
guidelines required District Skill Committees to *"prepare a consolidated database of course
information of all the skill schemes operational in the district, so that **the most suitable
courses may be recommended to the aspiring candidates of the area**"*. CAG found that in
**Assam, Bihar, Jharkhand, Kerala and Odisha** this was *"not undertaken/still in progress"*;
in Odisha the State agency's reason was *"the absence of any fixed office/dedicated staff"*
(Para 2.2.2).

> The database the PS wants us to recommend from was ordered into existence in 2021, by a
> different ministry, and five states never built it. "Inadequate Technical and support team at
> ground level" is not rhetoric.

**5.5 State placement spread** (Table 3.6, CSSM component): Assam **49.0%**, Kerala 27.8%,
Jharkhand 18.2%, UP 17.7%, Maharashtra 12.7%, Odisha 10.7%, Bihar **6.1%**, Rajasthan **0.7%**.
Bihar's stated reason: the prescribed placement strategies — *"mapping of potential employers,
industry requirement, preparation of employment matrix"* — *"was not undertaken"*.

**5.6 Dropout.** ~**19%** of 3.54 million enrolled candidates recorded as dropouts (683,000),
highest in Media & Entertainment 26.5%, IT-ITeS 25.9%, Tourism & Hospitality 24.9%
([Business Today](https://www.businesstoday.in/jobs/story/pmkvy-records-just-7-placement-rate-highlighting-indias-skilling-employment-gap-553443-2026-09-05)).
The same reporting puts the **current PMKVY 4.0 dashboard placement at ~7%** (2,00,224 of 28.5
lakh trained). **Secondary source, dashboard-derived — use the CAG's 41% as the defensible
number and cite the 7% only as "current phase, per the public dashboard".**

---

## 6. PM-DAKSH — the sibling you must not duplicate

- MoSJE's own skilling scheme, running since **2020-21**; portal `pmdaksh.dosje.gov.in` and a
  **PM-DAKSH mobile app on the Play Store, both launched 07.08.2021**
  ([DoSJE](https://socialjustice.gov.in/schemes/100)).
- Target group: **18-45 years**, SC / OBC / EBC / EWS / DNT / sanitation workers incl. waste
  pickers. Courses are **NSQF-aligned**, under MSDE Common Norms. Same four training categories
  as PM-AJAY GIA.
- **Stipend:** ₹1,500/month for SC and Safai Karamchari candidates, ₹1,000/month for OBC/EBC/DNT,
  for non-residential STT and LTT.

**Why this matters to us:** PM-AJAY GIA guidelines say *"only those components or the
beneficiaries which are **not** covered under the Scheme of PM-DAKSH should be considered."*
So a correct recommendation has a **routing step**, not just a ranking step: is this person
better served by PM-DAKSH (national, stipended, app already exists) or by a PM-AJAY GIA
*comprehensive livelihood project* (district-designed, asset-grant-eligible, infrastructure
attached)? It is a three-line rule.

---

## 7. NSQF and the NQR — what "NSQF-aligned" actually means

**NSQF** was re-notified by **NCVET on 6 June 2023**, superseding the 27 December 2013
notification
([gazette](https://www.nqr.gov.in/downloads/pdfs/NSQF_Gazette_Notification.pdf)).

- *"composed of levels 1 (one) to eight (8), comprising of Level-1, Level-2, level-2.5, Level-3,
  Level-3.5, Level-4, Level-4.5, Level-5.0, Level-5.5, Level-6.0, Level-6.5, Level-7.0, and
  Level-8"* (¶5.1.1). **Thirteen actual levels, not eight.** Half-levels exist and appear in the
  NQR as strings like `Level 4.5`.
- Each level is described by **five descriptor domains** (¶5.1.3), verbatim:
  **(i) professional theoretical knowledge, (ii) professional and technical skills/expertise,
  (iii) aptitude, mind-set, soft skills, employment readiness & entrepreneurship skills,
  (iv) broad learning outcomes and (v) level of responsibility.**
- **RPL is first-class** in the framework: *"Recognition of Prior Learning… means assessment and
  certification"* of already-held competence, explicitly aimed at *"those who belong to out of
  school category"* (¶3.x, ¶5).
- **NCrF** (National Credit Framework, approved April 2023) creditises every learning hour and
  ties skilling to the Academic Bank of Credits.

**The entry-requirement table (Annexure) is the eligibility engine, already written for us.**
Extract:

| NSQF level | Minimum education for STT | Experience alternative | Notional hours |
|---|---|---|---|
| 1 | **No formal education** | none | 150-210 |
| 2 | **No formal education** (some QPs may want read/write) | none | 210-270 |
| 2.5 | 9th pass · or 8th pass + 1 yr exp · or **5th pass + 4 yr exp** · or **"Ability to read and write" + 5 yr exp** | — | 240-300 |
| 3 | 10th pass · or 9th pass + 1 yr · or 8th + 2 yr · or **5th pass + 5 yr exp** | — | 270-390 |
| 3.5 | 11th pass · or 10th pass + 1 yr · or 8th + 3 yr | — | 360-420 |
| 4 | 12th pass · or 11th + 1 yr · or 10th + 2 yr | — | 390-480 |

Two things fall straight out of this table:

1. **Levels 1-2 require no formal education at all.** The "low literacy" beneficiary the PS
   describes is not excluded from NSQF — they are excluded from *knowing that*. The framework
   already has a door; nobody has ever read it to them.
2. **Years of relevant experience substitute for schooling at every level from 2.5 up.** A
   beneficiary who says *"I have been doing my father's weaving for twelve years"* has just
   stated an NSQF Level 3 eligibility claim. The interview's "traditional family occupation"
   field is not colour — **it is an eligibility input**, and it is the field a form would have
   thrown away.

**The NQR (National Qualifications Register)**, `nqr.gov.in` — *"the official national public
record of all qualifications aligned to NSQF levels"*, covering all **59 sectors**. The search
page reports **2,814 qualifications**, filterable by *education level, vocational qualification
(CTS/NTC, CITS, ATS, NAC, ITI), years of experience, sector, notional hours, NSQF level,
qualification type, and 115+ awarding bodies*, with a **"Download File"** export.

> **The NQR's filter set is, almost field for field, the PS's seven interview questions.**
> Education level, experience, sector, duration. That is not a coincidence to be admired — it
> is the schema to build against. `02-tech-landscape.md` §3.

**And the known defect in the occupation mapping.** NCVET's own *Report on Mapping of
Qualifications with National Classification of Occupations (NCO) Codes*
([PDF](https://ncvet.gov.in/wp-content/uploads/2025/05/Report-on-Mapping-of-Qualifications-with-NCO-Codes.pdf),
dated 22 August 2023 on the title page, published on the NCVET site in 2025) found, of
**2,157 qualifications** examined:

- *"**156 qualifications** out of 2157 qualifications had been **incorrectly mapped** to the NCO codes"*
- *"**256 qualifications could not be aligned** with any NCO codes"*
- and structurally: *"Some existing NSQF aligned & approved qualifications have not been
  assigned/mapped to any NCO Codes"*, *"Some… have been assigned wrong NCO Codes"*.

That is **~19% of the official occupation→qualification bridge broken or missing**. Any design
that routes "family occupation" → NCO code → QP as a single authoritative hop will be wrong
roughly one time in five, silently. Plan for it.

---

## 8. The beneficiary — who is actually on the other end of the call

- **Scale.** SCs are **16.6% of India's population, ~20.14 crore** (Census 2011). **UNVERIFIED —
  no post-2011 Census figure exists.** Concentration is in exactly the states PM-AJAY funds
  most: West Bengal (~23.6% of state population), UP (~20.7%, and the largest absolute SC
  population in the country).
- **Devices — and the trap.** NSO *Comprehensive Modular Survey: Telecom, 2025*:
  **85.5% of households possess at least one smartphone**; 86.3% have household internet;
  92.7% of rural 15-29-year-olds used the internet in the last three months. But
  **51.6% of rural women aged 15+ do not own a mobile phone**, and rural teledensity is
  **58.8%** against urban **125.3%**
  ([Business Standard on NSO](https://www.business-standard.com/india-news/digital-india-divide-nso-rural-women-mobile-phone-ownership-gap-125052901804_1.html),
  [PIB release page](https://www.pib.gov.in/PressReleasePage.aspx?PRID=2132330) — PIB 403s to
  automated fetch, wording via search indexing).

  **Read those two together.** The *household* has a smartphone. The *SC woman beneficiary* —
  whom the guidelines require to be **at least 30% of every skill programme** and the target of
  a **15% ring-fenced fund** — statistically does not own it. So:

  - "WhatsApp voice note" means **a shared handset**, usually a male relative's. Consent,
    privacy and the honesty of the answers all change on a shared handset.
  - IVR-to-feature-phone is not a nostalgia channel. It is the channel where she can be
    reached on a number that is hers, or called back at a time she chooses.
  - An **assisted mode** — the ASHA worker, the Anganwadi worker, the SC Panchayat member who
    is already the VLCC's Member Secretary — is not a fallback. For a large share of the
    mandated 30%, it is the primary path.

- **Language.** See `docs/PROBLEM-STATEMENT.md` §2 and `02-tech-landscape.md` §1: the scheduled
  languages are covered; the dialects of the SC-heaviest belt are not.
- **Literacy.** The PS says "low literacy". NSQF Levels 1-2 say "No formal education". The
  system must never require reading — including for **consent** and including for the
  **recommendation itself**, which must be speakable.

---

## 9. Operating constraints to design for

**9.1 DPDP — and this one is not a footnote.** The **Digital Personal Data Protection Act,
2023** was fully operationalised when the **DPDP Rules, 2025 were notified on 14 November 2025**
(G.S.R. 846(E))
([PIB PDF](https://static.pib.gov.in/WriteReadData/specificdocs/documents/2025/nov/doc20251117695301.pdf),
[Wikipedia](https://en.wikipedia.org/wiki/Digital_Personal_Data_Protection_Rules,_2025)).

- **Rule 5** governs *"processing by the State or its instrumentalities for a subsidy, benefit,
  service, certificate, licence or permit"*, and requires that such processing *"shall be done
  following the standards specified in **Second Schedule**"*
  ([dpdprules.org/rules/5](https://dpdprules.org/rules/5)). **UNVERIFIED — the verbatim text of
  the Second Schedule** (the page 404s; pull it from the Gazette before quoting it).
  Practically: PM-AJAY delivery is a *legitimate use*, so this is not a consent-or-nothing
  problem — but it **is** a purpose-limitation, security-safeguards and retention problem, and
  the Act applies to the State.
- **Voice is personal data.** The DPDP Act has no separate "sensitive" category, but voice
  patterns are biometric-adjacent and identify the speaker. **Raw audio is the most sensitive
  artefact this system will ever hold**, and it is also the least necessary to keep: once a
  field is transcribed, normalised and confirmed back to the beneficiary, the audio has done
  its job.
- **Rule 10 — verifiable consent for children and persons with disability.** The PS's own
  interview schema collects *"Mobility and physical constraints"*. A beneficiary with a lawful
  guardian triggers a **verifiable guardian consent** obligation, and *"a checkbox declaration
  by the user is not sufficient"*. A voice interview that cheerfully records a disability
  disclosure with no guardian path is non-compliant by construction.
- **Caste.** The system's entire purpose is to serve a caste-defined group, so SC status is in
  the record by definition. Treat the combination of *caste + voice + location + income + phone
  number* as the crown jewels. Any architecture that ships that tuple to a third-party
  inference endpoint should be able to say exactly which endpoint, under what contract, in which
  jurisdiction.

**9.2 Telecom rules.** Outbound automated voice calls in India sit under TRAI's commercial-
communications regime (DLT registration, headers, time-of-day restrictions). Transactional/
service calls from a Government scheme are a different class from promotional ones.
**UNVERIFIED — the exact TRAI treatment of a Government-scheme outbound IVR** under the
TCCCPR. Get this right before promising an outbound-calling product; an inbound toll-free
number is the safe default.

**9.3 Connectivity.** R6 is not decoration. Village-level connectivity is intermittent and
the 5% admin head does not buy data plans. The IVR path uses the voice network, not data — that
is the *reason* the PS names it first.

**9.4 Who owns the data afterwards.** The guidelines route every rupee through PFMS with a
UC trail and every project through DL-PACC minutes. Our records must be exportable into that
world — per-district, per-project, per-beneficiary — or they are a parallel system nobody can
audit, which is exactly the thing CAG writes reports about.

---

## 10. Who consumes the output, and in what form

The PS talks about one user. There are at least five, and four of them are the "Basic Issues".

| Reader | Basis | What they need | Form |
|---|---|---|---|
| **The beneficiary** | PS body | "Which training, where, how long, will it pay, am I eligible, what do I do Monday" | **Spoken**, in their language, ≤60 seconds, repeatable on demand. Never a PDF |
| **The mobiliser** — ASHA/AWW/SC Panchayat member (VLCC) | Guidelines Ch.5 ¶3 | Who in my village to call back, who is nearly eligible, who consented | A call list on a cheap Android phone, offline-capable |
| **District Collector / DL-PACC** | Guidelines Ch.5 ¶2d, quarterly | Aggregate demand by trade, by block; which projects to put in the **Perspective Plan**; whether the 10% skilling floor is met | A **district demand report** that drops into the Perspective Plan format on `pmajay.dosje.gov.in`, **by the first week of April** |
| **SL-PACC / Principal Secretary** | Guidelines Ch.1 ¶6d.iv | Prioritised project list, 1.5-2× notional allocation, women's 15%/30% compliance | Ranked, with counts and money |
| **Convergence partners** — SSDM, DSC, NSFDC/NSKFDC channelising agencies, Training Partners | Guidelines Ch.3 ¶7A.a.iii | "Here are 240 people in your block who want and are eligible for QP `AGR/Q1201`" | Structured export, batch-shaped |

Plus a sixth, implicit and the one that decides whether this survives: **the auditor**.
CAG's PMKVY report exists because placement numbers could not be substantiated. Whatever we
record about a beneficiary's consent, their stated aspiration and the recommendation we gave
them must still make sense to someone reading it in 2030.

---

## Bottom line for the build

1. **The recommendation's job is to break a concentration, not to be clever.** 40% of national
   skilling went into 10 job-roles; 90% of "Green Jobs" went into Safai Karmchari. If our
   system's outputs across a district look like that distribution, we have automated the
   failure. Measure and show *spread*, not just relevance.
2. **Eligibility is a hard gate and it is already written down.** NSQF entry requirements are
   a published table (§7). Rank only inside what the person is actually eligible for; a
   recommendation they cannot enrol in is worse than none.
3. **"Traditional family occupation" is an eligibility field, not a biography question.**
   Years of relevant experience substitute for schooling from NSQF 2.5 up, and RPL exists
   precisely for informally-acquired competence. This is the single highest-value inference
   in the whole interview.
4. **Route to PM-DAKSH when PM-DAKSH is the right answer.** The guidelines require it; three
   lines of code; instant credibility with a DoSJE jury that owns both schemes.
5. **Build the officer half.** Four of five "Basic Issues" are administrative. A district demand
   report that feeds the **Perspective Plan** is the difference between a demo and a scheme
   intervention.
6. **The interview must be resumable and it must end in confirmation.** Calls drop, handsets are
   shared, and a wrong "12th pass" silently changes the eligible QP set. Read the profile back
   and get a spoken yes.
7. **Keep the transcript, drop the audio.** Least data that discharges the purpose, and the
   cleanest thing to say to a DPDP question.
8. **Assume the ground-level team is the system.** "Inadequate Technical and support team at
   ground level" is the ministry telling us there is no one to operate a complicated product.
   Every screen we add is a screen someone must be trained on out of a 5% admin budget.
