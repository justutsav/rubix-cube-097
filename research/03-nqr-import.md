# Experiment 3 — NQR import

**Question:** does `POST https://www.nqr.gov.in/downloadSummaryFile` actually return
2,814 rows, and what columns survive normalisation?

**Verdict: YES. Reproduced end to end on 2026-09-25.**
2,814 is a real count of real government records, not a placeholder and not a
number somebody typed into a README.

## How it was reproduced

No scraping, no HTML selectors — this is the site's own *Download Summary* button.

```bash
# 1. GET the search page; keep the Laravel session cookie
curl -s -c cj.txt -A "Mozilla/5.0" \
     https://www.nqr.gov.in/qualifications-search -o search.html

# 2. The page carries both the CSRF token and the full id list
#    name="_token" value="..."   ·   name="qualificationids" value="1,2,3,..."
#    -> the id list is 2814 ids long, on the page itself, before any download.

# 3. POST them back with the same cookie jar
curl -s -b cj.txt -A "Mozilla/5.0" \
     -H "Referer: https://www.nqr.gov.in/qualifications-search" \
     --data-urlencode "_token=$TOKEN" \
     --data-urlencode "qualificationids=$IDS" \
     https://www.nqr.gov.in/downloadSummaryFile -o nqr.xlsx
```

| Check | Result |
| --- | --- |
| `qualificationids` on the search page | **2,814 ids** |
| Response | `HTTP 200`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, 670,681 bytes |
| Sheet | title row + header row + **2,814 data rows** |
| Sheet stamp | `Downloaded on: 25-09-2026 17:38:45` |
| `robots.txt` | `User-agent: * / allow: /` |
| `sha256(nqr.xlsx)` | `348bed87072873be2e47cfa2e729f1e430c1a12811231439a45b3346acfbf392` |

Two `curl`s and no auth. There is no rate limit worth engineering around, and
no reason to ever scrape a detail page for the summary fields.

## The 18 columns

```
S No. · Title · Code · Description · Sector Name · Level ·
Maximum Notational Hours · Minimum Notational Hours · Version ·
Originally Approved · Valid Till · Awarding Body · Certifying Bodies ·
Proposed Occupation · Progression Pathway · Qualifcation Type ·      ← sic
Adopted Qualifcation · Training Delivery Hours                        ← sic
```

Two column headers are misspelled in the official export (`Qualifcation`).
Match them verbatim; do not "fix" them in a parser.

Sample row:

```json
{
  "Title": "Line Patrolling Man (Oil  Gas)",
  "Code": "2020/HYC/HSSCI/3770",
  "Sector Name": "Hydrocarbon",
  "Level": "Level 3",
  "Maximum Notational Hours": "330 Hours",
  "Originally Approved": "17 Nov 2022",
  "Valid Till": "16 Nov 2025",
  "Awarding Body": "Hydrocarbon Sector Skill Council (HSSCI)",
  "Proposed Occupation": "Pipeline Maintenance",
  "Progression Pathway": "Senior Line Patrolling Man",
  "Qualifcation Type": "General Qualification",
  "Training Delivery Hours": "{\"Theory\":\"90\",\"Practical\":\"150\",\"EmployabilitySkills\":\"60\",\"OJT_Mandatory\":\"30\"}"
}
```

`Training Delivery Hours` is **JSON inside a spreadsheet cell** — theory /
practical / employability / mandatory OJT. Easy to overlook. It is
the difference between telling a beneficiary "510 hours" and telling her
"~4 months, 150 of them hands-on, 30 in an actual workplace."

## What the corpus actually contains

**2,814 rows · 45 sectors · 85 awarding bodies · 12 NSQF levels.**

As of 2026-09-25: **1,934 currently valid, 880 expired.** Roughly a third of
the register is dead weight — any product that imports all 2,814 and ranks
over them is recommending expired qualifications.

Levels (half-levels are real, `Level 4.5` is not a typo):

| 1 | 2 | 2.5 | 3 | 3.5 | 4 | 4.5 | 5 | 5.5 | 6 | 6.5 | 7 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 14 | 180 | 117 | 557 | 126 | **844** | 264 | 432 | 118 | 149 | 8 | 5 |

Top sectors: IT-ITeS 316 · Electronics & HW 234 · **Persons with Disability
231** · Agriculture 185 · Handicrafts & Carpets 139 · Media & Entertainment 125
· Automotive 120 · Healthcare 117 · Capital Goods 107 · Construction 102.

> **"Persons with Disability" is a sector with 231 qualifications — third
> largest in the register.** The interview asks about disability. Route that answer
> into this sector.

Two code formats coexist, both official:

- legacy `2020/HYC/HSSCI/3770` — year / sector / body / serial
- current `QG-04-ES-00913-2023-V1-SCGJ` — type / level / sector / serial / year / version / body

The level is **embedded in the current code** (`QG-4.5-OR-...`). Any regex that
assumes one format drops the other half of the register.

## Data-quality findings in the official export

Found by validating the file, not by trusting it:

| Finding | Count | Examples |
| --- | --- | --- |
| `Valid Till` **before** `Originally Approved` | 3 | `2022/ME/MESC/05694`, `2022/ME/MESC/05701` (31 Mar 2022 → 30 Mar 2022), `QG-03-AG-00580-2023-V1-FICSI` |
| Minimum hours **>** maximum hours | 7 | `QG-5.5-LS-00251-2025-V2-LSSSDC` (min 1740 > max 570) |
| **Duplicate qualification code** | 1 | `QG-04-ES-00913-2023-V1-SCGJ` is *two different qualifications* — "Junior Technician- Mechanized Sewer Cleaning" (L3) and "Material Recovery Facility (MRF) Micro - Entrepreneur" (L4), same SCGJ, both valid till 30 Aug 2026 |
| Empty `Sector Name` | 4 | `QG-05-ET-01981-2024-V1-MSU` (Vedic Mathematics Trainer), + 3 |
| `Adopted Qualifcation` = `N.A.` | 2,606 | column is ~93% empty; treat as NULL, never render |

**The duplicate code is the one that bites.** A schema of
`qualification_code text not null unique` with an idempotent upsert on that
column silently collapses two distinct government qualifications into one.

Both duplicate rows expired on 30 Aug 2026, so nothing is currently visible —
but the register issues new codes continuously and the constraint is wrong
today. **Key on `(code, title)` or on the NQR page id, not on code alone.**

## What this settles for us

1. **Import the whole register, filter at query time.** 2,814 rows is 670 KB;
   there is no reason to curate it down and lose whole sectors.
2. **Store `Valid Till` and never rank an expired qualification.** 880 of 2,814.
3. **Parse both code formats. Preserve `Level` as the official string**
   (`"Level 4.5"`), numeric only for comparison.
4. **Unique key is not the code.** See above.
5. **Use `Training Delivery Hours`.** Theory/practical/OJT split is in the file
   already and nobody renders it.
6. **Persons with Disability is a live sector with 231 qualifications** — this
   is where our disability question in the interview should actually route.

## The funnel — how many courses can we actually recommend

Computed from the snapshot on 2026-09-25. These are the numbers the recommender works over.

```
2,814   everything NCVET ever approved
1,934   still valid today                      880 expired — never rank these
1,199   valid AND NSQF level <= 4              realistic ceiling for our beneficiary
  ~??   actually runnable in her district      ← WE DO NOT HAVE THIS DATA
    3   spoken back to her
```

By level (valid only): ≤3 → 541 · ≤3.5 → 648 · ≤4 → **1,199** · ≤4.5 → 1,382 · ≤5 → 1,714.
Duration (valid): median 450 h, range 5–4,530 h; **832 are ≤400 h**.

Top sectors in the valid-and-≤4 set: Agriculture 127 · Electronics & HW 101 ·
Handicrafts & Carpets 76 · IT-ITeS 73 · Healthcare 68 · Textile & Handloom 66 ·
**Persons with Disability 65** · Media & Entertainment 56.

### Field quality in that 1,199 — what the ranker can lean on

| Column | Usable | Note |
| --- | --- | --- |
| `Description` | **1,199 / 1,199**, median 312 chars | the retrieval backbone |
| `Training Delivery Hours` | **1,199 / 1,199** JSON | **848 carry mandatory OJT** |
| `Proposed Occupation` | 1,112 | 87 junk (`'----'`, `'...'`, `'- - -'`) |
| `Progression Pathway` | 1,054 | 145 junk — the "what comes after" line |

1,032 distinct `Proposed Occupation` strings across the valid set — uncontrolled free text,
not an enum. Do not key anything on it.

### Two structural gaps this file exposes

1. **NQR has zero geography.** The PS asks for *"region-specific employment or enterprise
   opportunities."* Nothing in these 18 columns is district-aware. The availability gate and
   any local-demand weight need a second source we have not found yet. Open.
2. **"Self-employment" has almost no NQR answer.** Of the 1,199, only **25** are
   entrepreneurship-shaped (`Mushroom Grower (Small Unit)`, `E-commerce Micro Entrepreneur`,
   `Self Employed Tailor`, …). The PS mandates asking wage-vs-self-employment. If she says
   "my own work" and we rank NQR, we recommend wage training and mislabel it — the correct
   move is routing to PM-AJAY GIA's income-generating/asset sub-components instead.

### Limits of this file

The summary export has **no entry/eligibility requirements column.** NSQF
publishes hard entry requirements per level, but they are not in this XLSX —
an eligibility gate built on this file alone can only infer eligibility from
the NSQF *level*, not from a per-qualification stated requirement. Getting the
real requirement needs the detail page (`/qualifications/<id>`) or the NSQF
gazette table. Open question, not yet answered.

### Snapshot

`research/data/nqr/` (gitignored): `nqr.xlsx` (raw, sha256 above),
`nqr.csv`, `nqr_rows.json` (2,814 parsed rows). Re-fetch with the three curls
at the top; the file is stamped with its own download time.
