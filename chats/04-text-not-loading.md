# It's not loading the texts

## Query

*(screenshot attached: excalidraw.com showing the "Load from link" modal, canvas behind it at 10% zoom with coloured boxes and no text)*

> It's not loading the texts directly it's facing some issues why?

## Reply

Two separate things in that screenshot.

**The modal is not an error.** Standard Excalidraw warning — you have an existing drawing in that tab. Click **Replace my content**. (Or open the link in a fresh tab / private window to keep your current canvas.)

**The missing text probably is my fault.** Zoom is at **10%** — first do `Shift+1` (zoom to fit) after loading and tell me what you see:

- **Titles appear, box text missing** → confirmed bug. The MCP tool accepts a `label` shorthand on shapes; excalidraw.com does not. Real Excalidraw needs a separate text element with `containerId` + a matching `boundElements` entry on the shape. `export_to_excalidraw` passed my JSON straight through, so every label got dropped — that's ~90 boxes rendering empty.
- **No text at all, even titles** → the standalone text elements are failing too, so it's missing required props (`fontFamily`, `seed`, `versionNonce`), not just labels.

Either way the fix is mine, not yours. Fastest path once you confirm: I re-export with every label expanded into a properly bound text element. Doubles the element count but it will render.

Note the in-session canvas I rendered earlier displays correctly — that path expands labels server-side. So the diagram is right; only the excalidraw.com round-trip broke it.

Zoom to fit and tell me which of the two it is.
