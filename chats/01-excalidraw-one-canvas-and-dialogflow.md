# Excalidraw format, one canvas with separate panels, and could Dialogflow do this

Three queries arrived while the diagram was being built, so one reply answers all three.
They are reproduced in the order they were sent.

## Query 1

> give the data in excalidraw format

## Query 2

> like in one complete you can give the seperate one's also in this one only

## Query 3

> and whatever you are making in the technical part, I think that you should check weather the output can be also generated from that applciation like one of my senior recomemended me https://dialogflow.cloud.google.com/#/newAgent this can also be done

## Reply

*(The diagram was rendered as an 11-panel Excalidraw canvas across four calls; the constraint-checker agent launched earlier returned during this work and its findings were folded in before answering.)*

Done. Three artefacts.

**`docs/Utsav/research/05-technical-spec.md`** — full A→B spec. One core (identity → FSM → extraction ladder → profile → recommender), three thin channel adapters over one `POST /v1/turn` contract, two outputs (spoken reco + Perspective Plan row). IVR section has the real Exotel wire protocol (verified, not guessed) *[competitor detail removed]*, the per-turn latency budget, VAD/barge-in/DTMF/drop-resume.

**Excalidraw canvas above** — 11 panels, one canvas. Zoom any panel standalone: 1 master flow · 2 IVR · 3 turn clock · 4 WhatsApp · 5 kiosk+assisted · 6 cross-channel resume · 7 FSM · 8 extraction ladder · 9 recommender · 10 cost · 11 audit findings.

**Checker agent came back hard.** 3 blockers:

1. **Resume on phone-hash leaks records.** Handset shared, not person. Brother redials, READBACK speaks sister's disability disclosure, his answers overwrite hers under her consent. Fixed: DTMF resume PIN, reveal nothing before it clears, `(phone_hash, ordinal)` key. Your "pick up where we left off" instinct was right — the keying was wrong.
2. **₹5.60/call was wrong.** Inbound toll-free bills *receiver* at ₹1.20-2.50/min (not the ₹0.80 outbound rate), Exotel AgentStream is a paid add-on, and the self-hosted GPU (₹4.29 lakh/yr idle) was excluded. Real: **₹488/head at 1,000**. Corrected design: **₹30.18 at 1,000, ₹4.04 at 100,000**.
3. **Nothing captured where the person lives.** None of the 7 PS fields is an address; NQR has no geography. R4's "region-specific" output and the entire officer half had no `GROUP BY`. Added Q0 village/block as registration metadata (so "seven fields, verbatim" stays true).

Plus 7 majors: no NEAR_MISS producer (R4's 4th output had nobody emitting it), no PM-DAKSH routing (guidelines forbid overlap by name), DPDP **Rule 11** not Rule 10 — branch on decisional capacity not disability, transcript retention undefined (now erased at CONFIRM), no outcome tracking, WhatsApp batching rejected (saves ₹0.77, costs R1+R7).

**One good surprise:** TRAI is settled and settles *for* us. TCCCPR clause (za), Feb 2025 — a "Government Voice Call" needs no consent and can't be blocked, if it runs through DLT. So missed-call→callback is legal, and we stop paying the toll-free premium for a shield we don't need. Needs DLT registration + 1600-series.

**On Dialogflow** — §11 of the spec. Short answer: **scaffold, not engine.**

It would replace our FSM + NLU and nothing else — the gate, NSQF table, NQR corpus and recommender stay our code, called from its webhook. So yes, the output can come out of it, but only by calling us. It replaces the cheapest, most auditable part and none of the hard parts.

Why it loses: its ASR **is** Google STT, which scores **59.9 WER** on dialectal telephone Hindi. Our whole thesis is an error-correction ladder over ASR *n-best*; Dialogflow hands you one transcript with no hook. Plus: cloud-only kills the offline kiosk (R6 + the ₹0 channel + the aeroplane-mode demo), it doesn't remove the Indian telephony vendor, it adds ~₹5/min audio billing on top, and it ships caste+voice+location to a US processor in a room where Bhashini is the correct answer.

What to steal: CX's per-parameter reprompt handlers — that's our sub-FSM, refined at scale. And keep it as a legit round-1 shortcut behind the turn contract if the schedule slips.

Line for your senior: *"Dialogflow's ears are Google STT — three words in five wrong on exactly our user. We'll use its slot-filling pattern, not its ears."*
