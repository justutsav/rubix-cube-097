# Getting the IVR and WhatsApp channels live

Written 2026-09-26. Everything here that is a price or a plan detail is **⚠ unverified** unless it
links to a primary source — Indian CPaaS vendors route pricing questions to sales and publish almost
nothing. Do not put a number from this file on a slide without a written quote.

---

## 1. Exotel — what it costs and how to test it today

### The account

- **Free trial: 7 days, ₹500 of usage, no credit card.** Sign up at `my.exotel.com/auth/register`.
- **Exotel for Startups** is the better route if it applies: **₹6,000 of calls and SMS free for six
  months**, one virtual landline, two user licences at zero cost.
  ([exotel.com/exotel-for-startups](https://exotel.com/exotel-for-startups/))
- KYC and company documents are part of onboarding. Start this **first** — it is the long pole, not
  the code.

### AgentStream is a separate switch, and this is the thing to do today

The whole IVR channel depends on bidirectional WebSocket streaming, and **it is not on by default**.
Exotel's own getting-started page says to email them:

> Send an email to **hello@exotel.com** with the subject line:
> `Enable Stream/Voicebot Applet for [Your Account SID]`

([support.exotel.com](https://support.exotel.com/support/solutions/articles/3000132268-quick-guide-to-get-started-with-exotel-streaming-services))

Nothing else can be tested on a real number until that reply arrives, so send it before writing
another line of code. Exotel's published plans (Dabbler ₹9,999/5mo … Influencer ₹49,499/11mo) state
that *"Voice Streaming (Agent Stream) is available separately with additional pricing"*, so also ask
for the **AgentStream per-minute rate in writing** — the constraint audit flagged the whole channel
as sitting on an unbudgeted add-on.

### What to ask for in that email

1. AgentStream / Voicebot applet enabled on the account SID.
2. The **AgentStream per-minute rate** (⚠ unpublished).
3. The **inbound rate on an ordinary virtual number (DID)**, not toll-free.
4. Whether a **1600-series** number can be issued, and what DLT registration they require.

### Why an ordinary number and not toll-free

This reverses the original plan, and the reason is money:

| Pattern | Benchmark rate | Note |
|---|---|---|
| Inbound on a **normal DID** | **₹0.40-0.90/min** | what we now plan for |
| Inbound on **toll-free** | **₹1.20-2.50/min** | bills the *receiver* at a premium |
| Outbound to mobile via aggregator | ₹0.80-1.80/min | ([caller.digital benchmark](https://caller.digital/blog/telephony-partner-voice-ai-india-plivo-exotel-ozonetel-knowlarity-twilio-2026)) |

Toll-free was only ever chosen as a regulatory shield. The **TCCCPR Second Amendment of 12 February
2025**, new clause **(za)**, removes the need for it: a *"Government Message or Government Voice
Call"* requires **no consent** and **cannot be blocked** in the Preference Register — provided it
runs through the DLT platform. So a missed-call → callback pattern is legal, and paying the
toll-free premium buys nothing.

Two obligations attach and both must be budgeted:

1. **DLT registration as a Principal Entity is mandatory.** An unregistered sender's traffic is
   treated as UCC.
2. **A voicebot is an auto-dialer.** Service and transactional auto-dialled calls run on the
   **1600 series**, and senders must notify the originating access provider in advance.

### Test it before you have a number

`services/telephony` speaks the real AgentStream protocol, so the entire channel is testable with
no account at all:

```bash
npm run simulate -w @rc097/telephony   # scripted call, asserts a full interview completes
```

That drives `connected → start → dtmf × N → stop` against the real adapter and checks the FSM
reached a recommendation matching the entered trade. It passes today.

With an account, the loop is:

```bash
npm run telephony            # server on :5001
ngrok http 5001              # public wss:// URL
# point the Voicebot applet at wss://<id>.ngrok.app/media
```

Exotel also publish an echo server for exactly this check:
[github.com/exotel/Agent-Stream-echobot](https://github.com/exotel/Agent-Stream-echobot).

### Wire format, already implemented

JSON over WebSocket, modelled on Twilio Media Streams. Audio both ways is base64
`audio/x-l16` — **16-bit little-endian mono PCM at 8 kHz**.

```
IN   connected · start {call_sid, from, to, media_format} · media {payload} · dtmf {digit} · stop
OUT  media {payload} · clear (barge-in) · mark {name}
```

---

## 2. WhatsApp — Meta Cloud API, direct

**Direct to Meta, not through Twilio or Exotel.** No per-message markup (Exotel adds ₹0.06/message),
audio replies are straightforward on the direct API and awkward through a reseller, and a reseller's
routing pushes you toward text — for people who by definition cannot read it.

### Two dates that matter

- ⚠ **30 September 2026** — a payment method must be on file or Meta stops delivering service
  messages.
- ⚠ **1 October 2026** — service and utility messages inside an open 24-hour window become
  chargeable beyond a free monthly allowance (~1,000), at about ₹0.115 each. **Our cost model
  already assumes paid replies**; the free-tier architecture is dead.

Re-check both against Meta's published pricing page before quoting either.

### Setup

1. Meta Business account → WhatsApp Business Platform → create an app.
2. Get `META_PHONE_NUMBER_ID`, a permanent `META_ACCESS_TOKEN`, and the `META_APP_SECRET`.
3. Set the webhook to `https://<host>/whatsapp`, verify token = `META_VERIFY_TOKEN`.
4. Subscribe to the `messages` field.
5. Upload the prompt audio **once** and keep the media ids — the WhatsApp analogue of pre-rendered
   WAVs. `registerMediaId(promptId, mediaId)` in `services/telephony/src/whatsapp.ts`.

`META_APP_SECRET` is enforced: an unsigned POST is dropped. This endpoint is public and writes to a
register of caste-identified beneficiaries, so it must not accept anonymous traffic.

### One question per message — settled, do not reopen

Batching 2-3 questions into one voice note was proposed, costed and rejected. It saves **₹0.77 per
beneficiary** and turns WhatsApp into a form read aloud, which is exactly what R1 forbids and R7
penalises. If cost genuinely bites at 100k scale, batch *acknowledgement + next question* — never
question + question.

### Still missing

**Opus decoding.** WhatsApp voice notes arrive as OGG/Opus and the ASR needs PCM. ffmpeg is the
obvious decoder and is deliberately not bundled — adding a 70 MB binary to make a demo work quietly
becomes a deploy requirement. Wire it in `whatsapp.ts` where the TODO is.

---

## 3. Speech providers

Nothing here needs a key to run. `ASR_PROVIDER` selects the implementation:

| Value | What it is | Cost |
|---|---|---|
| *(unset)* | stub — returns nothing, so the FSM re-asks. The call flow is fully exercisable without a vendor | ₹0 |
| `bhashini` | Bhashini / ULCA, 22 scheduled languages | free for non-commercial |
| `sarvam` | Sarvam Saarika | ⚠ ₹30/hour of audio |

**Metered by default; self-hosted is the switch you demonstrate, not the default.** An always-on L4
costs about **₹4.29 lakh/year** whether anyone calls or not, and only beats Sarvam above roughly
**47,700 four-minute interviews per month** — two orders of magnitude above pilot scale. What breaks
a district PIU is not per-minute cost, it is a standing GPU bill they must justify before a single
call is placed.

### On the handset, right now

The Android app uses **the platform's own speech stack and no vendor at all**:

- **in:** Android `SpeechRecognizer` via `@capacitor-community/speech-recognition`
- **out:** Android TTS via `@capacitor-community/text-to-speech`

No API key, no per-call cost. Two honest caveats:

1. Android's recogniser normally needs a **network round trip** unless the user has installed an
   offline language pack — so the aeroplane-mode claim is **not yet true for speech**. Vosk
   (~50 MB/language, Apache-2.0) behind a small plugin is the real offline path and slots into
   `recognise()` in `web/app/src/lib/speech.ts`.
2. Its Hindi model is general-purpose — roughly Google STT, which scores **59.9 WER** on dialectal
   telephone Hindi. This layer is not better than the baseline; the **lexicon** is what absorbs that.

---

## 4. Order of operations

1. **Email Exotel today** — the enablement reply gates everything else on that channel.
2. Put a payment method on the Meta account before 30 September.
3. Start **DLT Principal Entity registration** — it is slow and it is mandatory.
4. Meanwhile: record the prompt WAVs, which cost nothing and unblock every channel at once.
5. Record the **30-utterance dialect test set**. It is the first thing to schedule and the first
   thing that will slip, and until it exists R2 is a claim rather than a fact.
