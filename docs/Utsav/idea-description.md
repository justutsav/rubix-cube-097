*Problem Statement 26097, Ministry of Social Justice and Empowerment. AI driven voice assistant
for livelihood mapping and NSQF aligned skilling recommendations for SC communities under the
GIA component of PM-AJAY. Team RUBIX CUBE, Team ID 140224.*

## The problem we are solving

PM-AJAY supports livelihood promotion, skill development and income generating activities for
Scheduled Caste communities through its Grant in Aid component. For many beneficiaries, the
trouble starts well before the training centre. A person who is not comfortable with reading,
typing or moving through online menus finds a text heavy process hard to finish on her own.

If she has to open several pages, understand eligibility rules and fill forms, she either asks
someone else to do it for her or she stops halfway. It gets harder when the information is not
available in the language she actually speaks at home.

The result is a mismatch between the person, the training programme and the work available near
her. Someone may pick a course without knowing that she does not meet its entry requirement.
Someone else may finish a trade that has very little demand in her district. The 2025 CAG
performance audit of PMKVY found that 23.18 lakh of 56.14 lakh candidates certified under the
Short Term Training and Special Projects components were placed, which is about 41 percent. We
use that number the way it should be used: as evidence that certification alone does not create
employment, not as a PM-AJAY figure.

The scale is worth stating plainly. Census 2011 counts 20.14 crore Scheduled Caste people, which
is 16.63 percent of the population. 76.4 percent of them live in rural areas. SC literacy was
66.07 percent against an overall 72.98 percent, a gap of 6.91 percentage points. Under PM-AJAY,
Grant in Aid work has been reported as benefiting 34.61 lakh people, and the Adarsh Gram
component reports 47.59 lakh beneficiaries.

The problem statement also lists five basic issues under GIA. Four of them are not about the
beneficiary at all. They are about officers: no proper road map for perspective planning,
difficulty identifying trained and skilled participants, placement after training, coordination
between the corporation and departments, and thin technical support on the ground. Any solution
that only builds a beneficiary app answers one issue out of five.

## Our solution in one line

Kaushal Saathi is a multilingual, voice first livelihood mapping system. The beneficiary talks,
the system listens, checks what she is eligible for, and maps her to a training pathway and to
work available around her. The same records give district and state officers the planning view
they are missing today.

The flow is simple to describe: talk, understand, check, map, guide, and then plan.

## How the beneficiary side works

Instead of typing, the person answers a few short questions in her own language. The interview
collects exactly the fields the problem statement names: education, existing or family
occupation, current livelihood, skills and interests, mobility or physical constraints,
preference for self employment or wage work, and the local situation around her.

Take an example. Sunita calls the number from a basic phone in her village. She answers in
Bhojpuri mixed Hindi. She says she has studied till class eight, that her family does tailoring,
that she has done it for twelve years, and that she cannot travel far from the block. The system
turns that conversation into a structured profile, reads the important parts back to her for
confirmation, checks the entry requirements of the relevant NSQF qualifications, tells her which
pathway she qualifies for today, tells her exactly what is missing for the one she does not, and
lists the training centres and work opportunities near her block.

Three things about this are worth pointing out.

**We check before we map.** A normal chatbot answers a question about courses with a list of
courses. Our engine first compares her education and experience against the published entry
requirements of the qualification. If she does not qualify, it does not quietly recommend the
course. It names the exact requirement that is missing. That is what the problem statement calls
skill gaps requiring intervention, and it is the difference between a recommendation she can act
on and one that sends her to a centre that will turn her away.

**One system, several doors.** The same interview runs over a normal phone call through IVR, over
WhatsApp voice notes, and through a light mobile or kiosk app. IVR matters because a person with
a feature phone and no internet is exactly the person this scheme is for. The kiosk mode also
covers assisted use, where a CSC operator or a family member holds the phone, because a large
share of rural women do not own a handset of their own.

**One profile, not scattered answers.** Everything collected becomes a structured livelihood
profile: education, existing skills, traditional occupation, interests, identified skill gaps and
constraints. The beneficiary and the authorised officer look at the same record instead of two
different half records.

If the call drops, the session is saved. She continues from the last question she answered
instead of starting again.

## The local employer side

This is the piece that closes the loop between training and work.

A verified local employer or small business can sign in and post the work they actually have:
the trade, the number of people needed, the block or village, and the basic requirement. Those
vacancies enter the same shared database that the recommendation engine reads from.

So when the engine ranks pathways for Sunita, it is not only matching her to a course. It is
matching her to a course that leads to work someone nearby has said, in writing, that they need.
The officer dashboard sees the same thing from the other side: which trades employers in the
district are asking for, and whether the training being funded points in that direction.

Verification matters here, so employers are onboarded and marked as verified before their
postings are used, and every opportunity row carries its source and the date it was added.

## The government side

As beneficiaries use the service, the system builds up structured demand information: which
trades people are asking for, which skill gaps keep repeating, which blocks they come from, and
what happened after the recommendation.

District and state officers get a dashboard over that data with role based access. It shows
district performance, beneficiary monitoring, commonly requested trades, employer demand and open
local issues. Officers can use it as an additional input while planning PM-AJAY projects, instead
of depending only on periodic manual collection.

The useful part is the timing. The revised PM-AJAY guidelines of May 2023 run on a calendar:
districts send their proposals in the first week of April, the state prioritises by 15 April and
forwards by 21 April. Our output is shaped to be the input for that Perspective Plan, in the form
the officer uploads. We do not claim an integration with the PM-AJAY portal, because no public
API for it exists. We produce the content the officer needs and let the officer file it.

## Follow up, and learning from outcomes

After the recommendation, the system can call or message the beneficiary about training dates,
pending steps and next actions. This is the part that reduces drop off, and we describe it as
planned rather than finished.

Outcomes feed back in. When a beneficiary joins, completes or gets placed, that result is
recorded against the pathway that was recommended. Over time the ranking improves on evidence
from the district itself rather than on assumptions.

## How the technology works

Speech comes in over IVR, WhatsApp or the app. Audio is cleaned, then converted to text using
Bhashini and Sarvam for Indian languages. A fixed interview flow controls the questions, and the
language model is used only for a narrow job: deciding which value from a closed list the person
meant, with a confidence score. Low confidence is a repeat question, not an error. Keypad input
is always available as a fallback.

Extracted fields go into the profile and session store, so every turn is saved and resumable. The
recommendation engine runs rule based NSQF prerequisite checks, then ranks the eligible pathways
against her skills, interests, location and the local vacancies. The reply is converted back to
speech in the same language and returned on the same channel she came in on.

Fixed prompts such as consent, the seven questions and the confirmations are pre recorded audio
files. Only the personalised part is synthesised live. That keeps a turn fast on a phone line,
keeps cost low and lets the kiosk work with poor connectivity.

Qualification data is imported from the National Qualification Register, which is the official
record of NSQF aligned qualifications. We do not invent QP codes or levels. If the source does
not give a field, we leave it empty rather than fill it with a guess.

The stack is a React and Capacitor app for mobile and kiosk, a Python and FastAPI service layer,
Postgres through Supabase for storage, Exotel for telephony, the WhatsApp Cloud API for voice
notes, and standard cloud hosting with containers behind a load balancer.

## What we are careful not to claim

Dialects are the honest part of this idea. Models do exist for Bhojpuri, Magahi, Chhattisgarhi
and Rajasthani, including on Bhashini. They are also still wrong about three words in ten, and
closer to four in ten for Rajasthani, going by the best published error rates. So we do not claim
better speech accuracy than anyone else. We design around it: short questions, answers matched
against a closed list of trades and options, phonetic matching for local trade words, spoken read
back for confirmation, and a keypad fallback. A wrong transcript can still produce a right
answer.

We also have not done field surveys for this problem statement. Everything above rests on
published sources: the PM-AJAY guidelines, the NSQF gazette, the National Qualification Register,
the CAG audit and Census data.

## Data privacy

We collect only what the eligibility and mapping actually need. Consent is spoken, logged and can
be withdrawn. Raw audio is discarded once the transcription is confirmed, since it is the most
sensitive thing the system would ever hold and the least necessary to keep. Access is role based,
sign in is OTP based with short lived tokens, and identifying details are kept separate from the
aggregated planning data. The design follows the Digital Personal Data Protection Act, 2023 and
the 2025 rules.

## Challenges and how we handle them

**Weak networks.** Calls drop in rural areas. Sessions are saved after every answered question,
so the beneficiary resumes instead of restarting.

**Dialect and informal speech.** Handled by short questions, closed option matching, read back
confirmation and a keypad fallback, as described above.

**Voice delay.** Common prompts are pre recorded and the heavy processing is kept off the call
path, so replies stay quick.

**Local relevance.** Village and block are captured with the profile, and eligibility is applied
before ranking, so recommendations stay specific to where the person actually lives.

**Fragmented implementation.** One shared record connects the beneficiary, the training pathway,
the local employer demand and the officer view, which is what the coordination issue in the
problem statement is asking for.

## References we relied on

Ministry of Social Justice and Empowerment, PM-AJAY and its Grant in Aid component.

PM-AJAY revised guidelines, May 2023, including the skilling clauses and the perspective planning
calendar.

NCVET National Qualification Register, the official list of NSQF aligned qualifications.

Ministry of Skill Development and Entrepreneurship, Skill India Digital, for existing training
and employment information.

CAG Report No. 20 of 2025, performance audit of PMKVY, for the certification against placement
figures.

Census 2011 for Scheduled Caste population, rural share and literacy.

da Silva and others, 2024, on how low literacy users interact with voice assistants. White and
others, 2012, on a voice based employment exchange for rural India. Dave and others, 2018, on job
and skill recommendation using job and skill relationships.
