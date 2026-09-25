# Resample, ASR, where the AI actually runs, and lexicon match

## Query

*(screenshot attached: panel 2 of the diagram — "IVR: the channel the PS names first")*

> I mean I understood this but like are we taking the input then sending it to the endpoint? then what is the resample in the next part in part 3? then what is the asr? like aren't we seding the data to the ai for any processing? or are we processing at the last only? what does the ps wants? give me the exact lines from there if anyand what is that lexicon match from part 3 exaplain that again in simple terms

## Reply

Going down your list.

**"Are we taking the input then sending it to the endpoint?"**

Yes. Person talks into the phone → the telecom company streams that voice to our server as it's being spoken → our server does everything → sends audio back. The phone company is just a pipe. All the thinking happens on our machine.

**"What is resample?"**

Phone calls carry deliberately low-quality sound — telephone networks throw away most of the audio detail to save bandwidth. That's why voices sound thin on a call.

Speech software expects better-quality audio than a phone gives. So we stretch the phone audio up to the size the software expects. It's a format fix, not a quality fix — like resizing a small photo to fit a frame. Doesn't add back detail that was never there. That's part of why the accuracy is bad, and why the rest of the design assumes it will be.

**"What is ASR?"**

Automatic Speech Recognition. The speech-to-text part. Voice goes in, words come out. Same thing your phone's dictation does.

**"Aren't we sending the data to the AI? Or only at the last?"**

AI is used, but less than you'd expect, and almost never at the end.

- **Start of every turn:** yes, AI. The speech-to-text is an AI model. Unavoidable — someone has to turn sound into words.
- **Middle:** mostly *not* AI. We first try plain dictionary lookup (the lexicon, below). Only when that fails do we call an AI language model — and we give it a tiny job: *"which of these 14 options did they mean?"* Not "have a conversation."
- **End (the recommendation):** **no AI at all.** That's rules and arithmetic over government tables — who's eligible for what, which course is nearby, which one scores highest.

Reason the end has no AI: the recommendation decides whether a real person gets sent to a real training centre. If it's wrong, they show up and get turned away. A government auditor in 2030 must be able to ask "why was this person sent here" and get a straight answer — a row in a table, not "the AI felt like it."

**What the PS actually asks for** — verbatim, from `docs/PROBLEM-STATEMENT.md`:

> "there is a need for an **AI-enabled conversational system** that can interact naturally in regional languages and dialects, understand beneficiary aspirations, assess skill gaps, and recommend suitable NSQF aligned livelihood opportunities in and around the beneficiary."

> "The collected information should be **analyzed using AI/ML based profiling and recommendation mechanisms** to identify: • Suitable NSQF-aligned training programs • Relevant trades and livelihood pathways • Skill gaps requiring intervention • Region-specific employment or enterprise opportunities"

> "**IVR-based phone calls for feature phone users**"

Note what it says and doesn't. It says AI/ML should *analyse* the information. It never says the AI must *make* the final decision, and it never says the conversation must be run by a chatbot. So our split — AI for hearing and understanding, rules for deciding — satisfies it, and survives an audit.

**"What is lexicon match?"**

A lexicon is just a **dictionary of words people actually say**, per trade.

For tailoring we list every way someone might say it: *silai, darzi, silai-kadhai, thaiyal,* the Hindi spelling, the Tamil spelling, the Bhojpuri version. Maybe 20 variants. Do that for ~300 trades.

Then when speech-to-text hands us a messy sentence, we don't try to understand the sentence. We just scan it: *does any word in here look like one of my known trade words?*

The important bit: **sound-alike matching.** If the speech software mishears "silai" as "sivai", a normal text search fails. But we also store how each word *sounds*, so a near-miss still matches. That's how we survive speech-to-text being wrong one word in four.

Cheap, instant, no AI, and it handles roughly 70% of answers. The AI only gets the leftovers.
