# SIH26097 — the problem statement, verbatim

Pulled 2026-09-25. This file is the ground truth. Nothing in this repo may contradict
it. If the portal changes, re-pull and note the diff.

| Field | Value |
|---|---|
| Problem Statement ID | **26097** |
| Title | **AI-Driven voice Assistant for livelihood Mapping and NSQF-Aligned Skilling Recommendations for SC Communities under GIA component of PM-AJAY** |
| Organization | Ministry of Social Justice and Empowerment (MoSJE) |
| Department | Department of Social Justice and Empowerment |
| Category | Software |
| Theme | Agriculture, FoodTech & Rural Development |
| Youtube Link | **UNVERIFIED** — `sih.gov.in/sih2026PS` paginates and the fetch truncated at 26025 |
| Dataset Link | **UNVERIFIED** — same reason |
| Idea submissions | **UNVERIFIED** |

> Re-pull those three fields by hand before the deck is written. For PS 26154 the
> "Youtube Link" field turned out to carry the entire brief; do not assume it is empty
> here just because we could not read it.

## The one thing to notice in the metadata

The theme is **Agriculture, FoodTech & Rural Development** — not "Smart Education",
not "MedTech", not "Miscellaneous". MoSJE could have filed this under education or
social welfare. They filed it under *rural development*, and the detailed description
repeats "**local**" five times: local dialects, local market demand, local economic
realities, region-specific employment, "in and around the beneficiary".

The framing is not "recommend a course". It is **"map a livelihood where the person
already stands"**. See `docs/Utsav/research/03-verdict.md` §1.

## Description (verbatim)

> • **Background**
>
> • The Pradhan Mantri Anusuchit Jaati Abhyuday Yojana (PM-AJAY) aims to reduce poverty
> among Scheduled Caste (SC) communities through livelihood promotion, skill development,
> and enterprise support under its Grant-in-Aid (GIA) component. A major challenge in
> implementation is the identification of appropriate skill training pathways that align
> with both the aspirations of beneficiaries and the actual livelihood opportunities
> available in their local regions.
>
> • Many target beneficiaries face barriers such as low digital literacy, limited awareness
> of modern trades, language constraints, and difficulty navigating text-heavy digital
> systems. As a result, there is often a mismatch between enrolled training programs and
> the beneficiary's interests, capabilities, or local market demand, leading to high
> dropout rates and poor post-training employment outcomes.
>
> • To improve inclusion and effectiveness, there is a need for an AI-enabled conversational
> system that can interact naturally in regional languages and dialects, understand
> beneficiary aspirations, assess skill gaps, and recommend suitable NSQF aligned livelihood
> opportunities in and around the beneficiary.
>
> • **Basic Issues under GIA Component:**
> • Lack of proper road map and Planning of the Perspective plans from execution to implementation
> • Identification of the participants Trained and skilled Financial consultants
> • Job placement issue after the skilling programme
> • Coordination Issues among the corporation, Ministry/Departments
> • Inadequate Technical and support team at ground level
>
> • **Detailed Description** The proposed solution should be an AI-driven, multilingual,
> voice-based virtual livelihood assistant capable of conducting conversational interviews
> with beneficiaries from aspirational SC communities. Instead of relying on traditional
> form-filling methods, the system should use voice interactions to collect information
> such as:
> • Educational background
> • Existing or traditional family occupations
> • Current livelihood activities
> • Skills and interests
> • Mobility and physical constraints
> • Preference for self-employment or wage employment
> • Local economic realities and opportunities
>
> The assistant should support regional languages and dialects to ensure accessibility for
> users with low literacy or limited digital exposure. The interaction should feel empathetic
> and conversational rather than administrative. The collected information should be analyzed
> using AI/ML based profiling and recommendation mechanisms to identify:
> • Suitable NSQF-aligned training programs
> • Relevant trades and livelihood pathways
> • Skill gaps requiring intervention
> • Region-specific employment or enterprise opportunities
>
> The system should also function effectively in low connectivity and low-tech environments
> through deployment channels such as:
> • IVR-based phone calls for feature phone users
> • WhatsApp voice-note interfaces
> • Lightweight mobile or kiosk-based solutions
>
> • **Expected Solution:**
>
> An AI-powered multilingual voice assistant application designed to help SC beneficiaries
> under PM-AJAY identify suitable skill training and livelihood opportunities. The app will
> support regional languages and local dialects, allowing users to interact through simple
> voice conversations instead of text-based forms.

## What the wording binds us to

Every "should" here is a requirement an evaluator can check. Pulled out so nobody argues
about them later.

| # | Requirement | Where it lands |
|---|---|---|
| R1 | **Voice conversation replaces the form.** "Instead of relying on traditional form-filling methods" | the whole product |
| R2 | **Regional languages *and dialects*.** Stated twice — in the Background and again in the Expected Solution | `ai/asr/` — and see §2 below, this is the hard one |
| R3 | **Seven named interview fields**, verbatim and in order | `ai/interview/` schema. Non-negotiable; an evaluator will count them |
| R4 | **Four named outputs**: NSQF-aligned training programs · trades & livelihood pathways · skill gaps · region-specific employment or enterprise opportunities | `ai/recommend/` |
| R5 | **Three deployment channels named**: IVR for feature phones, WhatsApp voice notes, lightweight mobile or kiosk | `channels/` — plural, not one |
| R6 | **Low-connectivity and low-tech** operation | architecture constraint, not a feature |
| R7 | **Empathetic and conversational, not administrative** | dialogue design. The only subjective requirement, and the one a demo video shows fastest |
| R8 | Expected Solution says "**application**" / "the app" | a mobile/kiosk app *is* required — but it is one of three channels, not the product |
| R9 | The five **"Basic Issues under GIA"** | the officer-side half of the product. See §3 |

### §2 — "dialects" is the load-bearing word

R2 says *languages **and** dialects*. Those are different problems with different answers:

- **Languages**: the 22 scheduled languages. Bhashini and Sarvam both cover these. Solved
  by a vendor call.
- **Dialects**: Bhojpuri (5.05 crore speakers), Rajasthani (2.58 crore), Chhattisgarhi
  (1.62 crore), Magahi (1.27 crore) — all **non-scheduled**, all with **zero coverage**
  in Bhashini, Sarvam or Google STT, and all concentrated in exactly the SC-heavy states
  PM-AJAY targets.

The entire published annotated speech corpus for Awadhi + Bhojpuri + Braj + Magahi
combined is **~18 hours**. Whisper was trained on 680,000. Anyone who says "we support
dialects" because they passed `hi-IN` to an API is lying, and a jury from MoSJE — whose
field staff work in those districts — is the one jury likely to catch it.
Evidence and the honest answer: `docs/Utsav/research/02-tech-landscape.md` §1.

### §3 — the five "Basic Issues" are a second product hiding in the PS

Read them again. Only one of the five is about the beneficiary:

| Basic Issue | Who it is about | What it implies we must build |
|---|---|---|
| "Lack of proper road map and Planning of the Perspective plans from execution to implementation" | **State/District officers** | "Perspective plans" is a term-of-art introduced by the **May 2023** guidelines revision. Aggregate demand from interviews → a **Perspective Plan** input, due 1st week of April |
| "Identification of the participants Trained and skilled Financial consultants" | **Officers** | A verified beneficiary register, and the asset-loan/financial-literacy hook the GIA guidelines mandate |
| "Job placement issue after the skilling programme" | **Beneficiary + officer** | Outcome tracking after training, not just enrolment |
| "Coordination Issues among the corporation, Ministry/Departments" | **Officers** | Convergence — SSDM, NSFDC, NSKFDC, DSC, SC Corporation all appear in the GIA guidelines |
| "Inadequate Technical and support team at ground level" | **Officers** | The assistant *is* the ground-level team. This is the scheme's own statement of why automation |

A submission that ships only the beneficiary voice app answers one bullet in five.
The PM-AJAY guidelines name the exact committees and the exact planning artefact
(the Perspective Plan, uploaded to `pmajay.dosje.gov.in`) that these five bullets
are complaining about — see `01-the-customer.md` §2.

### §4 — what this PS does *not* say

Worth noting because it differs from most SIH statements:

- **No deliverables-for-evaluation list.** No "architecture doc max 2 pages", no
  "demo video max 2 minutes", no slide cap. Do not assume; confirm from the portal.
- **No dataset link confirmed.** Assume we source our own: the NQR export, the PM-AJAY
  guidelines, the NCO-2015 volumes. All public. See `02-tech-landscape.md` §3.
- **No accuracy target, no language list, no scale number.** Every quantitative claim
  in our pitch is one we choose and must therefore be able to defend.
