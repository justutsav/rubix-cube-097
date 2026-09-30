# Challenges and mitigations — SIH 26097

Written 2026-09-29. Every item below is a problem this team actually hit while building
PS 26097, and the thing we did about it. Each one carries an **evidence** line pointing at the
file, commit or measurement that proves it happened, so any of them can be defended if a judge
pushes. Nothing here is hypothetical risk.

Format matches the deck's challenge slide: a challenge, one line of context, four mitigations.
There are **22**, deliberately more than a slide can hold — pick and cut.

---

## If only three go on the slide, use these

| # | Challenge | Why it is the strongest |
|---|---|---|
| **1** | Dialect speech is wrong three words in ten | It is the technical thesis of the whole project, it is measured, and the honest version beats every other team's claim |
| **13** | A recommendation she cannot enrol in manufactures the CAG's 41% | Ties our architecture directly to the scheme's own audited failure |
| **10** | A shared handset would have read one person's answers to another | Nobody else will have thought of it, and it is a disclosure by a State instrumentality |

Runners-up if a fourth is wanted: **11** (nothing says where she lives) or **12** (a third of the
official register is dead courses).

---

## 1. Dialect speech is wrong three words in ten — and we nearly claimed the opposite

Best published error rates: Bhojpuri **27.8**, Chhattisgarhi **27.4**, Magahi **30.4**,
Rajasthani **41.8** WER. An early draft of our own pitch said *"there is no speech model for
Bhojpuri"* — which is false, and Bhashini (funded by the same ministry judging us) carries two
of the four.

| | |
|---|---|
| **Stop transcribing, start classifying.** The unit of the system is a field chosen from a closed set, not a sentence. A 30%-wrong transcript still yields the right answer | **Four-rung ladder, cheapest first:** word list with phonetic match → number patterns → small-model classification into the fixed list → spoken read-back. ~70% of answers never reach the model |
| **Publish the measurement, never the claim.** The slide shows word-error-rate *next to* field accuracy. That gap is the design | **Claim the error rate, never the absence.** Both the decision log and the problem-statement doc carry a dated, signed correction of our own mistake |

> **Evidence:** `docs/decisions.md` (2026-09-25 entry, CORRECTED 2026-09-28) ·
> `docs/Utsav/research/02-tech-landscape.md` §1.2 · ARTPARK-IISc SraVaani-1.0 model card ·
> Vistaar/GramVaani WER table (arXiv:2305.15386).

---

## 2. Fuzzy matching fixes one answer and breaks another

Sound-alike matching is what absorbs dialect. It also decided that **पता ≈ पापड़** and
**नहीं ≈ नवीं** — turning "no" into "9th class" in a field that gates eligibility.

| | |
|---|---|
| **Guard rails found by testing, not by taste:** phonetic matching only for single words of 5+ sounds, close-spelling only at 6+ letters | **A bare "जी" no longer means yes**, and filler words ("का काम") no longer make two different phrases look alike |
| **Every fix is a regression test** in `ai/tests/test_extract.py` — the bug can never come back quietly | **Re-measured after each fix:** answer accuracy on simulated phone audio went 87% → 97% on the same 38 answers |

> **Evidence:** `docs/Prashant/engine/01-engine.md` §3 · `docs/Prashant/ivr/05-measurements.md`
> (three dated runs) · commit `b6cbb1c`.

---

## 3. A transliteration bug made cross-script matching silently useless

The romanizer **dropped every Devanagari vowel**, so `सिलाई` never matched `silai`. The same map
emitted `c` for the letter every transliteration writes `ch`. Nothing crashed; matching just
quietly did less than we thought.

| | |
|---|---|
| **56 assertions in the core self-check** caught it — a silent-degradation bug has no error message, so only an assertion finds it | **The core has no dependencies and no I/O**, so the identical matcher runs in the browser, in Deno and in Node — one behaviour, not three |
| **Three more of the same family found in the same pass:** a closure capturing a stale session and discarding answers, option ids accepted from the wrong state | **A Capacitor plugin proxy returned from an async function** had its `then` called natively — found only because the check ran on the device, not in a tab |

> **Evidence:** commit `4f892d2` (bug list in the message) · `packages/core/test/selfcheck.ts`.

---

## 4. The speech vendor's live API disagreed with its own documentation

Written from the docs, verified against the wire: `saarika` is deprecated for `saaras:v3/v4`,
`bulbul:v2` for `v3`, and — the one that mattered — **the response carries no n-best at all**,
so the ladder's agreement boost could never fire.

| | |
|---|---|
| **Second pass with `language_code=unknown`** to obtain a genuine alternate hypothesis, so the ladder has something to agree with | **Restricted to the four dialects**, because the second pass doubles speech cost and buys nothing where a real model exists |
| **Verify every vendor fact against the live API**, never against memory or a blog post | **A vendor outage must not end an interview:** an empty transcript reads to the flow as a timeout, so the assistant asks again instead of hanging up |

> **Evidence:** commit `7d37573` · commit `b827969` · `docs/Prashant/ivr/05-measurements.md`.

---

## 5. The speech vendor rate-limits, and we found the ceiling rather than guessing it

Back-to-back requests returned **429 Too Many Requests on 50 of 228 answers**, plus six timeouts
over two seconds. On a real district that is a cap on simultaneous calls, not a lab curiosity.

| | |
|---|---|
| **Every one of the 50 fell back to on-device Vosk and the call continued** — the designed behaviour, proven under the failure it was designed for | **Two providers behind one switch:** error or >2 s → Vosk → keypad menu. No path ends in silence |
| **Both providers measured on identical seeded audio**, so the comparison is real: worst line, Vosk 36% WER / 68% answers vs Sarvam 11% / 89% | **The limit is documented as found, with the run table printed**, instead of a vendor SLA we would have to take on trust |

> **Evidence:** `docs/Prashant/ivr/05-measurements.md` (unpaced run table) · commit `b22876e`.

---

## 6. One box handled 25 calls, because speech-to-text ran inside the engine's global lock

Calls queued behind each other's transcription. Ten simultaneous callers were already at
865 ms p95 for a reason that had nothing to do with speech and everything to do with a lock.

| | |
|---|---|
| **Transcribe before taking the store lock.** After the fix, 25 simultaneous calls all finish, p95 silence 843 ms | **A load tool that runs N full interviews from fresh numbers** and counts only calls that reach the result — not calls that connected |
| **The ceiling is stated, not hidden:** ~25 per box with on-box speech. Past 35, turns hit the 1.5 s timeout | **Degradation is graceful:** the caller hears an apology and their progress is saved; cloud speech moves the load off the box entirely |

> **Evidence:** commit `bbd87e1` · `docs/Prashant/ivr/05-measurements.md` (load table).

---

## 7. On a phone call, 1.8 seconds of silence is the whole product

Past roughly two seconds a caller assumes the line is dead. Speech-to-text alone can eat
800 ms of that, and an AI call on the hot path eats the rest.

| | |
|---|---|
| **Every fixed prompt is a pre-rendered file held in memory.** No text-to-speech and no disk read on the hot path — about 80% of turns | **Word list before AI:** ~70% of answers resolve in ~5 ms. The model is budgeted for the uncommon path only |
| **A 300 ms "हम्म…" plays at 700 ms**, so a slow turn still sounds like a person thinking rather than a dropped call | **One region, end to end (Mumbai).** Measured 339–628 ms per turn against the 1,800 ms budget; the deployed speech function answers in 228–322 ms, faster than the laptop |

> **Evidence:** `docs/Prashant/ivr/04-optimization.md` §2 · `05-measurements.md` (latency table) ·
> commit `004b576`.

---

## 8. No voice-detection setting wins both noise and quiet speakers

At 10 dB signal-to-noise, aggressiveness 2 misses speech; aggressiveness 3 catches it and then
loses quiet speakers. There is no value that is right for both a market and a shy 55-year-old.

| | |
|---|---|
| **Tested across 30 / 20 / 15 / 10 dB before choosing**, and confirmed noise alone is never mistaken for an answer | **Kept the setting that protects the quiet speaker**, and let the loud-environment case fall to a nudge and then the keypad |
| **Thresholds are a config knob, not a constant** — they are meant to be retuned on real village recordings, which synthetic noise cannot stand in for | **Shorter waits on noisy lines** were tuned afterwards from real call feedback, not from the lab number |

> **Evidence:** `docs/Prashant/ivr/README.md` progress log (step 4) · commits `61e054e`, `566d6e7`.

---

## 9. We had no village audio, so we built the village line

We could not record in a district. Testing a rural IVR on clean laptop audio would have proved
nothing, and every number from it would have been a lie by omission.

| | |
|---|---|
| **A phone-line simulator in the standard library:** 300–3,400 Hz band limit, G.711 mu-law, noise at a set SNR, 5% lost 20 ms packets | **Reproducible seeds**, so a change is measured against the same degradation every time and an improvement is real |
| **A browser softphone that speaks the real Exotel protocol** — a spoken interview testable with a real mic and no telephony account | **Labelled honestly everywhere:** these are synthetic voices on a simulated line, *not* dialect audio. The measurements file says so in its first paragraph |

> **Evidence:** `channels/ivr/tools/phone_line.py` · commits `b6cbb1c`, `e56bc5f` ·
> `docs/Prashant/ivr/05-measurements.md` (header note) · `docs/decisions.md` (caveat).

---

## 10. A shared handset would have read one person's answers to another

Keying the resume on a phone number meant a brother redialling would hear his sister's
education, income and **mobility/disability disclosure** read back aloud — an unauthorised
disclosure by a State instrumentality — and his answers would write into her record.

| | |
|---|---|
| **The phone number becomes a lookup index, not an identity.** Any number of people share one handset; nulls stay distinct, so a phone-less beneficiary is a valid person | **Resume is forward-only:** it asks the next unanswered question and reveals nothing already given |
| **The PIN gates only the two actions that disclose** — full read-back and the saved recommendation — never entry. A forgotten PIN must not lock somebody out of a welfare line | **The name gate was rejected as insufficient**: a relative can guess a name. Two PIN failures start a new person on the same handset |

> **Evidence:** `docs/Utsav/research/05-technical-spec.md` §9 BLOCKER 1 · commits `b856d68`,
> `e6c4fcd`, `90a4904`.

---

## 11. Nothing in the seven mandated fields says where she lives

The problem statement names seven fields and none is an address. A phone prefix does not resolve
to an Indian district and the national register carries no geography — so the district demand
report, which is our entire officer-side answer, had no `GROUP BY`.

| | |
|---|---|
| **Q0 — village/block, asked before consent** with the language pick, resolved by the same word-list-and-phonetics matcher already built for trades | **Presented as registration metadata, not an eighth question**, so "seven fields, verbatim, in order" stays literally true for an evaluator counting them |
| **A spoken village is taken as stated, with the official code left NULL.** Forcing it into a twelve-block hard-coded list made Q0 never offer its confirmation at all | **Free on kiosk and assisted mode** — the device already knows its own block, so the question is skipped |

> **Evidence:** `docs/Utsav/research/05-technical-spec.md` §9 BLOCKER 3 · commit `2900fef` ·
> `docs/decisions.md` (2026-09-26, Q0 is district-level until the LGD list is imported).

---

## 12. The official register is a third dead courses and a fifth mis-mapped

The national register has **2,814 rows — of which 881 are expired**, 1,198 are valid at the
levels our beneficiaries can enter. Underneath it, the regulator's own audit found **156 of
2,157 qualifications mis-mapped and 256 unmappable**.

| | |
|---|---|
| **"2,814" is never quoted as recommendable.** The number that goes in front of a judge is the number that survives the filters | **Nothing is invented:** fields the official source does not provide are stored NULL. A wrong course code sends a real person to a centre that will not admit her |
| **The snapshot is sha256-pinned and that hash is recorded on every recommendation**, along with the version of the weights that produced it | **Expiry is filtered in the query, not in an index.** Postgres refused `where valid_till >= current_date` (42P17) and was right — such an index rots silently as rows expire past it |

> **Evidence:** commit `0aef648` (register counts) · commit `13fb8fe` (42P17) ·
> `docs/decisions.md` (qualification identifiers are imported, never invented).

---

## 13. A recommendation she cannot enrol in manufactures the CAG's 41%

The audited national picture is 56.14 lakh certified against 23.18 lakh placed. A system that
suggests a course whose entry bar the person does not clear is producing that statistic one call
at a time, politely.

| | |
|---|---|
| **A hard eligibility gate runs before ranking, never as a score** — typed from the NSQF 2023 gazette table, including the schooling↔experience substitutions | **Three buckets, not two:** ELIGIBLE · NEAR-MISS **with the exact gap** ("one more year, or the Level 2 course first") · out. The near-miss *is* the problem statement's "skill gaps requiring intervention" |
| **Experience only counts toward courses in the same trade** as the work she actually did, and levels above 4 are never recommended | **Concentration is priced into the ranking** — at most two courses from one sector, and a spread penalty, because the audit found 40% of national certifications in ten job roles |

> **Evidence:** `docs/Prashant/engine/01-engine.md` §4–5 · `packages/core` eligibility gate ·
> CAG Report No. 20 of 2025, Para 3.6 and Table 2.1(a).

---

## 14. We cited the wrong privacy rule, and the right one is narrower

We had built a guardian-consent branch on DPDP **Rule 10**. Rule 10 is children; **Rule 11** is
persons with disability, and its test is a guardian appointed by a court, a designated authority
or a local level committee. Firing that branch on every mobility disclosure is itself a dignity
failure — most people with a physical constraint retain full capacity.

| | |
|---|---|
| **The branch now asks about decisional capacity**, not about disability, and names the local level committee — which actually sits at district level and is the realistic route | **The raw transcript is erased at confirmation.** Its purpose is discharged, and it is 26–60% wrong anyway: near-zero evidentiary value, total disclosure risk |
| **Two database CHECK constraints make it impossible** to hold a raw transcript against a confirmed answer. The rule is enforced by the schema, not by a policy document | **A privacy test greps the database and logs** for ten-digit numbers, whole or partial PINs and audio columns before any real-user call |

> **Evidence:** `docs/Utsav/research/05-technical-spec.md` §9 MAJOR 4 and MAJOR 5 ·
> commit `a06e45c` (privacy test) · commit `4f892d2` (CHECK constraints).

---

## 15. A vendor key inside an Android APK is one unzip away

The app first called the speech vendor directly. That ships the key to every handset, and sends
caste-adjacent voice to a third party with nothing of ours in between.

| | |
|---|---|
| **Speech is proxied server-side**, the key held as a platform secret. The app never holds a vendor credential | **Only the public key ships in the app**, which is exactly why every table carries a row-level security policy; the privileged key lives on the telephony VM alone |
| **Mixed content turned back off.** It had been allowed only so the WebView could reach localhost in development — and that wire carries a beneficiary's voice | **The hashing pepper is generated once and never rotated casually**, because rotating it orphans every stored phone hash |

> **Evidence:** commits `b827969`, `004b576`, `7d37573` · `docs/DEPLOY.md` (secrets section).

---

## 16. The offline app's outbox was failing twice a batch and saying nothing

It looked idle. It was broken. Three bugs, and the third is why the first two survived so long.

| | |
|---|---|
| **The session was inserted before the beneficiary it points at** — a foreign key, so every batch died on its first row | **The phone-hash column was NOT NULL**, which is wrong for the two channels built precisely for people with no phone: 51.6% of rural women 15+ own none |
| **Both failures printed `[object Object]`.** Database errors arrive as plain objects, so `.message` is undefined and the constraint code — the entire diagnosis — was thrown away | **Errors now keep code, message, details and hint**, a partial apply is treated as a failure instead of a success, and a failing sync no longer looks identical to an idle one |

> **Evidence:** commit `2c5f2af`.

---

## 17. An edge function cannot hold a phone call open

The whole serverless deployment was correct for everything except the one thing that pays for
the channel: a four-minute bidirectional audio stream. Separately, a relative import that
climbed out of the functions directory deployed cleanly and then failed at runtime.

| | |
|---|---|
| **One small always-on VM for telephony**, in an Indian region, because the hot path is 20 ms audio frames and the voice must stay in Indian jurisdiction | **The shared core is vendored in and its import specifiers rewritten** — Deno resolves the literal path while Node wants the other extension. The copy is generated and re-synced on every deploy |
| **The two traps that cost an afternoon are written down:** Ampere capacity is routinely unavailable for days, and the stock Ubuntu image drops every port but SSH regardless of what the cloud console shows | **The request/response pieces stayed serverless.** Only the thing that genuinely needs a long-lived process got a VM |

> **Evidence:** `docs/DEPLOY.md` · commit `b827969`.

---

## 18. A diagram generator cannot review its own diagrams

Our architecture diagrams are generated from the spec so the two cannot drift. But a validator
can prove that text fits inside a box; it cannot see that an arrow points at nothing.

| | |
|---|---|
| **Render the generated file back to SVG** and look at it. It immediately found a connector ending in empty space, which no assertion would have caught | **Boxes are measured from their own text**, so overflow is not representable — and the validator refuses to write the file if any of 41 boxes fails |
| **Arrowheads are explicit paths, not markers**, because a marker that silently fails to render would hide the exact class of bug the tool exists to find | **The review found what a blind pass could not:** the officer read as a fourth beneficiary channel, and had no arrows at all after login |

> **Evidence:** commits `e6c4fcd`, `4027217`, `b856d68`.

---

## 19. The deck carried another problem statement's leftovers

Page 2 was titled **"KALA SETU"** — an artisan/handicraft project's name. Page 6 cited the
Ministry of Textiles, MSME/ONDC catalogue onboarding, e-commerce exports and a paper on SME
digital commerce. None has any connection to NSQF skilling for SC beneficiaries.

| | |
|---|---|
| **A full per-page fact-check against the primary sources**, severity-tagged: blocker / unsupported claim / typo / upgrade | **One hard fact error caught:** 74.6% SC rural was a digit transposition of the Census's **76.4%** |
| **Three phrases banned across all 26 slides:** any claim of a portal API (the word "API" appears zero times in the 46-page guidelines), any dialect claim stated as fluency, and "verified" applied to a beneficiary — we confirm answers, we do not verify identity | **Our strongest source now appears on the page that cites sources.** The 41% figure had been printed without the audit it comes from |

> **Evidence:** `docs/Utsav/deck-fixes.md` (pages 2, 4, 5, 6 and the cross-deck section).

---

## 20. No field access — and the government already shipped something adjacent

We did no surveys and visited no districts. Meanwhile **Skill India Assistant** (MSDE + Meta +
Sarvam, May 2025) is a live multilingual WhatsApp voice assistant that recommends NSQF courses.
Somebody in that room knows this.

| | |
|---|---|
| **One rule for the pitch: nobody claims field work.** Credibility comes from primary documents read in full — the CAG audit, the NSQF gazette, the PM-AJAY guidelines, the national register | **The positioning is rehearsed, not improvised:** SIA is national self-service discovery on a smartphone. This is feature-phone outreach, eligibility gating and district planning for people SIA cannot reach |
| **We route to them rather than around them.** The guidelines forbid overlap with PM-DAKSH by name, so PM-DAKSH routing is a stage in the recommender | **The demo cohort is generated by the real engine**, not hand-written: real profiles through the real ranker over the real catalogue, every row flagged as demo data on screen |

> **Evidence:** `docs/Utsav/research/02-tech-landscape.md` §7.1 · `docs/decisions.md` (route to
> PM-DAKSH and SIA) · `web/app/src/lib/demo.ts` (header comment).

---

## 21. Our own cost figure was wrong on its own terms

An early ₹5.60 per interview was wrong three separate ways, all checkable by a judge: inbound
toll-free bills the *receiver* at a premium, the streaming feature is a paid add-on that was not
in the budget, and the largest cost in the system had been left out entirely.

| | |
|---|---|
| **Missed call → callback on an ordinary number**, not toll-free. The 2025 telecom amendment removes the regulatory reason toll-free was chosen, and saves 45–70% of the telephony leg | **No always-on GPU.** A self-hosted speech model costs ~₹4.29 lakh/year idle; against metered speech the break-even is ~47,700 interviews a month, far past a pilot |
| **Every unverified vendor price carries a ⚠ and may not go on a slide** without a written quote. Indian telecom vendors publish none of these rates | **Rebuilt line by line to ~₹4.15 per interview**, with the split stated — 37% telephony, 63% speech and AI — so the figure can be argued rather than asserted |

> **Evidence:** `docs/Utsav/research/05-technical-spec.md` §9 BLOCKER 2 and MAJOR 1 ·
> `docs/Prashant/ivr/01-master-plan.md` §7 · `04-optimization.md` §4.

---

## 22. One design language cannot serve a beneficiary and an officer

Two full iterations were built and rejected. The first — cream on beige, serif display — is
about 3:1 contrast and disappears in the direct sunlight of a doorstep interview. The second
offered six affordances on a screen where the interview allows exactly one, with 28 px chips in
a 44 px world.

| | |
|---|---|
| **Two registers over one token set**, so the two halves cannot drift into two products: full-bleed one-decision screens for the doorstep, dense tables and charts for the officer | **The beneficiary register holds itself to 7:1 contrast** and ≥56 px targets, specifically for the sunlight and low-vision case |
| **State is never colour alone**, and the two accents are amber and teal — distinguishable under every common form of colour blindness, which green and red are not | **Every beneficiary-facing string carries a prompt id** and a replay control wired to the same audio file the phone channel plays. A string without one fails a lint test |

> **Evidence:** `docs/DESIGN.md` (three iterations, with the ratings and the reasons for rejection).

---

## What is still open, and said out loud

Kept here because a challenge slide that lists only solved problems reads as marketing, and
because a judge who finds one of these unlisted will assume there are others.

| Open item | Current honest position |
|---|---|
| The 30-utterance dialect measurement | The harness exists and is good; real recordings by real speakers do not. Until they do, dialect support is a claim, and we say so |
| Native-speaker prompts | Bhojpuri prompts are drafts read by a placeholder voice, marked DRAFT in the repo |
| The Perspective Plan's real column layout | We emit the district demand lines; nobody has yet opened the portal by hand to confirm the format it expects |
| Live opportunity data | Two or three hand-assembled pilot districts, every row carrying its source and date. No national feed is claimed |
| Outcome tracking | The table and the flow exist; today a human populates it. The follow-up call is designed, not built |

---

*Team RubixCube · SIH 2026 · PS 26097 · Ministry of Social Justice and Empowerment*
