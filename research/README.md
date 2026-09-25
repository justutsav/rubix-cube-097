# research/

Experiments that decide what `ai/` ships. Messy is fine here.

**Nothing in `ai/` imports from `research/`.** This folder proves a choice; `ai/`
runs it. When an experiment wins, port the code across and log the verdict in
`RESULTS.md`.

`data/` is gitignored — commit a manifest describing the sets, not the files.

## The four experiments that decide the build

| # | Question | Winning condition |
|---|---|---|
| 1 | **ASR bake-off on real telephone audio** — IndicConformer vs Bhashini vs Sarvam vs Google, over `samples/` at 8 kHz | A WER table we can publish, and a per-field extraction-accuracy table beside it |
| 2 | **Lexicon vs LLM for field extraction** — how far does a vernacular trade lexicon with phonetic matching get, before any model is called? | % of turns resolved by lexicon alone. Anything above ~70% settles the latency design |
| 3 | **NQR import** — does `POST /downloadSummaryFile` actually return 2,814 rows, and what columns survive normalisation? | ✅ **Done — [`03-nqr-import.md`](./03-nqr-import.md).** Yes, reproduced 2026-09-25: 2,814 rows, 18 columns, 45 sectors, 1,934 valid / 880 expired, 11 data-quality findings |
| 4 | **Recommendation spread** — run the recommender over a synthetic district cohort | The trade distribution does *not* look like CAG Table 2.1(a) |

Experiment 1 now gates everything else. Do it first.
