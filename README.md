# rubix-cube-097

SIH 2026 · PS 26097 — AI-Driven Voice Assistant for Livelihood Mapping and NSQF-Aligned
Skilling Recommendations for SC Communities under the GIA component of **PM-AJAY**.
Ministry of Social Justice and Empowerment. Theme: Agriculture, FoodTech & Rural Development.

A beneficiary picks up a phone and talks, in their own language, for four minutes. Out
comes a qualification they are **actually eligible for** under NSQF, the gap if they are
not yet, a livelihood pathway that fits their family trade and their district — and a line
in that district's Annual Action Plan.

| Doc | What |
|---|---|
| `docs/Utsav/research/03-verdict.md` | **Read first.** What industry this is, what they want, which surfaces to build, scope in/out, hard parts ranked |
| `docs/PROBLEM-STATEMENT.md` | The portal text, verbatim, plus the 9 requirements it binds us to and the five "Basic Issues" decoded |
| `docs/Utsav/research/01-the-customer.md` | MoSJE, PM-AJAY GIA from its own guidelines, the committee chain, the CAG evidence, NSQF/NQR, the beneficiary, DPDP. Every claim cited |
| `docs/Utsav/research/02-tech-landscape.md` | Speech in/out, the conversation engine, the data layer, the recommender, the channels, the SIA problem. Ends in a recommended stack |
| `docs/decisions.md` | What's settled and why |
| `docs/references/` | Primary sources: the PM-AJAY guidelines (May 2023 operative, Feb 2022 superseded) and the NSQF gazette |

## The three facts that shape everything

1. **The guidelines already require this system.** PM-AJAY Ch.3 ¶7A.a.v.c: *"Identification
   of beneficiaries should be carried carefully after assessing the interest of the candidates
   in the skill proposed to be imparted."* The prescribed instrument is a publicity campaign.
2. **Commercial ASR does not work here.** Google STT scores **59.9 WER** on dialectal
   telephone Hindi; the best open model scores 26.8. Bhojpuri, Rajasthani, Chhattisgarhi and
   Magahi — ~11 crore speakers — have **no ASR model at all**.
3. **The failure is audited.** CAG 2025 on PMKVY: **41%** placement against a mandated 70%,
   **40% of certifications in 10 job-roles**, **90% of "Green Jobs" in "Safai Karmchari"**.
   MSDE's own diagnosis: job-roles selected *"without any skill-gap analysis and assessment
   of market demand"*.

## Layout

| Folder | What | Owner |
|---|---|---|
| `channels/` | Thin transports: inbound IVR, WhatsApp Cloud API, offline Android kiosk, assisted mode. No business logic lives here | web dev |
| `web/site/` | District PIU / DL-PACC console — demand aggregation, consent register, AAP input | web dev |
| `web/api/` | Sessions, consent, beneficiary records, exports | web dev |
| `ai/` | Interview FSM · field extraction · eligibility gate · recommender. Its own service, its own deploy unit | AI/ML |
| `research/` | Experiments that decide what `ai/` ships. Never imported | AI/ML |
| `samples/` | Audio fixtures and the dialect test set. Raw audio gitignored, manifest committed | everyone |
| `docs/` | Spec, research, decisions | everyone |

`channels/` and `web/` call `ai/` over HTTP. Do not import across that line, and do not put
a copy of the seven questions in any channel — there is exactly one FSM.

## Status

Scoping. Nothing built yet.
