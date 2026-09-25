# samples/

Audio fixtures the pipeline runs on and the tests assert against.

`raw/` is gitignored — commit `MANIFEST.md` describing what is in the set and where each
item came from, not the files. Same rule as `research/data/`.

## The dialect test set is the point of this folder

Schedule it first; it is the measurement the whole dialect claim rests on
(`docs/Utsav/research/02-tech-landscape.md` §1.2). Target shape:

- ~30 utterances per target language/dialect, answering the seven PS interview questions
- Recorded on a **phone call**, not a laptop mic — 8 kHz narrowband is the real condition
- Transcribed by the speaker, so WER is computable
- Labelled with the **correct extracted field value**, so extraction accuracy is computable
  independently of WER

That second label is what produces the key chart: WER stays bad, field accuracy
stays high.

## Consent and privacy — not negotiable here

- **Never commit a real beneficiary's voice.** Fixtures are recorded by consenting team
  members or volunteers who have been told exactly where the audio goes.
- Every contributor signs off in `MANIFEST.md`: who recorded it, when, in what language,
  and that they agreed to it being used for this project.
- No phone numbers, names, village names or caste identifiers in filenames, transcripts or
  commit messages.
- If a fixture is ever derived from a real interview, it does not belong in this repo at all.

See `docs/decisions.md` — audio is discarded after confirmed transcription in the product;
this folder is the one deliberate exception, and it exists under those rules.
