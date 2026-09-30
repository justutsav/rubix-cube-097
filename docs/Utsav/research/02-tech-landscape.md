# Technical landscape — how you'd actually build SIH26097

Research pass, 2026-09-25. Covers speech-in, speech-out, the conversation engine, the
data layer, the recommender, the four channels, and the
government prior art that will be the first question in the room.
Sibling file: `01-the-customer.md` (MoSJE, PM-AJAY GIA, NSQF/NQR, the beneficiary).

**Confidence note up front.** Vendor model names and prices for Indic speech move monthly.
Anything marked ⚠ could not be confirmed from a primary source and must be re-checked
before it goes on a slide. The WER table in §1.2 is read directly out of the Vistaar paper
PDF and is solid.

---

## 1. Speech in — and the fact that decides this entire problem

### 1.1 Telephone-quality rural Hindi destroys commercial ASR

The Vistaar benchmark (AI4Bharat, [arXiv:2305.15386](https://arxiv.org/pdf/2305.15386))
includes **GramVaani** — described in the paper as *"telephone quality speech data with
specific focus on **regional/dialectical variations of Hindi**"*, collected by the
farmer-facing NGO Gram Vaani. It is the closest public proxy that exists for "an SC
beneficiary in a Bihar village on an IVR call".

Word Error Rate, Hindi subset, Table 3 of the paper:

| Model | Kathbath (clean read) | FLEURS | IndicTTS (studio) | **GramVaani (telephone, dialectal)** | Avg |
|---|---|---|---|---|---|
| **Google STT** | 14.3 | 19.4 | 18.3 | **59.9** | 23.9 |
| IndicWav2Vec | 12.2 | 18.3 | 15.0 | **42.1** | 21.0 |
| **Azure STT** | 13.6 | 24.3 | 15.2 | **42.3** | 20.0 |
| Nvidia-large | 12.7 | 15.7 | 12.2 | **42.6** | 18.6 |
| **IndicWhisper** | 10.3 | 11.4 | 7.6 | **26.8** | 13.6 |

Read the GramVaani column as the only column that matters here.

- **Google STT loses 3 words in 5.** A studio-recorded sentence and a phone call from a
  village are, to a commercial ASR, different tasks — 18.3 vs 59.9 WER on the *same language*.
- **The best available open model still misses one word in four.** 26.8 WER is not "solved".
  It is "usable if, and only if, the system is designed to be wrong".
- Azure and Nvidia sit at ~42. The gap between the best and worst commercial option is small
  next to the gap between *any* of them and clean audio.

**This is the technical thesis of the whole project.** The naive pipeline assumes the
transcript is right and moves on. The correct architecture assumes the
transcript is 25-60% wrong and is *still* correct at the level of the extracted field — because
the field is a **classification over a closed set**, not a transcription.

> Practical form of that idea: never ask "what did they say", ask "which of these 14 options
> did they mean". `n`-best hypotheses + a phonetic/fuzzy match against a vernacular synonym
> lexicon + an explicit spoken confirmation beats a perfect-transcript fantasy. Confidence
> below threshold is not an error state, it is a **re-ask**, and a re-ask is what a sensitive
> human interviewer does anyway — which is also R7 ("empathetic, not administrative").

### 1.2 Dialects: the honest position

> **CORRECTED 2026-09-28.** The table below previously read "None" in every coverage cell.
> **That was wrong as of 2026 and it leaked into the pitch video before a fact-check caught it.**
> ASR models for all four now exist, and **Bhashini's own ASR list includes Bhojpuri and
> Chhattisgarhi** — Bhashini being a thing MoSJE funds. Never claim "no model exists"; the
> honest and still-strong claim is about **error rate**, not existence.

| Language | 2011 Census speakers | Scheduled? | Best published WER | Bhashini ASR | Sarvam | Google STT |
|---|---|---|---|---|---|---|
| Hindi, Bengali, Tamil, Telugu, Marathi, Gujarati, … (22) | — | Yes | — | Covered | Covered (Saaras V4) | Covered |
| **Bhojpuri** | **5.05 crore** | No | **27.8** | **Yes** | No | No |
| **Rajasthani** | **2.58 crore** | No | **41.8** | No (TTS only) | No | No |
| **Chhattisgarhi** | **1.62 crore** | No | **27.4** | **Yes** | No | No |
| **Magahi** | **1.27 crore** | No | **30.4** | No (TTS/MT only) | No | No |

Sum: **10.53 crore** speakers — do not round this to 11.

WER figures are avg WER from **ARTPARK-IISc SraVaani-1.0** (FastConformer ~430M, ~31,270 h
across 65 Indian languages/dialects) —
[model card](https://huggingface.co/ARTPARK-IISc/SraVaani-1.0). Also shipping now:
[RESPIN-S1.0 (IISc SPIRE)](https://spiredatasets.ee.iisc.ac.in/respincorpus) with ASR baselines
and corpora for Magahi and Chhattisgarhi, Bodhan AI Indic-Transcribe (Sept 2026) covering
Bhojpuri, and wav2vec2 Bhojpuri models on Hugging Face.
[Bhashini model list](https://dibd-bhashini.gitbook.io/bhashini-apis/available-models-for-usage).

**What survives the correction, and why the design does not change:** the best model available
still misses roughly **three words in ten**, and four in ten for Rajasthani. That is the whole
premise of `decisions.md` — "assume the transcript is wrong". A field classified over a closed
set, with phonetic matching and spoken confirmation, is the right architecture at 27.8 WER for
exactly the reason it was the right architecture at "no coverage". The argument was never
scarcity; it was error.

Sources: [Bhojpuri/Census](https://en.wikipedia.org/wiki/Bhojpuri_language),
[Shankar IAS on 2011 language data](https://www.shankariasparliament.com/article/language-data-of-2011-census).
Census 2011 lists **99 non-scheduled languages** and 147 mother tongues above 10,000 speakers.

The entire published annotated speech corpus for **Awadhi + Bhojpuri + Braj + Magahi** is
**~18 hours**, roughly 4-5 hours each, collected by field linguists
([paper](https://awesomepapers.io/speech-audio/papers/2206.12931)). Chhattisgarhi has a
100-word / 67-sentence corpus from 478 speakers
([paper](https://www.academia.edu/37030202/Chhattisgarhi_speech_corpus_for_research_and_development_in_automatic_speech_recognition)).
Whisper was trained on **680,000 hours**.

**What is achievable and what is not, in a hackathon:**

- **Not achievable:** a Bhojpuri ASR model. Do not claim one.
- **Achievable and honest:** (a) accept that a Bhojpuri speaker will be transcribed by a
  Hindi model with heavy degradation, and (b) *absorb that degradation in the matching layer* —
  a dialect **lexicon** of trade words, crop names, caste-occupation terms and local units,
  mapped to canonical concepts, with fuzzy/phonetic matching. A 300-entry Bhojpuri/Magahi trade
  lexicon is a week of work with a native speaker and it is worth more than any model swap.
- **Also achievable:** measure it. Record 30 utterances in a target dialect, publish the WER,
  and show the field-extraction accuracy *staying high while WER stays bad*. That single chart
  is the strongest slide in this deck.

### 1.3 The ASR options, compared

| Option | Coverage | Licence / cost | Telephony (8 kHz) | Verdict |
|---|---|---|---|---|
| **AI4Bharat IndicConformer-600M** ([HF](https://huggingface.co/ai4bharat/indic-conformer-600m-multilingual)) | **22 languages**, CTC + RNNT decoding | **MIT** | wants **16 kHz** — upsample from 8 kHz, expect loss | **The self-hostable default.** Reports Hindi WER 13.2 on ARTPARK-IISc Vaani-Benchmark-V1.0 |
| **IndicWhisper** (per-language Whisper-medium finetunes) | 12 languages | Whisper lineage, open | same | Best published GramVaani number (26.8). Heavier: one model per language |
| **Bhashini / ULCA** ([bhashini.gov.in](https://bhashini.gov.in/ulca)) | **22 scheduled languages**, ASR+TTS+NMT, per-language model IDs | **Free for non-commercial, discounted commercial** | hosted | **The sovereign answer, and the politically correct one for a MoSJE jury.** Model routing is per-language and coverage is uneven |
| **Sarvam Saarika / Saaras** ([pricing](https://www.sarvam.ai/api-pricing)) | Saaras v3 reports 23 languages | **₹30/hr** ⚠ (≈$0.000092/sec). **Speech models are NOT open weights** — only Sarvam's 30B/105B LLMs are Apache-2.0 on HF/AIKosh | hosted, low latency | Best DX, fastest to demo. Cloud-only lock-in |
| **Google / Azure STT** | broad | $1.44/hr and $1/hr respectively (Vistaar §4.1) | hosted | **59.9 / 42.3 WER on dialectal telephone Hindi.** Use as the *baseline you beat*, not the engine |
| **Vosk** ([alphacephei](https://alphacephei.com/vosk/android)) | 20+ languages incl. Hindi | Apache-2.0, **~50 MB models**, runs on a Raspberry Pi or a low-end Android | designed for streaming/narrowband | **The offline/kiosk answer.** Worse accuracy; but a 50 MB model on a ₹6,000 phone with no network is a capability that makes the offline kiosk possible at all |
| whisper.cpp | multilingual, quantised GGUF | MIT | CPU | Viable on-device for higher-end phones; heavier than Vosk |

**Recommendation:** **Bhashini as the declared production path, IndicConformer self-hosted as
the engine we actually run and can prove, Vosk for the offline kiosk, commercial APIs as a
swappable shim.** One provider interface, four implementations, chosen by a config value.
That posture is both defensible to a government jury and honest about the demo.

---

## 2. Speech out

| Option | Coverage | Licence / cost | Notes |
|---|---|---|---|
| **Bhashini TTS (IITM)** | the 22, incl. **Santali** and Maithili | free/discounted | Widest *sovereign* coverage. IITM TTS is the only route to Santali |
| **Sarvam Bulbul v3** ([blog](https://www.sarvam.ai/blogs/bulbul-v3)) | 11 languages today, 22 promised ⚠ | ₹15/10K chars; v3 beta ₹30/10K ⚠ | Most natural-sounding. Cloud only |
| **Pre-rendered WAV prompts** | whatever you record | free | **Do this for every fixed utterance.** See below |

**The non-obvious design point: most of what the assistant says is not dynamic.**
The seven PS-mandated questions, the consent script, the re-prompts, the acknowledgements and
the hold messages are *fixed text*. Synthesise them once, ship them as files, and TTS-at-runtime
only the personalised tail (the recommendation). That buys:

- **Latency**: zero TTS round-trip on ~80% of turns, which is the difference between a
  conversation and an interrogation over a 2G voice channel.
- **Cost**: near-zero per call.
- **Offline**: the kiosk path works with no network at all for the interview portion.
- **Quality control**: a human can listen to all 40 prompts once and fix the ones that sound
  cold — which is R7, "empathetic not administrative", done by ear rather than by prompt-engineering.

It is a well-known pattern, not a novelty — use it without claiming it as one.

---

## 3. The conversation engine

### 3.1 FSM for the interview, LLM for understanding — not the other way round

The interview has **seven mandated fields in a fixed order** (`docs/PROBLEM-STATEMENT.md` R3).
That is a **finite state machine**, not an open-ended agent. Letting an LLM decide what to ask
next on a phone call buys nothing and costs: latency, cost, reproducibility, auditability, and
the risk of the model inventing an eighth question in front of a jury.

```
FSM owns:   consent → Q1..Q7 (each: ask → listen → extract → confirm/re-ask) → readback → recommend
LLM owns:   one job per turn — "given this noisy transcript, which value of this closed
            enum did the person mean, and how confident are you?"
Code owns:  eligibility gating, ranking, all arithmetic, all NSQF level logic
```

**Why this is the defensible architecture with a government jury:** every turn is replayable,
every extraction is a logged `(transcript → enum value, confidence)` pair, and the
recommendation is produced by rules over a published framework, not by a model's opinion.
When CAG audits this in 2029, the answer to "why was this person sent to this trade" is a
row, not a prompt.

### 3.2 Structured extraction that survives a bad transcript

Per field, cheapest-first, and stop as soon as one fires:

| Layer | Cost | Catches |
|---|---|---|
| **Vernacular lexicon + fuzzy/phonetic match** over ASR `n`-best | ~0 | The 70% of answers that are one trade word (`thaiyal`, `nesavu`, `सिलाई`, `डेरी`) |
| **Numeric/level regex** — "8th", "दसवीं", "पाँचवी", "twelve years" | ~0 | Education and experience, which are the two eligibility inputs |
| **Small LLM classification into a closed enum**, constrained decoding | one short call | Everything compound or hedged |
| **Spoken confirmation** ("आपने कहा सिलाई — सही है?") | one turn | Everything the above got wrong |

The lexicon is the unglamorous, highest-leverage asset in the build. Keyword/synonym lists per
trade are the obvious first move; doing it *better* (phonetic keys, dialect variants, measured
coverage) is where the margin is.

**Embeddings for the fuzzy layer:** **MuRIL** (Google; 17 Indian languages **plus their
transliterated forms**) is the right base — the transliteration coverage matters because Indic
ASR and WhatsApp users both emit Roman-script Hindi constantly. **IndicSBERT** (L3Cube,
[paper](https://arxiv.org/pdf/2304.11434)) is MuRIL fine-tuned for sentence similarity and
reports roughly 2× the similarity quality of vanilla MuRIL on Indic pairs. Both are small
enough to run on CPU next to the API.

### 3.3 The latency budget — the thing that actually kills IVR demos

On a phone call, a human tolerates roughly **1.5-2 seconds** of silence before assuming the
line is dead. Budget, per turn:

```
caller stops speaking → VAD endpointing        200-400 ms
audio to server                                 50-150 ms
ASR                                            300-900 ms   ← the variable
extraction (lexicon hit)                          ~5 ms
extraction (LLM fallback)                      400-1200 ms  ← avoid on the common path
TTS                                              0 ms if pre-rendered, 400-900 ms if live
audio back                                      50-150 ms
```

Which is why §2's pre-rendered prompts and §3.2's lexicon-first ordering are not
micro-optimisations — they are what keeps the common path under two seconds. Budget the
LLM call for the *uncommon* path and play a 300 ms "हम्म…" acknowledgement over it.

### 3.4 Which LLM

The LLM's job here is narrow: noisy-text → enum, and a short empathetic phrasing at the end.
That is a **small-model job**.

| Model | Size | Licence | Fit |
|---|---|---|---|
| **Sarvam-30B** (MoE, ~10.3B active) | 30B | **Apache-2.0**, on HF and **AIKosh** | The jury-aligned choice; trained for Indian languages; "deployable from Government-sanctioned infrastructure" is a true sentence |
| **Gemma 3 4B / 12B** | small | Gemma licence (read the use restrictions) | Strong multilingual for size |
| **Qwen3-8B / 14B** | small | Apache-2.0 | Clean licence, good structured output |
| Gemini Flash / Groq Llama-3.3-70B | — | cloud | Fine for the demo; the default choice, so it is not a differentiator |

**Position:** cloud for speed during the demo, **one config value** to a self-hosted
Sarvam-30B or Qwen3-8B, and *show the switch working*. Unlike PS 26154, air-gap is **not** a
requirement here — but *sovereign stack* is a live political preference in a MoSJE room, and
Bhashini exists, so "we use Google" is a weak answer.

---

## 4. The data layer — where the real work is

Four datasets. None needs a scraper of the fragile kind; all are public.

### 4.1 NQR — the qualification corpus

`nqr.gov.in` publishes **2,814 NSQF-aligned qualifications** across **59 sectors** and
**115+ awarding bodies**, filterable by education level, prior vocational qualification,
experience, sector, notional hours, NSQF level and qualification type, with an official
**"Download File"** export button.

The mechanism:
`POST https://www.nqr.gov.in/downloadSummaryFile` returns an **XLSX with 2,814 rows**, with
`robots.txt` at `User-agent: * / allow: /`. Reproduced end to end in
`research/03-nqr-import.md` — the entire qualification corpus is one
authenticated-session POST, not a scrape, and the per-qualification detail pages
(`GET /qualifications/<id>`, server-rendered, carrying eligibility and NOS tables) are the
enrichment layer.

**Rule to adopt from them, because it is correct:** *fields the official source does not
provide are NULL, not guessed*. No invented QP codes, no invented NSQF levels, no invented
durations. In a scheme where a wrong QP code sends a real person to a real training centre that
will not admit them, a fabricated identifier is a defect, not a rounding error.

### 4.2 NSQF entry requirements — the eligibility table

The NSQF 2023 gazette Annexure gives, per level, minimum education **and the experience
substitutions** (`01-the-customer.md` §7). ~13 levels × a handful of rows. **Type it in by
hand.** It is the eligibility engine and it is under 100 rows.

### 4.3 NCO-2015 — the occupation bridge, with a known 19% defect

**NCO-2015** (DGE, MoLE) uses an **eight-digit code where the last two digits after the decimal
encode the QP-NOS** — `01-98` when a QP exists, `00` when it does not
([Vol I](https://dge.gov.in/dge/sites/default/files/2023-07/National_Classification_of_Occupations_Vol_I-2015.pdf),
[Vol II-A](https://dge.gov.in/dge/sites/default/files/2022-07/National_Classification_of_Occupations_Vol_II-A-2015.pdf)).
So the occupation→qualification bridge is *built into the code itself*.

But NCVET's own audit of it found **156 of 2,157 qualifications incorrectly mapped and 256
unmappable** (`01-the-customer.md` §7). **Use NCO as a signal, never as the sole authority**,
and keep a hand-curated override table for the Annexure-I trades that actually matter to
PM-AJAY. Showing that you know the mapping is broken is worth more than pretending it is clean.

### 4.4 Local opportunity — the honest hard one

R4 asks for *"region-specific employment or enterprise opportunities"*. Candidate sources:

| Source | What it gives | Reality |
|---|---|---|
| **NCS** (National Career Service) + **JobX**, surfaced via **Skill India Digital Hub** Job Exchange | Live vacancies by district | Best available. **UNVERIFIED — whether any public API exists** vs. portal-only |
| **e-Shram** | Unorganised-worker registry, now integrated with SIDH | National, occupation-tagged. Access is government-to-government |
| **NSDC / SSC Skill Gap studies**, District/State Skill Development Plans | The thing the PM-AJAY guidelines *require* be "factored" | Published as PDFs per state/district, uneven vintage |
| **MSME / Udyam registry**, district industrial profiles | Enterprise density by sector by district — a proxy for where a trade can actually be practised | Public |
| **Training centre locations** (SIDH centre locator, ITI directory) | Can this person physically reach a centre — which is exactly the PS's *"mobility constraints"* field | Public, geocodable |

**The lazy-and-correct move:** do not promise a live national labour-market feed. Ship a
**district opportunity table** — 2-3 pilot districts, hand-assembled from published sources,
every row carrying `source` and `source_date` — and make the *architecture* pluggable. A
demo with three honest districts beats a national map built on invented numbers, and it is
the only version that survives a question from someone who works in one of those districts.

---

## 5. The recommender

### 5.1 Gate, then rank. Never rank, then gate.

```
Stage 0  Eligibility gate (hard, rules-only)
         NSQF entry requirement vs (education ∪ experience-substitution)
         age 18-45 if routing to PM-DAKSH · physical constraint vs job-role demands
         travel feasibility vs nearest centre
         → produces ELIGIBLE / NEAR-MISS (with the exact gap) / INELIGIBLE

Stage 1  Candidate retrieval over the ELIGIBLE set
         lexicon/embedding match: stated skills + family occupation + interests
         → top ~30

Stage 2  Rank, with weights that are written down
         aspiration fit · existing-skill overlap (RPL shortcut) · local opportunity
         · self-employment vs wage preference · duration vs mobility
         · asset-grant eligibility (₹50k cap) · women's 15%/30% targets

Stage 3  Explain, out loud, in one sentence per reason
```

**Stage 0 is the whole product's integrity.** A recommendation the person cannot enrol in is
worse than silence — it is the CAG's 41% placement number being manufactured one call at a
time. And **NEAR-MISS is a feature**: *"you need one more year of experience, or the Level 2
course first"* is a pathway, which is literally R4's "skill gaps requiring intervention".

**Ranking method:** a weighted score with documented weights is enough. AHP/TOPSIS is the
tempting alternative; it is defensible and it looks rigorous, but the honest version is that
the weights are judgement calls either way. Prefer **written-down linear weights + a
sensitivity table** over a technique whose main function is to make judgement calls look
derived. If the deck needs the letters, add TOPSIS in an afternoon — it is 40 lines.

### 5.2 Explainability is a requirement, not a nicety

Three audiences need three explanations of the same recommendation
(`01-the-customer.md` §10): the beneficiary needs one spoken sentence; the officer needs the
matched fields and the eligibility proof; the auditor needs the stored inputs, weights and
version. Emit all three from the same scored object. This is cheap if designed in on day one
and impossible to retrofit.

### 5.3 Measure spread, not just relevance

CAG's finding — 40% of national certifications in 10 job-roles, 90% of "Green Jobs" in one —
is the failure mode to *instrument against*. Run the recommender over a synthetic district
cohort and plot the distribution of recommended trades. If it concentrates like PMKVY did, the
model is reproducing the bias. **This chart is the single most SIH-jury-legible artefact in
the project.**

---

## 7. Government and commercial prior art — what the room already knows

### 7.1 SIA — this exists, it is MoSJE's sister ministry, and it will be the first question

**Skill India Assistant (SIA)**, launched **17 May 2025** by **MSDE**, built by **Meta + NSDC**
and implemented by **Sarvam AI** on **Meta's open-source Llama**
([inc42](https://inc42.com/buzz/skill-ministry-launches-ai-chatbot-for-upskilling-in-partnership-with-meta-sarvamai/),
[PIB PRID=2146573](https://www.pib.gov.in/PressReleasePage.aspx?PRID=2146573) — PIB 403s to
automated fetch).

- **Delivered over WhatsApp**, at **+91 8448684032**, plus in Skill India Digital Hub.
- **Voice notes and text.** English, Hindi and Hinglish.
- Does: course recommendations, **nearby training-centre locator**, **job listings**, quizzes,
  doubt-clearing.
- Described as *"the first large-scale deployment of open-source AI within a national public
  skilling mission"*.

And **SIDH 2.0** now advertises e-Shram integration, digitally verifiable credentials, NCS +
JobX job access, and *"multilingual support in 22 languages with Bhashini"*, over 1.5 crore
registered candidates.

> **Read that list against the PS.** Multilingual voice assistant on WhatsApp, recommending
> NSQF courses, locating centres, surfacing jobs — shipped, by the Government of India,
> sixteen months ago. Somebody in that room knows this. **Have the answer rehearsed:**
>
> SIA is a **national, English/Hindi/Hinglish, smartphone-and-WhatsApp, self-service course
> discovery bot**. SIH26097 asks for a **scheme-specific instrument for the GIA component**:
> it must reach a **feature phone over IVR**, work in **dialects that are not in Bhashini's
> 22**, run the **seven PS-mandated interview fields** as a consented record, gate on
> **NSQF eligibility** rather than suggest, route away to **PM-DAKSH** where the guidelines
> require it, and **aggregate to a district Perspective Plan** for a DL-PACC chaired by
> the Collector. SIA does none of those six. We are not rebuilding SIA; we are building the
> thing that feeds PM-AJAY's own planning machinery, for the people SIA cannot reach.
>
> Also say the useful part out loud: **where SIA already works, route to it.** A system that
> knows when to hand off is more credible than one that pretends to be alone in the field.

### 7.2 The rest of the field

| System | What it establishes |
|---|---|
| **Jugalbandi** (Microsoft + AI4Bharat, 2023) | The reference architecture, already proven: WhatsApp audio → AI4Bharat ASR → Bhashini translate → LLM → TTS → WhatsApp. **10 of 22 languages, 171 government programmes.** Nobody needs convincing that the pipeline works ([Microsoft](https://news.microsoft.com/source/asia/features/with-help-from-next-generation-ai-indian-villagers-gain-easier-access-to-government-services/)) |
| **Gram Vaani / Mobile Vaani** | **3 million users** on an IVR platform across north and central India — proof that voice-over-phone at scale in rural India is an operating business, not a hypothesis. Also the source of the GramVaani benchmark in §1 |
| **Digital Green Farmer.Chat** | **670,000+ farmers** across India/Kenya/Ethiopia/Nigeria, text+image+voice, with **25,000+ expert-reviewed Q&A pairs** used for RLHF. Establishes the standard for "grounded in reviewed domain content", and that the expensive part is the review corpus, not the model |
| **PM-DAKSH portal + app** (MoSJE's own, since Aug 2021) | The ministry has already shipped a beneficiary-facing skilling app. Ours must be visibly *different in kind*, not a prettier version |
| **e-Shram, NCS, DigiLocker, PFMS** | The integration surface a government jury expects to hear named — and, via SIDH, already integrated with each other |

**The positioning sentence, one line:** *SIA is discovery for people who can already find it;
this is outreach, eligibility and district planning for people who cannot.*

---

## 8. Channels

| Channel | Stack | Cost | Notes |
|---|---|---|---|
| **IVR** (R5, first-named) | **Exotel** ₹0.80-1.00/min outbound vs **Twilio** ₹1.20-1.50 ⚠; Exotel's **Voicebot Applet** does bidirectional WebSocket streaming ([Exotel](https://exotel.com/blog/voice-ai-infrastructure-exotel-agentstream/)) | per-minute | **Prefer Exotel**: INR billing, TRAI-compliant numbers, India-local media path. An **inbound toll-free** number avoids the outbound-calling regulatory question entirely (`01-the-customer.md` §9.2) |
| **WhatsApp voice notes** (R5) | Meta Cloud API | India, from July 2025: **₹0.87 marketing / ₹0.12 utility / ₹0.11 authentication per message**; **service messages inside the 24-hour window currently free** ⚠ | ⚠ **Meta has announced that from 1 October 2026 service and utility messages inside an open 24-hour window become chargeable.** That is days away. Re-check before any cost slide; the "free if they message first" architecture may be dead |
| **Kiosk / lightweight app** (R5, R8) | Android, **Vosk 50 MB offline ASR**, pre-rendered prompt audio, local SQLite, sync when there is signal | zero marginal | Aeroplane-mode a phone on stage and complete an interview. An offline-first web app is not enough — speech must also run on the device |
| **Assisted mode** (not in the PS, required by reality) | The same kiosk app, in the hands of an ASHA/AWW/VLCC member | zero | See `01-the-customer.md` §8: 51.6% of rural women 15+ own no phone, and the guidelines mandate 30% women. Without this, the women's target is unreachable |

**Channel-independence is the architectural requirement.** One interview FSM, one extraction
service, one recommender; four thin transports. If the FSM lives inside the IVR handler, the
WhatsApp path becomes a second implementation of the same seven questions and they drift apart
by day three.

---

## Recommended stack

| Layer | Pick | Justification |
|---|---|---|
| **ASR** | **IndicConformer-600M (MIT), self-hosted**; Bhashini as the declared sovereign path; Vosk on-device for kiosk; Sarvam/Google as swappable shims | Only field where a self-hosted model exists at all; MIT licence; the demo can run with the network off |
| **Robustness to bad ASR** | ASR `n`-best → **dialect/trade lexicon with phonetic + fuzzy match** → small-LLM enum classification → **spoken confirmation** | GramVaani WER is 26.8 at best and 59.9 with Google. The field is a classification, not a transcription |
| **TTS** | **Pre-rendered WAV for all fixed prompts**; Bhashini IITM for the dynamic tail; Sarvam Bulbul if budget allows | Kills the latency and cost on ~80% of turns and makes the kiosk work offline |
| **Dialogue** | **Explicit FSM** over the seven PS fields, with per-field resume, re-ask and confirmation states | Auditable, replayable, cheap; matches R3 literally; an LLM planner buys nothing here |
| **LLM** | Small model, one narrow job per turn, constrained to enums. **Sarvam-30B (Apache-2.0, on AIKosh)** as the sovereign option, Qwen3-8B as the clean-licence option, cloud for demo speed behind one config value | The switch is the differentiator, not the model |
| **Embeddings** | **MuRIL** (17 Indian languages **+ transliterated**), **IndicSBERT** for similarity | Roman-script Hindi is everywhere in ASR output and WhatsApp; MuRIL is the only base that handles it natively |
| **Qualification corpus** | **Official NQR export** (2,814 rows), every field NULL-if-absent, `source` + `source_date` on every record, committed snapshot as fallback | Reproduced in `research/03-nqr-import.md`. Provenance is the credibility |
| **Eligibility** | **Hard gate before ranking**, from the NSQF 2023 entry-requirement table, incl. experience substitution and NEAR-MISS with the exact gap | A recommendation you cannot enrol in is the failure the PS describes |
| **Ranking** | Weighted score with written-down weights + a sensitivity table; TOPSIS only if the deck wants the letters | Honest about where the judgement lives |
| **Occupation bridge** | NCO-2015 eight-digit codes as a **signal**, hand-curated overrides for PM-AJAY Annexure-I trades | NCVET's own audit: 156 mis-mapped, 256 unmappable of 2,157 |
| **Opportunity data** | **Two or three pilot districts**, hand-assembled from published sources, every row sourced and dated; pluggable for NCS/e-Shram | A national map built on invented numbers loses to three honest districts |
| **Channels** | Exotel inbound IVR · WhatsApp Cloud API · offline Android kiosk (Vosk) · assisted mode — all over **one** FSM/extractor/recommender core | R5 names three; reality needs the fourth |
| **Officer surface** | District demand aggregation → **Perspective Plan input** (due 1st week of April), PM-DAKSH routing, consent register, outcome tracking | Four of five "Basic Issues"; the differentiator is producing the statutory artefact, not the screen |
| **Privacy** | Transcribe → normalise → confirm → **discard audio**; explicit consent state in the FSM; guardian-consent path when a disability is disclosed | DPDP Rules 2025 are in force; the PS's own schema triggers Rule 10 |
| **App** | FastAPI (or Node) + Postgres + Redis; stateless channel adapters; everything session-keyed and resumable | Calls drop. Resume is not a feature, it is the baseline |

---

## What is genuinely hard — ranked by risk

1. **Being honest about dialects without sounding weak.** The truthful position — "no ASR
   model exists for Bhojpuri; we absorb the error in the matching layer and here is the
   measurement" — is stronger than a claim, but only if the measurement exists. Building a
   30-utterance dialect test set with a real speaker is the first thing to schedule and the
   first thing that will slip.
2. **Latency on a real phone call.** Two seconds end-to-end, over a 2G voice channel, with ASR
   in the loop. Pre-rendered prompts and lexicon-first extraction get you there on the common
   path; one careless LLM call on the hot path destroys it, and it only shows up on a live
   call, never in local testing.
3. **The interview feeling human (R7).** This is a writing problem, not an engineering one.
   Seven questions, four re-prompts each, five languages, with the right register — warm,
   short, no scheme jargon, no "please state your educational qualification". It needs a
   native speaker and several rounds, and it is the thing the demo video is entirely made of.
4. **Eligibility logic that is actually right.** The framework's thirteen levels, experience substitutions,
   multiple alternative entry routes per level, and a 19%-broken NCO mapping underneath. Getting
   this wrong is invisible in a demo and fatal in an audit.
5. **Opportunity data that is real.** The temptation to fabricate a district jobs feed will be
   enormous, and a jury member from that district will know. Three honest districts, sourced.
6. **The officer half being more than a dashboard screenshot.** A district demand report has to
   match what a DL-PACC actually puts in a **Perspective Plan**, projecting 3.5-4× the notional
   allocation, by the first week of April. That means reading the Perspective Plan
   format on the PM-AJAY portal by hand — which nobody has done yet, because the portal's TLS
   chain broke our fetch.
7. **Consent and DPDP done properly without making the call feel like a legal notice.** The
   consent script is the first thing the beneficiary hears, and it has to be both compliant and
   under fifteen seconds. Getting a spoken, logged, withdrawable consent that a PwD guardian
   path branches off is real design work, not a checkbox.
8. **Resisting the urge to build an agent.** An LLM that "conducts the interview" is the
   demo-day trap: it is slower, unreproducible, wanders off-script in front of judges, and
   throws away the one thing that makes this auditable. Seven questions, in order, by a state
   machine.
