# Future updates

Things we have decided to do but have not built. Each entry says what, why, and what it costs to
leave undone — so the list can be triaged rather than admired.

---

## Give the LLM more than one source, so it can notice when one of them is wrong

**Raised by Utsav, 2026-09-27.**

Right now the ranking LLM sees exactly one body of evidence: the NQR course rows. That is a
single point of failure with no detector. If a row is wrong — a mis-stated level, a mis-mapped
occupation, a course that no longer runs in that district — the model has no second source to
contradict it, so it will explain the bad recommendation just as fluently as a good one. A system
where the brain cannot tell right from wrong is a system that fails silently.

We already know the register contains errors, because NCVET says so: **156 of 2,157 qualifications
mis-mapped to NCO codes, and 256 unmappable.** Roughly one in five of the occupation bridge is
broken. Single-sourcing on top of that is not a hypothetical risk.

**What to add to the LLM's context, alongside the candidate courses:**

| Source | What it lets the model catch |
|---|---|
| `district_opportunity` rows | a trade with no local demand, however good the course looks |
| NCO-2015 occupation bridge | a course whose stated occupation disagrees with its NCO mapping |
| PM-AJAY Annexure I domains | a course GIA cannot actually fund in this district |
| `outcome` history for that trade | a trade that is recommended often and placed rarely |
| The near-miss set | a Level 2 course that is a better first step than the Level 3 it nearly qualified for |

**The rule that makes it safe:** extra context is for *rejecting* a candidate, never for adding
one. The eligibility gate still decides what may be considered; the second sources only let the
model say "this one looks wrong, take the next." That keeps the audit story intact — nothing can
be recommended that the gate did not clear.

**Cost of leaving it:** a confidently-worded recommendation built on a bad row, with nothing in
the system able to flag it. This is internal-quality work, not a demo feature, which is why it
sits here rather than in the build plan.

---

## Learn the ranking weights from outcomes instead of asserting them

The weights in `ai/data/weights.json` are written-down judgement calls. Honest, versioned, and
still unvalidated. The `outcome` table (RECOMMENDED → ENROLLED → CERTIFIED → PLACED → DROPPED) is
exactly the signal needed to fit them properly — but it needs real cohorts and months of elapsed
time. Until then the defensible claim is "the weights are published and the spread is measured",
not "the weights are optimal".

---

## On-device Vosk for the app

`web/app` lists Vosk as a provider with `live: false`. The IVR side has it working and measured.
Until the Capacitor plugin exists, the app's "works in aeroplane mode" claim covers the interview
and the storage, but not speech — offline answers have to be tapped, not spoken.

---

## Opus decoding for WhatsApp voice notes

`services/telephony/src/whatsapp.ts` downloads the OGG/Opus and does not decode it. The channel is
wired end to end apart from that one step.

---

## The Perspective Plan in the portal's real format

We emit district demand and plan lines. Nobody has yet opened `pmajay.dosje.gov.in` by hand to see
the column layout the portal actually expects — its TLS chain broke automated fetch. The
differentiator was never the screen, it is the format and the first-week-of-April date, and we
cannot claim the format until someone has looked at it.

---

## The 30-utterance dialect measurement

`decisions.md` says we publish the measurement rather than claim dialect support. The synthetic
harness exists and is good; real recordings by real speakers do not. Until they do, R2 is a claim.
