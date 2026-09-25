# Not loading the texts as said

## Query

*(screenshot attached: same scene at 100% zoom — coloured boxes and arrows render correctly, no text anywhere, including panel titles)*

> not loading the texts as said

## Reply

Confirmed — no text at all, so it's not just the labels. My text elements shipped without `width`/`height`/`fontFamily`, and Excalidraw dropped them.

Fixing it properly: a generator script, so the diagram stays rebuildable as the spec changes.

*(wrote `scripts/build_diagram.py`, ran it)*

```
docs/Utsav/research/05-diagrams.excalidraw  ok: 367 elements, 186 text
```

Built. `docs/Utsav/research/05-diagrams.excalidraw` — 367 elements, **186 text elements**, all with real `width`/`height`/`fontFamily`, and every labelled box now a proper container + bound-text pair.

**Open it:** excalidraw.com → hamburger menu → **Open** → pick the file. (Not the share link — that one's still the broken version.)

Root cause, for the record: `export_to_excalidraw` passes JSON straight through. My text elements had no `width`/`height`/`fontFamily`, and `label` on a shape is an MCP convenience that doesn't exist in the real format. Excalidraw dropped both silently — hence boxes and arrows but nothing inside them.

Why a script instead of a one-off file: the spec is still moving (Q0, PIN gate, PM-DAKSH stage all landed today). Edit `scripts/build_diagram.py`, re-run, diagram matches. It self-checks on every run — asserts no zero-size text, no orphan `containerId`, no dangling `boundElements`, no duplicate ids. That's exactly the class of bug that just wasted your time.

Not verified visually — I can't open a browser. Load it and tell me if any panel looks wrong.
