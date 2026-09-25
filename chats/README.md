# chats/

Working transcript. One file per query, numbered in the order the queries were asked.
Each file is the query verbatim at the top, then the reply verbatim underneath.

Nothing here is edited for tone or corrected after the fact — including the parts that
turned out to be wrong. The Excalidraw export failing twice is in `04`-`06`, and the
constraint audit demolishing our own cost model is in `01`. Both are kept because the
correction is the useful part, and because a spec that only records its final position
is a spec nobody can argue with later.

One exception: on 2026-09-26, when the repo was re-based as `rubix-cube-097`, every
reference to competing teams was cut. Each cut is marked inline as
*[competitor detail removed]*; nothing else was changed.

| # | Query | What it settled |
|---|---|---|
| [01](01-excalidraw-one-canvas-and-dialogflow.md) | Excalidraw format · one canvas with separate panels · could Dialogflow do this | The 11-panel diagram, the constraint-audit findings, and why Dialogflow is a scaffold and not the engine |
| [02](02-where-is-the-excalidraw-file.md) | Where is the file for the Excalidraw | There wasn't one — the canvas was session-only |
| [03](03-export-to-a-link.md) | Do that | Exported to excalidraw.com |
| [04](04-text-not-loading.md) | It's not loading the texts | First diagnosis, partly wrong |
| [05](05-text-still-not-loading.md) | Not loading the texts as said | Root cause found; replaced the one-off export with a generator script |
| [06](06-what-is-an-fsm.md) | What's this FSM | Plain-language answer |
| [07](07-panel-2-ivr-explained.md) | Resample, ASR, where the AI actually runs, lexicon match | Panel 2 walked through, with the PS lines quoted verbatim |
| [08](08-panels-4-and-5-explained.md) | Same for panel 4 and panel 5 | WhatsApp and the offline kiosk / assisted mode |

Source of truth for the design itself is
[`docs/Utsav/research/05-technical-spec.md`](../docs/Utsav/research/05-technical-spec.md).
This directory is how it got there.
