# Where is the file for the Excalidraw?

## Query

> where is the file for the excalidraw?

## Reply

No file. `create_view` rendered into the session canvas only — checkpointed client-side (`11bb131e085a4281b8`), never written to disk. I misspoke if I implied otherwise.

Two ways to get one:

**Fastest — you do it:** open the diagram fullscreen in the Excalidraw panel, then its own menu → *Save to…* / *Export image*. That writes a real `.excalidraw` with all bound-text and z-order intact. Recommended — lossless, zero re-render.

**Or I do it:** I re-serialize the whole scene through `export_to_excalidraw`, which uploads it to excalidraw.com and returns a share link. Costs a full re-send of ~200 elements, and gives a URL not a local file.

Want the link, or a hand-written `.excalidraw` in `docs/Utsav/research/`? The hand-written one is risky — labeled shapes expand into separate bound text elements, and getting that wrong renders a blank canvas.
