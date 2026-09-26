# Design system — plum + beige, two registers

Written 2026-09-26. Three iterations, each rated against the *actual* user before the next
one started. The rating is not politeness; iterations 1 and 2 were rejected and are recorded
so nobody re-proposes them in week three.

## Who is looking at the screen

Three people, and they do not share a visual language:

| Reader | Condition | Consequence |
|---|---|---|
| **Beneficiary** | low literacy, ₹6,000 phone, outdoors in sunlight, possibly 55+, holding the phone in one hand | text is decoration, not instruction · every string needs an audio twin · one decision per screen · ≥56 px targets · high contrast, not tasteful contrast |
| **Mobiliser** (ASHA / AWW / VLCC) | literate, doing 12 doorsteps in an afternoon, offline | speed and a list · status legible at a glance · no chrome between her and "next person" |
| **Officer** (District PIU / DL-PACC) | literate, indoors, desktop or tablet, needs density | tables, charts, exports, filters. Density is *correct* here |

A single design language cannot serve the first and the third. That is the finding the third
iteration is built on.

## Iteration 1 — "Warm Editorial Plum" · rated 5/10 · rejected

Beige paper ground, deep plum serif display type, thin rules, generous whitespace, plum text
on cream. Looks like a good magazine.

Why it fails: cream-on-cream is ~3:1 and disappears in direct sunlight, which is the *normal*
lighting condition for a doorstep interview. Serif display at 8 px stroke contrast is the
worst possible choice for a 55-year-old with uncorrected vision. Whitespace pushes the primary
action out of the thumb zone. It is a wedding invitation wearing a government scheme.

## Iteration 2 — "Plum Card Dashboard" · rated 6/10 · rejected for the field, kept for the officer

White cards on beige, plum primary buttons, `rounded-2xl`, chips, small muted labels — the
default 2026 SaaS look.

Why it fails for the beneficiary: it presents six affordances at once when the interview
allows exactly one. Chips are 28 px in a 44 px world. The card border is chrome that means
nothing to someone who cannot read the label inside it. It is, however, exactly right for the
officer console, so it survives there.

## Iteration 3 — two registers over one token set · rated 9/10 · shipped

**Register A — "Big Voice."** For the beneficiary and the doorstep. No cards: the screen *is*
the card. Active question = full-bleed plum surface, resting = beige. One primary action
occupying the bottom third, mic 96 px, centred in the thumb arc. Body type starts at 20 px,
never below 17 px. Seven progress beads instead of "Question 4 of 7". Every prompt line
carries a ▶ replay button wired to the same prompt id the IVR channel plays, so what she hears
on the phone and what she hears on the kiosk are the same audio file (spec §1.1).

**Register B — "Dense Plum."** For the officer console. Iteration 2, kept deliberately: cards,
tables, a spread histogram, export buttons, plum headers on beige. The officer earns the chrome.

Both registers read from one token file, so a palette change is one edit and the two halves
can never drift into two different products.

## Palette

Plum and beige are the given pair. They cannot carry state on their own — plum is the brand
*and* would be the "active" colour, and beige has no states at all. So two functional accents
were chosen against them: **amber** (warm, reads as "act / almost") and **teal** (cool, reads
as "confirmed / eligible"). Amber↔teal is distinguishable under every common form of colour
blindness, which green↔red is not, and both clear 4.5:1 on beige.

| Token | Hex | Job |
|---|---|---|
| `plum-900` | `#2A0E27` | ink on beige — 13.9:1 |
| `plum-800` | `#3B1436` | active question surface |
| `plum-700` | `#5B2150` | primary button |
| `plum-600` | `#7A2E6C` | primary hover / links |
| `plum-300` | `#C89BBE` | borders and muted text *on plum* |
| `plum-100` | `#F3E4EF` | selected tint on beige |
| `beige-50` | `#FBF7F0` | page |
| `beige-100` | `#F7F1E7` | page alt / resting card |
| `beige-200` | `#EFE5D5` | hairline border |
| `beige-300` | `#E0D2BC` | strong border, disabled fill |
| `sand-700` | `#8A7A63` | muted text on beige — 4.6:1 |
| `amber-500` | `#D98324` | NEAR-MISS, "do this Monday", unsourced-data warning |
| `amber-100` | `#FBEBD7` | amber fill |
| `teal-600` | `#0F766E` | ELIGIBLE, confirmed answer, synced |
| `teal-100` | `#D7EDE9` | teal fill |
| `rose-600` | `#B3261E` | INELIGIBLE, error, consent withdrawn |
| `rose-100` | `#FBE4E2` | rose fill |

Contrast floor is AA (4.5:1) for every text pair actually used; the beneficiary register holds
itself to AAA (7:1) because of the sunlight case. `plum-300` is never used for text on beige —
only on `plum-800`.

## Type

One family, `Inter` with `Noto Sans Devanagari` for Indic, both variable, self-hosted (the app
must load offline — no Google Fonts CDN call). No serif anywhere. Scale:

`display 34 / title 26 / lead 22 / body 20 / body-sm 17 / label 15 / mono 14`

The beneficiary register never uses `label`. Devanagari renders ~8% smaller at the same px, so
Indic strings get `1.08em` applied at the component level.

## Non-negotiables baked into components, not guidelines

1. Every beneficiary-facing string has a `promptId`; the `<Speak>` component renders the text
   *and* the replay control from that one id. A string with no prompt id fails a lint test.
2. Tap targets ≥ 56 px in register A, ≥ 44 px in register B.
3. State is never colour alone — every status chip carries an icon and a word.
4. Focus rings are 3 px `amber-500` on both registers. Never removed.
5. No animation over 200 ms, none on the interview path. A spinner on a voice turn reads as a
   dropped line.
6. The offline banner is persistent, not a toast. A mobiliser must know before she starts.
