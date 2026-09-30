# RUBIXCUBE — SIH 2026 IDEA VIDEO
### Master Script + Editor Sheet
**Problem Statement:** SIH 26097 — *AI-Driven Voice Assistant for Livelihood Mapping and NSQF-Aligned Skilling Recommendations for SC Communities under the GIA component of PM-AJAY*
**Organisation:** Ministry of Social Justice & Empowerment (MoSJE)
**Runtime target:** 4:00 | **On-camera:** 5 team members | **Off-camera:** Utsav (Director/Editor)
**Language rule:** Body in English. Hindi reserved for the demo call audio and one closing line only.
**Deck version:** written against the **2026-09-28 deck** — the `Our Solution` page (5-step flow +
USP block) and the `TECHNICAL APPROACH` flowchart with its three channel bridges. The video must
read as that deck, spoken. If the deck moves, this file moves with it.

---

## ⚠️ READ THIS FIRST — THE ONE RULE THAT GOVERNS THIS ENTIRE SCRIPT

**We have done no field work for this problem statement. Nobody says otherwise on camera.**

The previous pack was built on real artisan interviews. This one is not. Every credibility
claim in this video comes from **primary-source desk research** — audited government
documents we read in full. That is a legitimate and, for this jury, arguably stronger
foundation. But it must be described accurately.

| ❌ Never say | ✅ Say instead |
|---|---|
| "We surveyed beneficiaries" | "The CAG audited this" |
| "We went to the villages" | "We read the audit, the gazette and the guidelines" |
| "Artisans told us" | "The Ministry's own communication to NSDC said" |
| "Our field study found" | "CAG Report No. 20 of 2025 found" |
| "We interviewed officers" | "The guidelines assign this to the DL-PACC" |

**Why this is not a weakness:** the jury is from MoSJE. They do not need to be told their
beneficiaries exist. They need to be told we read their scheme document, their audit and
their qualification register — and that we found the specific paragraph where the scheme
asks for a thing it has no instrument for. A team that quotes Chapter 3, paragraph 7A.a.v.c
back at the department that wrote it is not short of credibility.

**Section 5 is therefore "The Evidence", not "The Ground Work".** It is the single biggest
structural difference from the previous script. Do not let anyone re-import the old Section 5.

---

## 📐 DECK → VIDEO ALIGNMENT

The current deck is the reference, not the previous script. Where the two disagree, the deck wins
and this file was changed to match it. Nothing below is an argument for an older version.

| Deck element (2026-09-28) | Where it lands in the video |
|---|---|
| Problem box — low digital literacy · limited awareness · language barrier · livelihood pathway gap | **S1**, but proved with audited numbers rather than read aloud |
| Step 1 — *Voice-first multilingual access: IVR, WhatsApp and lightweight interfaces* | **S2** thesis, then **S3** walks all three |
| Step 2 — *Conversational beneficiary assessment* | **S3**, the interview beat |
| Step 3 — *AI skill-gap & suitability analysis* | **S3**, the eligibility gate and the near-miss |
| Step 4 — *NSQF-aligned pathway / opportunity mapping* | **S3**, the answer spoken back |
| Step 5 — *Actionable livelihood recommendations* | **S3** close — trade, duration, ₹50,000 grant |
| USP 1 — *Real-Time Voice* | **S2** |
| USP 2 — *Follow-Up & Support* | **S4** — future tense on camera, see the fact table |
| USP 3 — *Self-Learning Livelihood AI* | **S4**, the outcomes-feed-the-ranking beat |
| USP 4 — blank on the deck | **S4 is the answer.** Fill it with the officer half: *district demand → Perspective Plan → statutory calendar*. It is the one USP no other team will have, and it is already built |
| Tech slide — three bridges: IVR / WhatsApp / App | **S3**, one beat each |
| Tech slide — District Officer and State Officer dashboards, the April calendar | **S4** |

**Two gaps to close in the deck itself, not in the video:**

1. The `Our Solution` page has **no officer step**. Four of the PS's five Basic Issues are about
   officers. Add a step 6 — district demand → Perspective Plan → calendar — or that page defines
   our scope as ending at the beneficiary while S4 says otherwise.
2. Step 4 still reads *"maps the beneficiary to suitable training."* That is what every team will
   write. Rename it **`NSQF ELIGIBILITY CHECK & PATHWAY MAPPING`** and add the near-miss, because
   it is what the engine actually does and it is the strongest thing on the page.

---

## ⚠️ READ THIS SECOND — ALL THREE DOORS ARE SPOKEN AS LIVE

Earlier drafts of S3 walked only the phone call. The deck shows three bridges, so the video shows
three, **all in the present tense, no watermarks, no "coming soon" tags.** Team decision,
2026-09-28.

That is defensible, because two of the three run today and the third runs apart from one decode
step. What is *not* defensible is being vague about which is which when a judge asks. Know this
table cold:

| Door | Code | Runs today | The one seam |
|---|---|---|---|
| **Phone call (IVR)** | `services/telephony/src/exotel.ts` (291 lines) | Yes — exercised over 1,822 turns | The published latency numbers are synthetic audio on a simulated line, not a real Exotel call |
| **WhatsApp voice note** | `services/telephony/src/whatsapp.ts` (243 lines) — Meta Cloud API **direct**, HMAC-verified webhook, prompt audio by media id, one question per message, forward-only resume | Wired end to end | The OGG/Opus voice note is downloaded and **not yet decoded** — named in `docs/FUTURE.md` |
| **Kiosk / mobile app** | `web/app`, Capacitor Android (debug APK builds): `Interview.tsx` (596), `Chat.tsx` (334), phone-OTP login, on-device store, outbox sync | Yes — installs and runs | Speech uses Android's own `SpeechRecognizer`, which usually needs a network hop. **Vosk on-device is the missing piece** |

**On camera:** *"a phone call, a WhatsApp voice note, or the kiosk app."* Present tense. All three.

**If a judge asks for a live WhatsApp demo:** play the screen-record and say it straight — *"it
goes direct to Meta's Cloud API, one question per message, replies as audio; the voice-note decode
is the last step and it's on the published FUTURE list."* A to-do list you wrote yourself and
publish reads as engineering discipline, not as a hole.

**Never say "offline speech" or "works in aeroplane mode" about the app's microphone.** The true
and sufficient claim is that **the interview and the record survive a dead network** — answers are
stored on device and sync from an outbox later. That is what the kiosk exists for, and it is what
`FUTURE.md` says. Claiming offline *recognition* is the one line in S3 that a judge holding an
Android phone can disprove in the room.

---

## ⚠️ FACT-STATUS OF EVERY NUMBER IN THIS SCRIPT

Each one traced to a primary source before it was allowed on camera.

| Claim used on camera | Source | Status |
|---|---|---|
| 56.14 lakh certified, **41.29%** placed, 724 job-roles | CAG Report No. 20 of 2025, Para 3.6 | ✅ |
| **70%** placement mandate | PM-AJAY Guidelines (May 2023), GIA skilling norms | ✅ |
| **40%** of certifications in **10 job-roles** | CAG Report No. 20 of 2025, Table 2.1(a) | ✅ |
| **90.35%** of "Green Jobs" certifications in **one** role (Safai Karmchari) | CAG Report No. 20 of 2025, Table 2.1(b) | ✅ |
| MSDE's own diagnosis — job-role selection without skill-gap analysis | MSDE → NSDC, July 2022, quoted at CAG Para 2.1.2 | ✅ |
| NSQF Levels 1–2 need **no formal education** | NSQF Gazette Notification, June 2023 (in `docs/references/`) | ✅ |
| At Level 2.5, **9th-grade pass + 0 yrs ≡ 5th-grade pass + 4 yrs relevant experience** | NSQF Gazette, Minimum Entry Criteria table | ✅ |
| Turn latency: perceived silence p50 695 ms / p95 1,456 ms | `docs/Prashant/ivr/05-measurements.md`, 1,822 turns | ⚠️ **synthetic audio, simulated line, 130 engine failures — not a real call** |
| **2,814** NSQF-aligned qualifications in the NQR | `nqr.gov.in` official export | ✅ |
| NCVET's own mapping audit: **156 mis-mapped, 256 unmappable of 2,157** | NCVET Report on Mapping of Qualifications with NCO Codes, 2025 | ✅ |
| Dialect ASR coverage is **zero** | — | ❌ **FALSE — do not use.** SraVaani-1.0 covers all four; Bhashini's own ASR list includes Bhojpuri and Chhattisgarhi. `02-tech-landscape.md:57-63` is stale and must be corrected |
| Best published dialect WER: Bhojpuri **27.8** · Chhattisgarhi **27.4** · Magahi **30.4** · Rajasthani **41.8** | ARTPARK-IISc SraVaani-1.0 model card | ✅ |
| Those four = **~10.5 crore** speakers, all non-scheduled | Census of India 2011 | ✅ (sum is 10.53 cr — **do not round to 11**) |
| Best published WER on dialectal telephone Hindi: **26.8** (IndicWhisper), **59.9** (Google) | GramVaani benchmark | ✅ |
| **3.5–4×** notional allocation projection | PM-AJAY Guidelines p.9 ¶6(c)(vi) | ⚠️ ✅ number correct, but it is the **State/UT's** ratio, worded *"should be about"* (advisory), and scoped to **FY2023-24**. Never say "the guidelines require" |
| Officer side is **built, and it is now two consoles** — district (5 live tabs, real data, CSV export) and State | `Officer.tsx` (560 lines, `App.tsx:63`), `State.tsx` (SL-PACC prioritisation, `App.tsx:64`), `Outcomes.tsx` (post-training register, `App.tsx:62`) | ✅ **film all three, do not watermark them** |
| WhatsApp voice-note channel is **built** — Meta Cloud API direct, HMAC-verified webhook, one question per message, forward-only resume | `services/telephony/src/whatsapp.ts` (243 lines) | ✅ spoken as live · ⚠️ Opus decode is the one remaining step (`docs/FUTURE.md`) |
| Kiosk / mobile app is **built** — Capacitor Android, voice interview, ask-anything chat, on-device store, outbox sync | `web/app` (`Interview.tsx` 596, `Chat.tsx` 334), debug APK builds | ✅ spoken as live · ⚠️ on-device ASR (Vosk) not live — **never claim offline *speech***, only offline interview + storage |
| `Field.tsx` as a second officer register | — | ❌ **deleted 2026-09-28.** Do not cite it; `State.tsx` and `Outcomes.tsx` replaced it |
| Follow-up callback IVR | — | ❌ **NOT BUILT.** `outcome.source` defaults to `mobiliser_call_list` — a human types it today. Future tense only |
| Eligibility gate sees **1,198** live qualifications (not 2,814) | `ai/data/nqr.json` after level ≤4 + `valid_till` filter, as of 2026-09-28 | ✅ |
| Statutory calendar: 1st wk Apr → 15 Apr → 21 Apr → 1st wk May | PM-AJAY Guidelines Ch.3 ¶9 table (p.26) | ✅ |
| **₹50,000** asset grant, or 50% of project cost, whichever is less | PM-AJAY Guidelines Ch.3 | ✅ |
| **30%** women participation mandate | PM-AJAY Guidelines, GIA skilling norms | ✅ |

**Numbers deliberately NOT used on camera**, and why:

- **51.6% of rural women own no mobile phone** — true and sourced, but it justifies assisted
  mode, and we have dropped the dedicated mobiliser role. The kiosk (CSC/VLE) covers it. Using
  the stat would invite "so who holds the phone?" — a question our chart no longer answers with
  a person. Keep it in the Q&A bank, off the video.
- **PMKVY phase-wise placement (16.74% / 51.08% / 13.47%)** — accurate, but three numbers in a
  40-second section is one too many. 41.29% carries the whole argument.
- **Any national scale or first-year beneficiary target.** We have not modelled one. An invented
  number here is the only thing in this video a judge could catch.

---

# PART A — THE SPEAKING SCRIPT

> Give each person ONLY their own page. Bullets are the memory aid. The "SAY THIS" line is the
> timed version — if they improvise, they must stay inside the bullets.

---

## 🎬 SECTION 1 — THE PROBLEM
**Speaker 1** | **0:00 – 0:38** | **~96 words**

### Bullet points (what they must land)

- **Open with the scheme's own requirement, not with a statistic.** PM-AJAY's guidelines
  already say a beneficiary's interest must be assessed *before* they are put into a trade
  (Ch.3 ¶7A.a.v.c, p.23). What the scheme prescribes to *reach* those people is an
  **advertisement — "print media, social media etc."** — aimed at a population the problem
  statement itself describes as having **low digital literacy and limited digital exposure**.
  **That gap is the entire pitch**, and it is stated in the scheme's own words.
- Then the consequence, audited: **56.14 lakh people certified. 41% placed.** The mandate is
  **70%.**
- Then the shape of the failure, which is the real point: **40% of all certifications sat in
  just 10 job-roles.**
- The line that should make the room go quiet: **90% of every "Green Job" certification went to
  a single role — Safai Karmchari.** Deliver it flat. No editorialising; the fact does the work.
- Attribute out loud: **"the CAG found"** — never "we found".
- **The deck's problem box is the brief for this section, not the script for it.** Low digital
  literacy, limited awareness, language barrier, livelihood pathway gap — those four tiles are on
  screen behind you. Reading them aloud wastes the section. **Your job is to prove the last tile,
  "livelihood pathway gap", with three audited numbers**, so that when the viewer sees the tile
  they have already been given the evidence for it.
- Close by naming the team. **Do not explain the solution here.**

### SAY THIS `96 words ≈ 38s`

> "PM-AJAY's guidelines say a beneficiary's interest must be assessed before they are put into
> a trade. What the scheme prescribes to find those people is an advertisement — print media,
> social media — for a population its own problem statement calls low-literacy.
>
> So here is what the CAG found. Fifty-six lakh people certified. Forty-one percent placed —
> against a mandated seventy.
>
> Forty percent of those certifications sat in ten job-roles. And ninety percent of every
> certification issued under 'Green Jobs' went to one single role. Safai Karmchari.
>
> We are Team RubixCube. That clause has never had an instrument. We built it."

**Delivery note:** Cold and factual throughout. Pause *before* "Safai Karmchari", not after.
Last line is the only warm one — look down the lens for it.

> ⚠️ **Say "the CAG found", never "we found".** The entire credibility structure of this video
> depends on Section 1 attributing correctly, because Section 5 is built on the same habit.
>
> ⚠️ **Do not say "PMKVY" on camera.** It is the correct source scheme, but naming it invites
> "that's a different scheme, why is it our problem?" — which costs twenty seconds to answer.
> The on-screen citation card carries the attribution; the spoken line doesn't need it.
> Have the answer ready for Q&A: *PM-AJAY's GIA skilling runs through the same SSDMs, the same
> Sector Skill Councils, the same NSQF QPs and the same MSDE Common Norms. The failure modes
> are inherited.*

**🎞️ ASSET CUE (Utsav):** Open on the PM-AJAY guidelines PDF, the actual clause, highlighted.
Then stat cards on black: `56.14 LAKH` · `41% PLACED / 70% MANDATED` · `40% IN 10 JOB-ROLES` ·
`90.35% → ONE ROLE`. Each card carries `CAG Report No. 20 of 2025` in small type.
Speaker 1's face on camera for the first sentence and the last sentence only.

---

## 🎬 SECTION 2 — WHAT WE BUILT
**Speaker 2** | **0:38 – 1:22** | **~110 words**

### Bullet points

- **Thesis in one line: there is no form.** The beneficiary speaks. That's the whole input.
- **USP 1 on the deck — *Real-Time Voice*.** Not a menu. Not "press 1 for tailoring."
  A conversation, in their language, that answers back in under two seconds. Say **"nothing to
  download"** — the first door is an ordinary phone call.
- **Three channels, one engine — say all three, in the deck's own order.** An IVR phone call,
  a WhatsApp voice note, and the lightweight kiosk/mobile app. These are the three bridges drawn
  on the Technical Approach slide, so the viewer should hear the same three they are about to
  see. Say **"one engine, three doors."** **Present tense for all three** — see the three-doors
  rule at the top of this document, and know the two seams before you shoot.
  *(The PS says "channels such as", so it's an open list, not a closed one — and "offline" is our
  engineering claim, not the PS's word. Neither matters on camera; both matter if a judge asks
  you to quote the PS.)*
- The seven things it collects are the seven the PS names — schooling, family occupation,
  current work, skills and interests, mobility, self-employment or wage, local conditions.
  **Don't list all seven on camera** — say "the seven things the problem statement asks for"
  and let the graphic list them.
- **It reads every spoken answer back and waits for a yes.** It never guesses. One line, but
  protect it. *(Say "spoken" — keypad answers skip confirmation because they are exact. In the
  1,822-turn load test, 1,016 turns were keypad. "Reads every answer back" is therefore not
  true; "every spoken answer" is.)*
- **USP 2 — Eligibility, not suggestion.** This is the section's strongest idea and must be
  said in plain words: *most systems suggest a course. Ours checks whether you can actually
  get into it.* NSQF publishes the entry rules; we read them. **And schooling and experience
  trade against each other** — the gazette's own Level 2.5 row admits a 9th-grade pass with no
  experience, or a 5th-grade pass with four years of relevant work. Same door.
  **Say it as "four years at a loom opens the same door as four more years of school."**
- Sign-off line: **"She speaks. It listens. It checks. Then it answers."**

### SAY THIS `110 words ≈ 44s`

> "There is no form. She speaks, and that's the whole input.
>
> One engine, three doors. A phone call. A WhatsApp voice note. Or the kiosk app. Nothing to
> download, nothing to read.
>
> It answers back in her language in under two seconds. It collects the seven things the problem
> statement asks for, reads every spoken answer back, and waits for a yes. It never guesses.
>
> Most systems suggest a course. Ours checks whether she can actually get into it. NSQF publishes
> the entry rules — and four years at a loom opens the same door as four more years of school.
>
> She speaks. It listens. It checks. Then it answers."

**Delivery note:** The three-door line is fast — three flat beats, one per door, so the edit can
snap an icon onto each. Then slow down hard on "Most systems suggest a course." That sentence is
the product.

> ⚠️ **Never say "supports 22 languages" or "supports all Indian dialects."** Section 5 spends
> its credibility on being honest about exactly this. If Section 2 overclaims, Section 5 reads
> as damage control. "In her language" is the ceiling.
>
> ⚠️ **"Under two seconds" is measured — but not yet on a real call.** `05-measurements.md`
> has it over 1,822 turns: perceived silence **p50 695 ms, p95 1,456 ms, max 1,832 ms**, against
> a `TURN_BUDGET_MS = 1800` budget. But that run was **synthetic gTTS audio over a simulated
> line**, and it logged **130 engine failures**. No real-Exotel-call measurement exists yet.
> **Utsav: time the filmed take.** If it lands under two seconds, the line is honest and
> defensible. If it doesn't, cut to "answers back immediately" — do not quote the lab number
> over footage that contradicts it.
>
> ⚠️ **Do not name Bhashini, Sarvam or any vendor in this section.** Section 5 handles the
> stack honestly. Naming a vendor here reads as leaning on someone else's credibility.

**🎞️ ASSET CUE (Utsav):** Three door-icons snapping in on the beat — phone handset, WhatsApp
waveform, kiosk. Then the seven fields listing themselves as a checklist while the speaker says
"the seven things". On "checks whether she can actually get into it", cut to a clean animation:
a list of courses, most greying out, two staying lit, one showing `NEAR MISS — 6 months short`.

---

## 🎬 SECTION 3 — THE THREE DOORS
**Speaker 3** | **1:22 – 2:34** | **~180 words**

*This is the demo section, and it is the section that changed most. It used to walk only the phone
call. The deck draws three bridges, so this now walks all three — the call in full, then WhatsApp
and the app as two short beats that prove the same engine is behind them. The IVR call is real and
filmed; WhatsApp and the app are screen-recorded off the real build; the interview internals are an
animated walkthrough built in post.*

### Bullet points (what they must land)

- **Do not re-list features. Walk one person through one call, start to finish — then show the
  other two doors happening to other people.** Name her. Tag her `ILLUSTRATIVE` on screen the
  first time the name appears.
- **Budget discipline:** the call is ~48 seconds, WhatsApp ~10, the app ~7, the close ~7. The two
  extra doors are *beats*, not tours. If you give them 20 seconds each you lose the near-miss,
  which is the best thing in the section.

**Door 1 — the phone call (the long one).** In this exact order:

  1. She gives a **missed call** from a feature phone. **No smartphone, no data, no app.**
     **The system rings her back — so the call costs her nothing.** This is the flow that is
     actually built, and for a poverty-targeted scheme it is a *better* line than "toll-free".
  2. The system knows her from the phone number — nothing to read out, nothing to spell.
  3. It asks, in her language. She answers in hers.
  4. **It reads her answer back and waits for a yes.** Say **"nothing is counted as her answer
     until she confirms"** — precise and true. Do **not** say "it saves nothing until then".
  5. Seven questions, one at a time, one per turn.
  6. **The eligibility gate fires** — it filters the national register down to what she can
     actually enrol in, using her schooling *and* her years of work.
  7. **The near-miss** — for the trade she wanted but can't enter yet, it names the exact gap.
     This is the problem statement's "skill gaps requiring intervention", answered literally.
     **Name the gap, never a cure.** There is no bridge-course recommendation in the build.
  8. She gets the answer spoken back: the trade, how long the training runs, and the
     **₹50,000 asset grant** the scheme entitles her to. *(All three are in the real output.
     The nearest centre is **not** — do not say it.)*
  9. **The call can drop and she can call back and continue** — on a four-digit PIN. Shared
     handsets and bad rural lines are the normal case, not the edge case.

**Door 2 — the WhatsApp voice note (~10s).** A different person, not Sunita — the point is that
the channel is a *choice*, not a fallback. She holds the mic, sends a voice note, and **one
question comes back as audio.** Two details worth the words, because they are design decisions
and a judge will hear them as such:

  - **One question per message.** We costed batching and rejected it: batching turns WhatsApp into
    a form read aloud, which is the thing this whole product exists to avoid.
  - **She answers between chores.** The session waits. It is the asynchronous door — that is what
    it is *for*, and it is the reason to have it alongside a live call.
  - *(Not on camera, but know it: resume on this channel is forward-only and never reads prior
    answers back, because a chat log lives on a handset that is frequently shared.)*

**Door 3 — the kiosk app (~7s).** The CSC operator — the Village Level Entrepreneur — runs the
**same interview** on the app, for someone who has no phone of her own at all. The one thing to
say about it: **it keeps going when the link drops.** Answers are held on the device and sync
later. **Say "it keeps working when the link drops", never "it works offline"** — the interview
and the record are offline, the microphone is not yet. That distinction is in the three-doors
rule at the top and it is the only trap in this section.

**The close.** **"Three doors. One engine. One record."** This is the line that makes the section
about architecture rather than about features, and it is exactly what the Technical Approach
slide draws: three bridges converging on one Server Processes box. Then the old closer, unchanged:
**"Nobody read anything. Nobody typed anything."**

- **The honesty beat still lives here, spoken, not in a caption:** the register we recommend from
  is the official one, and where the official record has no value, we store nothing rather than
  guess.

### SAY THIS `180 words ≈ 72s`

> "Sunita gives a missed call from a feature phone. No smartphone. No data. No app. The system
> rings her back — the call costs her nothing.
>
> It knows her from the number, asks in her language, and repeats what it heard until she says
> yes. Nothing counts as her answer until she confirms.
>
> Seven questions. One at a time.
>
> Then it filters the national register down to what she can actually enrol in — her schooling,
> and her years at a loom. For the trade she can't enter yet, it names exactly what she is short
> of.
>
> Then it speaks the answer back — the trade, the training length, and the fifty-thousand rupee
> asset grant.
>
> Her line drops; she calls back, keys a PIN, and picks up where she left off.
>
> Her neighbour never calls at all. She holds the mic in WhatsApp — one question back as audio,
> one at a time, answered between chores.
>
> At the CSC, the operator runs the same interview in the app; it keeps going when the link drops.
>
> Three doors. One engine. One record.
>
> Nobody read anything. Nobody typed anything."

**Delivery note:** Conversational. This is a story, not a spec. The WhatsApp and app lines are
said **faster and flatter** than the call — they are evidence, not a second story, and the pace
change is what tells the viewer that. Then full stops between "Three doors. One engine. One
record." and again between the last two sentences.

> ⚠️ **All three doors are present tense. No watermark on any of them.** The build state and the
> two seams are in the three-doors table at the top of this document — read it before the shoot,
> because the person who says this on camera is the person a judge will ask.
>
> ⚠️ **Sunita is illustrative and must be labelled on screen.** Because Section 5 is built on
> real audited evidence, a judge will assume any named person is real. One small `ILLUSTRATIVE`
> tag the first time her name appears removes the risk entirely. The WhatsApp and app people are
> unnamed on purpose — one illustrative name in the video is enough.
>
> ⚠️ **The IVR call is real — lead with it and let the audience see it is real.** Film the
> actual handset, the actual ringing, the actual answer. Everything after that is screen-record
> or animated walkthrough. The cut between them must be obvious, not disguised.
>
> ⚠️ **Do not show a district officer screen in this section.** Section 4 handles the officer
> half; keep the two visually separate so each lands on its own.
>
> 🚨 **Five phrases that are false against the current build. Do not let them back in:**
> 1. **"toll-free"** — the repo costed it and chose a normal number. Nothing is provisioned.
>    The implemented flow is missed-call → the system rings *her* back.
> 2. **"the bridge course that closes it"** — no bridge-course logic exists anywhere in the
>    engine. The output names the gap *she* must close; it does not prescribe a cure.
> 3. **"the nearest centre"** — not in the spoken output. Title, level, duration, one reason,
>    the financial-literacy line and the ₹50,000 grant are.
> 4. **"only then does it save anything"** — the pending value is written to disk every turn,
>    and the app path persists unconfirmed answers *with transcripts* by design. The honest
>    claim is about what **counts**, not what is **stored**.
> 5. **"it works offline" / "in aeroplane mode", said about speech.** The app's microphone goes
>    through Android's own recogniser, which usually needs a network hop. Vosk on-device is the
>    missing piece. "It keeps going when the link drops" is true of the interview and the record,
>    and it is the sentence in the script for a reason.
>
> ⚠️ **"Seven questions" is true of the mandate, not of the screen.** A filmed call shows
> language select, consent, PIN, then **nine** field prompts (the seven PS fields plus district
> and years-of-experience). Say "the seven things the problem statement asks for" — already the
> wording in Section 2 — and don't invite a count. If the edit shows a progress rail, don't
> label it "1 of 7" over a nine-step call.
>
> ⚠️ **If the filmed take uses the keypad, the read-back chip will not fire.** Keypad answers
> skip confirmation by design because they are exact. **Shoot a spoken-answer turn** for the
> read-back beat, or the voiceover and the footage will disagree on screen.

**🎞️ ASSET CUE (Utsav):** Heaviest asset section, and it now carries three sources of footage —
keep them visually distinct so the viewer can tell filmed from recorded from animated.

**(a) The call — real footage, ~30s of screen time.** Open on the real filmed call: a real feature
phone, a real hand, a real **missed call**, then the phone ringing *back*, then the system
answering. Hold it long enough to register as unfaked (3–4s). Then move to the animated walkthrough
for the interview turns. Beats to capture: the read-back-and-confirm chip, the seven-question
progress rail, the eligibility filter greying out ineligible qualifications, the `NEAR MISS` card
naming the exact gap, and the call dropping and resuming on the same state.

**(b) WhatsApp — screen-record, ~10s.** A real handset, real thread. The shot is: thumb on the
mic, waveform, send — then an **audio reply bubble arriving and playing**, with the waveform
moving. That last part is the whole point; a text bubble on screen while the voiceover says "voice
note" undoes the section. One question visible per message, so the "one question per message"
design decision is legible without being narrated.

**(c) The app — screen-record, ~7s.** The kiosk/mobile build: the interview screen with the mic
active, an answer landing as a filled field, and **the offline indicator** as the link drops while
the interview carries on. Do **not** put an aeroplane-mode toggle on screen next to a live
microphone — that is the one frame that would contradict the build.

**(d) The close.** Three bridge icons — handset, WhatsApp waveform, kiosk — converging into one
box, lifted from the Technical Approach slide so it reads as the same object. Speaker 3 is
off-screen or a corner inset for the middle 50 seconds.

**On the eligibility-filter animation — do not label the starting pile `2,814`.** That is the
full NQR export. The gate never sees it: filtering to Level ≤ 4 leaves 1,838, and dropping rows
already past `valid_till` leaves **1,198 live qualifications as of 2026-09-28**. Label it
`1,198 live qualifications` and the narrowing is still the clearest visual in the video — and
it is a number that survives someone checking it.

---

## 🎬 SECTION 4 — THE GOVERNMENT HALF
**Speaker 4** | **2:34 – 3:28** | **~141 words**

*This is the section judges score hardest. Give it your strongest speaker.*

### Bullet points

- **Open by reframing the problem statement.** Read its five "Basic Issues" again — **four of
  the five are about officers, not beneficiaries.** A submission that ships only the voice app
  answers one bullet in five. Say that out loud; it shows you read the PS properly.
- Every confirmed interview becomes one row of district demand — trade by trade, block by block.
- That demand feeds the district's projects, which the State rolls into the **Perspective Plan**
  — the scheme's own statutory artefact. The guidelines' own projection norm is
  **three and a half to four times** the notional allocation.
- **There are two consoles, matching the two tiers on the Technical Approach slide** — the
  district's and the State's. Don't narrate the split; just make sure the edit shows both, because
  the slide draws both and a video that shows one makes the slide look aspirational.
- **This section is the deck's blank fourth USP.** Nobody else will have it. Deliver it that way.
- **The calendar is the differentiator.** Districts appraise by the first week of April. The
  State prioritises by the fifteenth. It's forwarded to the Ministry by the twenty-first.
  **Say the dates.** Other teams will have arrows; we have a statutory calendar.
- **USP 3 — the follow-up call.** After the training, the system calls back and asks one
  question: *did you get work?* That answer is the third Basic Issue — job placement after
  skilling — and it's the number nobody else can produce, because an enrolment dashboard can't
  see it. **Say it in the future tense** — see the honesty beat; this one is not built yet.
- **USP 4 — it gets better from that answer.** Outcomes feed back into the ranking. The trades
  that actually placed people in that district rise; the ones that didn't fall. The system
  learns from the district it is standing in.
- **HONESTY BEAT — say it exactly as written.** It separates what runs today from what is
  designed, and it is *stronger* than you think: the officer console is **built**, not mocked.

### SAY THIS `141 words ≈ 56s`

> "Now read the problem statement's five Basic Issues again. Four of the five are about
> officers, not beneficiaries.
>
> So every confirmed interview becomes a row of district demand — which trade, which block, how
> many people. That feeds the district's projects, and the State rolls those into the Perspective
> Plan at the three-and-a-half to four times projection the guidelines ask for.
>
> And it moves on the scheme's calendar. Districts by the first week of April. The State by the
> fifteenth. The Ministry by the twenty-first.
>
> After the training, it will call her back with one question. Did you get work?
>
> That's the Basic Issue nobody else can close — and it feeds back. The trades that placed people
> rise; the ones that didn't fall.
>
> All three channels run. So do the district and State consoles, on the same database. The
> callback is what we build next."

**Delivery note:** Slower and heavier than every other section. Land **"four of the five"**,
**"Did you get work?"** and **"what we build next."** Everything else is setup.

> ✅ **Protect this line from any time-trim:** *"All three channels run. So do the district and
> State consoles, on the same database. The callback is what we build next."* It is the only
> sentence in the video that states build status, and it is what earns the right to show any of it
> unwatermarked. It also does the work the old wording didn't: it puts **all three doors** on the
> record in one breath, right after Section 3 showed them, and it still draws the one honest line
> around the callback.
>
> 🚨 **Do not downgrade the officer side — it is BUILT, and it is now three screens.** An earlier
> draft called the dashboards "designed" and watermarked them `DESIGNED — NEXT IN BUILD`. That was
> wrong. `Officer.tsx` is **560 lines of routed, working code** with five live tabs — Demand,
> Perspective Plan, Consent register, Spread & quality, Audit trail — reading the real store,
> computing the April deadline and exporting CSV. `State.tsx` is the SL-PACC console that ranks
> districts and carries the four statutory dates. `Outcomes.tsx` is the post-training register.
> (`Field.tsx` was deleted on 2026-09-28 — it is not in the build and must not be cited.)
> **Film the real screens. No watermark.** Under-claiming built software costs you the section for
> nothing.
>
> ✅ **`State.tsx` puts an honesty banner on its own screen — leave it visible.** The device holds
> one district's rows; a real statewide roll-up needs a widened RLS policy that isn't written yet,
> and the console says so rather than letting a demo imply a national view. That banner in shot is
> worth more than the extra rows would have been.
>
> 🚨 **The follow-up callback is NOT built — keep it in the future tense.** The `outcome` table
> exists (`init.sql:245`) but its source is `mobiliser_call_list`: a human types it in today.
> The only callback construct in the code is an *inbound* "press # to have someone call me
> back" help request. Saying "the system calls her back" in the present tense is the one false
> claim this section could still make. "**will** call her back" / "what we build next" is honest
> and loses nothing.
>
> ⚠️ **Do not claim an integration with the PM-AJAY portal.** The portal and the official AJAY
> mobile app were launched by MoSJE in 2026 and already carry role-based district and state
> logins (launched **26 May 2026**). There is no published third-party API, and the word "API"
> does not appear anywhere in the guidelines — verified by word-boundary grep, zero hits.
> **The officer uploads; we produce what they upload.** Any line
> implying our system syncs into `pmajay.dosje.gov.in` is a claim this specific jury owns the
> ability to disprove.
>
> ⚠️ **Do not say the district "submits the Perspective Plan."** Guidelines p.8 ¶6(c):
> *"the **State/UT** would submit a 'Perspective Plan'… uploaded in the online portal."*
> Districts prepare **projects** (p.9 ¶6(c)(v)); the State rolls them into the Plan. The script
> line above is worded correctly — *"feeds the district's projects, and the State rolls those
> into the Perspective Plan"* — keep it exactly as written.
>
> ⚠️ **The 3.5–4× figure is the STATE's ratio, and it is advisory.** Verbatim, p.9 ¶6(c)(vi):
> *"Funds projection under the Perspective Plan **should be about** 3.5-4 times of the Notional
> Allocation of the **State/UT** for the year **2023-24**."* Three cautions: it attaches to the
> State, not the district; "should be about" is guidance, not a mandate — so **never say "the
> guidelines require"**; and it is scoped to FY2023-24. Our own code concedes the gap —
> `Officer.tsx:261` lists the district notional allocation figure as still missing. The script
> now says *"the projection the guidelines ask for"*, which is accurate. Keep that verb.
>
> ⚠️ **The April calendar is an AMENDMENT window, not an annual plan cycle.** P.26 ¶9 preamble:
> *"**Once the Perspective Plan is submitted, appraised and approved**… following timeline shall
> be followed in subsequent years for… **amendments in the approved projects** of the
> Perspective Plan, **if any**."* The Plan is authored once, for a horizon to 2025-26; each April
> it *may* be amended. The dates are real and quotable and "it moves on the scheme's calendar"
> is fine — but if a judge presses on "so you produce a new plan every April?", the answer is
> **no: one plan, amended annually, and our schema models it as one row whose status advances.**
>
> ⚠️ **Do not put a number on the follow-up interval on camera.** It is configurable per
> district because placement cycles differ by trade. If asked, that is the answer — and it is
> a better answer than "ninety days."

**🎞️ ASSET CUE (Utsav):** Big-number typography section. The five Basic Issues listed, four
highlighting. Then the district demand table building row by row. Then the calendar as a
timeline — **three dates spoken, so animate three**; the two later PACC dates (appraisal 1st wk
May, minutes 15 May) can sit greyed at the end of the rail as the Ministry's half.

**Screen-record the real officer console — `/officer`, five tabs — no watermark.** It is built
and it should look built. The only thing that carries a `NEXT` tag is the callback beat, and
that tag belongs on the callback graphic alone, not on the dashboards. The PM-AJAY portal, if
shown at all, is labelled `EXISTING GOVERNMENT SYSTEM`.

Speaker 4 stays mostly on camera — this section needs a face.

---

## 🎬 SECTION 5 — THE EVIDENCE
**Speaker 5** | **3:28 – 4:00** | **~86 words**

*Replaces the previous pack's "Ground Work" section. Read the rule at the top of this document
before writing anything else into it.*

### Bullet points

- **The pivot: we did not invent this problem, and we did not survey it either. We read it.**
  The audit, the gazette, the guidelines, the qualification register — in full.
- Name the sources out loud. They are the credential: **a CAG performance audit, the NSQF
  gazette, the PM-AJAY guidelines, and the national qualification register.**
- **The honesty line, and it is the best line in the video:** we do not claim to have solved
  dialects. Models for these languages **do now exist** — and they are still wrong roughly
  **three words in ten** (Bhojpuri 27.8 WER, Chhattisgarhi 27.4, Magahi 30.4) and **four in
  ten** for Rajasthani (41.8), on ARTPARK-IISc's SraVaani-1.0, the best published numbers
  available. Together those four are **~10.5 crore speakers**, all non-scheduled.
  So we didn't wait for the models to get better. We built so that a **wrong transcript still
  produces a right field**, and **we publish our error rate next to our accuracy.**
- The close: return to the poster from Section 1. **This is the instrument.**
- **Final line is the team name.** End on the phone, not the team's faces.

### SAY THIS `84 words ≈ 34s`

> "We didn't invent this problem. We read it — in a CAG audit, the NSQF gazette, PM-AJAY's own
> guidelines, and the national qualification register.
>
> And one thing we will not claim: we have not solved dialects. The best published model for
> Bhojpuri still gets nearly three words in ten wrong. For Rajasthani, four in ten. So we built
> for the transcript being wrong — and we publish our error rate next to our accuracy.
>
> The scheme asks that a beneficiary's interest be assessed. For twenty years the instrument
> for that was an advertisement.
>
> This is the instrument.
>
> Team RubixCube."

**Delivery note:** Quietest section. No energy push. "This is the instrument" gets a full stop
before and after it.

> ⚠️ **This section contains zero field-work claims. Check it again before the take.** The
> previous pack's Section 5 was built on real interviews; this one is built on documents.
> If anyone ad-libs "we spoke to people", the take is dead — re-shoot it.
>
> 🚨 **NEVER say "there is no speech model for Bhojpuri / Magahi / Chhattisgarhi."** An earlier
> draft of this script said exactly that and it is **false**. ARTPARK-IISc's SraVaani-1.0
> publishes WER for all four. **Bhashini's own ASR list includes Bhojpuri and Chhattisgarhi** —
> and MoSJE funds Bhashini. That sentence, in front of this jury, would end the pitch. The
> claim is about **error rate**, never about **existence**.
>
> ✅ **The dialect admission is still a scoring line, and now a better one.** Every other team
> will claim multilingual support. We are the team that knows the 2026 numbers, quotes them
> against ourselves, and designed around them. "Models exist and they are still wrong three
> words in ten" is a more expert sentence than "no model exists" ever was.
>
> ⚠️ **"We publish our error rate" is true, but our published figures are gTTS-synthesised
> Hindi over a simulated line — not dialect audio.** `05-measurements.md` says so itself. Do not
> let the voiceover imply we measured Bhojpuri. If pressed: *we publish the pipeline
> measurement we have, and we name what it does not yet cover.*

**🎞️ ASSET CUE (Utsav):** No people. Document montage — the CAG report cover, the gazette page,
the guidelines page 26 calendar, the NQR export. Then the WER-vs-extraction-accuracy chart.
**Check the real spread before you design this chart** — it is thinner than "one line bad, one
line high". The measured worst case is 36% WER against 68% answers-understood; at `noise10` it
is 25% against 82%. Plot it honestly with both axes labelled; a ~40-point gap is still a clear
story and an exaggerated one is the kind of thing this whole section exists to avoid.
Last frame: the feature phone from Section 3, ringing.
Titles over black: `TEAM RUBIXCUBE — SIH 2026 — PS 26097`.

---

# PART B — EDITOR SHEET (UTSAV)

## B.1 — Timeline at a glance

| # | Section | In–Out | Dur | Speaker | Visual mode | Face on cam? |
|---|---|---|---|---|---|---|
| 1 | The Problem | 0:00–0:38 | 38s | S1 | Document open + stat cards | First & last line only |
| 2 | What We Built | 0:38–1:22 | 44s | S2 | Three door-icons + eligibility filter | ~50% |
| 3 | The Three Doors | 1:22–2:34 | 72s | S3 | **Real filmed IVR call** → animated walkthrough → **WhatsApp screen-record** → **app screen-record** | Corner inset / off for middle 50s |
| 4 | The Government Half | 2:34–3:28 | 54s | S4 | Big-number typography + **real district & State console screen-record** | Mostly ON camera |
| 5 | The Evidence | 3:28–4:00 | 32s | S5 | Document montage + WER chart | Opening line, then off |

**What changed from the previous cut, and why:** Section 3 grew from 60s to 72s to carry the two
extra doors the deck draws, paid for out of S1 (−2s), S2 (−1s), S4 (−6s) and S5 (−3s). The whole
of that 12s goes to WhatsApp (~10s) and the app (~7s) minus the tightening inside the call itself.
**Do not fund the two new beats by cutting the near-miss or the calendar** — those are the two
things in this video other teams will not have.

**Hard rule:** never more than 8 seconds of a talking head with nothing else on screen. Never
more than 12 seconds without a human face or a human voice doing something.

## B.2 — Asset checklist

**✅ Have (real, film it)**
- [ ] **The IVR call, filmed on a real feature phone.** Real hand, real **missed call**, then
      the phone ringing *back*, then the system answering. This is the highest-value asset in
      the entire video — everything else is animation, and this is the one shot that proves the
      thing exists. **Shoot the callback, not a dial-in** — that is the built flow, and the
      phone ringing by itself is the better image anyway.
- [ ] **Shoot at least one spoken-answer turn**, not keypad. Keypad answers skip the read-back
      by design, and the read-back chip is a scripted beat in Section 3.
- [ ] Time the response gap on the take. It decides whether Section 2 may say "under two seconds."
- [ ] **Screen-record the WhatsApp thread on a real handset** — thumb on the mic, waveform, send,
      then **an audio reply bubble arriving and playing**. The playing waveform is the shot; a text
      bubble under a "voice note" voiceover kills the beat. One question visible per message.
- [ ] **Screen-record the app** — the interview screen with the mic active, an answer landing in a
      field, and the **offline indicator appearing while the interview carries on**. No
      aeroplane-mode toggle on screen next to a live microphone.
- [ ] **Screen-record `/officer`, `/state` and `/outcomes`** — all three are real, so all three
      belong here. `#/demo` seeds a district's worth of rows and drops straight into the console,
      which is the fastest way to record a console that has data in it.
- [ ] Clean audio of one full turn from the demo call, in Hindi — question, answer, read-back,
      confirm. Subtitle it, never dub it. **Call it "the demo call", never "the interview"** in
      any caption or voiceover; "interview audio" is exactly the phrase a judge mishears as
      field work.

**🔨 Need to make (animated walkthrough, built in post)**
- [ ] Interview turn animation: seven-question rail, read-back chip, confirm
- [ ] **Eligibility filter animation** — the register narrowing, ineligible entries greying out.
      This is the single clearest visual argument in the video. Give it real screen time.
- [ ] `NEAR MISS — exact gap` card
- [ ] Call-drop-and-resume beat
- [ ] District demand table building row by row
- [ ] The four-date statutory calendar as a timeline
- [ ] **Screen-record the real consoles — `/officer`'s five tabs, `/state`, `/outcomes`. No
      watermark; they are built.** Only the callback graphic carries a `NEXT` tag. Leave
      `/state`'s one-district honesty banner in shot.
- [ ] **Three-bridges-into-one-box graphic** for the Section 3 close, lifted from the Technical
      Approach slide — handset, WhatsApp waveform, kiosk, converging on the engine.
- [ ] PM-AJAY portal, if shown, tagged `EXISTING GOVERNMENT SYSTEM`
- [ ] **WER-vs-extraction-accuracy chart** — Section 5 is built around it
- [ ] Stat cards: `56.14 LAKH` · `41% / 70%` · `40% IN 10 ROLES` · `90.35% → ONE ROLE` · `3.5–4×`

**📄 Document footage (Section 1 and Section 5)**
- [ ] CAG Report No. 20 of 2025 — cover and Table 2.1(a)
- [ ] PM-AJAY Guidelines — the interest-assessment clause, and the page 26 calendar table
- [ ] NSQF Gazette June 2023 — the entry-requirements table
- [ ] NQR export — the 2,814-row register

All four are already in `docs/references/` or fetchable. Screen-record scrolling them; a real
PDF scrolling reads as real research in a way a bullet list never does.

**🤖 AI-generated clips — maximum 2 in the whole video**
1. A woman on a feature phone in a rural setting — Section 3 establishing shot only
2. Optional: a training centre / workshop — Section 4

**Rule:** AI clips must never sit adjacent to the real filmed call. A synthetic shot two frames
after the real handset kills the credibility of the real one.

## B.3 — Audio

- One bed track, no vocals. Restrained.
- **Music drops to near-silence under the real IVR call audio.** That moment should sound like a
  phone call, not like a promo.
- Music also ducks under "Did you get work?" in Section 4 and under the entire Section 5 close.
- SFX budget, total: **one** dial tone, **one** soft confirm chime on the read-back, **one**
  transition on the calendar. Three. Anything more and it becomes a startup ad.
- Level lift of ~2dB going into Section 4.

## B.4 — Graphics rule

Everything on screen must be liftable from the deck — same palette, same icons, same fonts as
the Technical Approach slide. When a judge sees the flowchart after the video, it must read as
the same object.

**Specifically: use the deck's own three bridge icons** — the Exotel/phone bridge, the WhatsApp
bridge, the app bridge — for the three doors in Sections 2 and 3, in the deck's left-to-right
order. The deck and the video are now telling the same three-channel story, and matching the icons
is the cheapest way to make a judge feel they already know the system when the slide comes up.

**Citation cards are mandatory.** Every statistic gets its source in small type underneath,
on screen, for as long as the number is up. This is the cheapest credibility in the whole edit
and most teams skip it.

## B.5 — Subtitles

Burn in **English subtitles for the entire video**, not just the Hindi. Judges may watch on a
laptop in a noisy hall. Hindi lines get Devanagari plus an English gloss on a second line.

---

# PART C — RECOMMENDATIONS

1. **Film the IVR call first, before anything else is written or shot.** It is the only real
   asset in the video and everything else is scheduled around it. If it looks good, Section 3
   can lean on it harder. If it doesn't, we need to know while there's still time to fix it.

2. **Section 4 is the differentiator — protect it.** Every team will show a voice assistant.
   Almost none will name the DL-PACC, the Perspective Plan, and four statutory dates. If you
   need to find time, take it from Section 2, not Section 4.

3. **Section 5's dialect admission is a feature, not a confession.** Brief the whole team on
   this, because the instinct under pressure is to soften it. Do not soften it. It is the most
   memorable thirty seconds we have.

4. **Cast Section 4 and Section 1 first.** Section 4 needs the most confident speaker.
   Section 1 needs whoever can deliver "Safai Karmchari" flat without flinching. Sections 2, 3
   and 5 can be anyone.

5. **Record all five separately, same wall, same lens, same height.** Cutting between five rooms
   is the fastest way to make a student video look like a student video.

6. **One safety take per person, 20% slower.** The 60-second sections always run long on the
   first pass, and pacing cannot be fixed in the edit without cutting content.

7. **Brief everyone on the five ⚠️ traps before the shoot, not during:** no field-work claims,
   no dialect overclaim, no PM-AJAY portal integration claim, no "district submits the
   Perspective Plan", and no "works offline" said about the app's microphone.

8. **Record the WhatsApp and app screens before the shoot day, not after.** They are short beats,
   which makes them easy to postpone and easy to end up faking under time pressure. Both builds
   run today; record them while that is cheap. If the WhatsApp voice-note decode is still open on
   shoot day, record the exchange anyway — the message goes, the audio reply comes back, and that
   is what is on screen.

---

# PART D — Q&A BANK

Not in the video. Prepare these; each has been raised or is likely to be.

**"MSDE already shipped a multilingual WhatsApp skilling assistant with Meta and Sarvam. How is
this different?"**
> That one answers questions. Ours conducts a structured interview against seven mandated
> fields, gates on published NSQF entry requirements, and emits a district-level planning
> artefact on the scheme's statutory calendar. It is the officer half that makes it a PM-AJAY
> system rather than a chatbot. — *Rehearse this as one paragraph. Do not improvise it.*

**"Why is PMKVY evidence relevant to PM-AJAY?"**
> PM-AJAY's GIA skilling is executed through the same SSDMs, Sector Skill Councils, NSQF
> qualification packs and MSDE Common Norms. The failure modes are inherited.

**"The PM-AJAY portal already has district and state dashboards. Why build yours?"**
> We don't replace it. The portal has no way to collect a non-literate beneficiary's
> aspirations by voice — that is the gap, and that is our half. We produce what the officer
> uploads.

**"How many languages do you support?"**
> Languages, several. Dialects — models do exist now, including on Bhashini, and they are still
> wrong around three words in ten. We don't claim to have improved on that. The system is built
> so that a wrong transcript still produces a right field, and we publish the error rate
> alongside the extraction accuracy rather than quote one without the other.

**"Which of the three channels have you actually built?"** *(Ask this of yourselves before a judge does.)*
> All three run. The phone channel is measured over 1,822 turns. WhatsApp goes direct to Meta's
> Cloud API — HMAC-verified webhook, one question per message, replies as audio addressed by media
> id — and the voice-note decode is the last step, which is on our published FUTURE list. The app
> is a Capacitor Android build with the same interview and an offline store. — *Answer in that
> order. Naming the one open step yourself is what makes the other two claims land.*

**"Does the app work offline?"**
> The interview and the record do — answers are held on the device and sync from an outbox when
> the link comes back. Speech does not yet: it goes through Android's own recogniser, which
> usually needs a network hop. The on-device path is Vosk behind a Capacitor plugin, and it is the
> single remaining native piece. — *Never answer this one with a flat yes.*

**"Why WhatsApp as well as a call? Isn't that the same thing twice?"**
> Different failure modes. The call is synchronous and needs her free for four minutes; WhatsApp
> is asynchronous and she answers between chores. And one is a feature phone, the other is not.
> Same engine, same seven fields, same eligibility gate behind both.

**"Who holds the phone if rural women don't own one?"**
> The kiosk channel, operated by the CSC Village Level Entrepreneur. It is also the problem
> statement's own answer to "inadequate technical and support team at ground level."

**"Does experience really substitute for schooling under NSQF?"** *(Most likely question from an NCVET-aware juror. Know the limits.)*
> It trades against it, it doesn't replace it. The gazette's Level 2.5 entry row admits a
> 9th-grade pass with no experience, or a 5th-grade pass with four years of relevant work —
> same door. But above Level 2 there is always a minimum grade alongside the years, the
> experience requirement caps at five years, and **beyond Level 2.5 a formal experience
> certificate is explicitly still required**. The genuinely qualification-free route is RPL,
> and that needs an NCVET-guideline assessment. Our engine encodes the published table; it
> does not invent routes through it.

**"What's your accuracy?"**
> Two numbers, always given together: word error rate, and field-extraction accuracy. They
> diverge, and the divergence is the design. — *Have the real figures on a card before the
> pitch. Do not quote a number you have not measured.*
