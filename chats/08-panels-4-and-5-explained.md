# Same for panel 4, then panel 5

## Query

> now let's do the same for the step 4 then for the step 5 too (do in this same reply but complete)

## Reply

## Panel 4 — WhatsApp

**The flow, plainly**

Someone holds the mic button in WhatsApp, speaks, lets go. Then:

1. **Meta pings us.** WhatsApp doesn't send us the audio. It sends a short note: *"a voice message arrived, here's its ID number."* That ping is called a **webhook** — Meta knocking on our server's door instead of us constantly asking "anything new?"
2. **We ask for the file.** We hand the ID back to Meta and get a temporary download link. Temporary on purpose — the link expires, so a leaked URL is worthless later.
3. **We download and convert it.** WhatsApp voice notes come in a compressed format (Opus). We unpack it into plain audio our speech software can read. Same idea as the resample in panel 2 — format plumbing, not quality.
4. **It joins the exact same pipeline as the phone call.** Same speech-to-text, same lexicon, same seven questions, same recommendation engine. That yellow box in the panel — *"THE SAME extraction ladder + FSM as IVR"* — is the whole point. WhatsApp is a different door into one room.
5. **We reply with a voice note.** Not text.

**"Pre-uploaded media id, reused forever"**

Our questions never change. So before launch we record all of them once, upload them to Meta once, and Meta hands back an ID per file. Afterwards, sending question 4 to anyone is just *"play file #4"* — no recording, no uploading, no delay. Same trick as the pre-recorded audio on the phone channel.

**Why we reply by voice and not text**

This is the one that matters. The PS says the whole reason this system exists is that people can't deal with text forms. If our answer comes back as a wall of Hindi text, we've recreated the problem at the last step.

*[competitor detail removed]*

**The red box — what got rejected**

WhatsApp bills per message, not per minute. So there's an obvious money-saving trick: cram 3 questions into one voice note instead of sending 3 separate ones.

We tried it, then killed it. Cramming questions together turns the conversation back into a form being read out loud — exactly what the problem statement rejects in its first sentence. And the saving is about **77 paise per person**. Not worth breaking the product for.

**The October 2026 deadline**

Right now, replying to someone who messaged you first is free. From 1 October that becomes paid after the first 1,000 messages a month. Ours assumes we pay. *[competitor detail removed]* Separately — and this one is immediate — a payment method must be on file with Meta or replies stop going out entirely.

**Going direct to Meta**

Two ways to connect: straight to Meta, or through a middleman like Twilio or Exotel. The middleman is faster to set up but takes a cut of every message and makes voice replies awkward. *[competitor detail removed]*

**What the PS says**, verbatim:

> "**WhatsApp voice-note interfaces**"

Two words doing a lot of work: *voice*, and *note*. Not "WhatsApp chatbot." The PS means audio in and — read fairly — audio out.

---

## Panel 5 — Kiosk / app / assisted mode

**What this actually is**

A small Android app. Put it on a cheap phone or a tablet at the panchayat bhavan, a Common Service Centre, or a training centre. Someone walks up, talks to it, gets a recommendation. **No internet needed at any point.**

**How it works with no network**

- **The speech software lives inside the app.** A 50 MB file on the phone itself. Nothing is sent anywhere. Less accurate than the server version — and the lexicon trick from panel 2 is what absorbs that.
- **The questions are recorded files inside the app.** Same recordings as the other two channels.
- **Answers are saved on the phone.** In the phone's own small database.
- **When signal comes back, it uploads.** The app keeps an **outbox** — like an email that sits in your drafts until you're online, then sends itself. Nobody has to remember to press sync.

**The conflict rule** — *"confirmed beats unconfirmed, later timestamp wins"*

If the same person gets interviewed twice, once offline on the kiosk and once on the phone, two versions of their answers exist. Rule: an answer they explicitly said "yes, correct" to beats one they didn't, and if both were confirmed, the newer one wins. Stops two half-finished interviews from scrambling each other.

**Assisted mode — the purple box**

Same app, but in the hands of an ASHA worker or Anganwadi worker, who runs the interview *for* the beneficiary at their doorstep.

Why this isn't optional:

- **51.6% of rural women over 15 own no mobile phone at all.**
- The PM-AJAY guidelines require **at least 30% women** in every skill programme, with a ring-fenced fund.

Put those together: a system reachable only by phone or WhatsApp cannot hit the women's target. Not "will struggle to" — *arithmetically cannot*, because half the target group has no device. *[competitor detail removed]*

**The red box under it** is a safeguard: consent is recorded as spoken by *the beneficiary*, with the worker's ID logged alongside. The worker is never allowed to consent on her behalf.

**Why this channel matters beyond coverage**

It costs **zero per interview**. No call minutes, no data, no vendor. The phone is bought once. For a scheme with a hard cap on administrative spending, a channel with no running cost is strategically different from a cheap one.

And the demo: put the phone in aeroplane mode on stage and complete a full interview. *[competitor detail removed]*

**What the PS says**, verbatim:

> "**Lightweight mobile or kiosk-based solutions**"

> "The system should also **function effectively in low connectivity and low-tech environments**"

And from the Expected Solution:

> "An AI-powered multilingual voice assistant **application**… The **app** will support regional languages and local dialects"

That last line is why the app is non-negotiable — the PS's own summary calls the deliverable "the app." But the detailed description names three channels. So the app is one of three doors, not the whole product.
