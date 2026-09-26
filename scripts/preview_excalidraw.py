#!/usr/bin/env python3
"""Render a .excalidraw file to SVG (and PNG) so the layout can actually be looked at.

The problem this solves: these diagrams are generated blind. `exlib.validate` catches text
overflow and box collisions, but it cannot see that a column *reads* as the wrong thing, that an
arrow points at nothing, or that a region is a wall of grey. Those were found by a human opening
the file and saying so.

Rendering our own JSON back out closes that loop. It does not reproduce Excalidraw's hand-drawn
styling and does not try to — geometry, text, colour and arrows are exactly what needs checking,
and this is faithful on all four because it reads the same numbers Excalidraw will.

Usage:
    python3 scripts/preview_excalidraw.py docs/Utsav/research/07-flowchart.excalidraw
    python3 scripts/preview_excalidraw.py <file> --png out.png   # needs google-chrome-stable
"""

from __future__ import annotations

import html
import json
import subprocess
import sys
import tempfile
from pathlib import Path

PAD = 60
# Matches exlib: CHAR_W 0.55, LINE_HEIGHT 1.25. Kept in sync deliberately — if the preview and the
# generator disagree about text size, the preview stops being evidence.
CHAR_W = 0.55
LINE_H = 1.25


def esc(t: str) -> str:
    return html.escape(t, quote=True)


def render(path: Path) -> tuple[str, float, float]:
    doc = json.loads(path.read_text())
    els = [e for e in doc["elements"] if not e.get("isDeleted")]

    xs, ys = [], []
    for e in els:
        pts = e.get("points")
        if pts:
            # Arrows and lines: the extent is the POINTS, not x+width / y+height. Excalidraw
            # stores width/height as unsigned magnitudes, so an arrow that runs upward reports a
            # positive height and adding it to y invents a phantom corner far below the drawing —
            # which is how a re-routed connector appeared to stretch the canvas by 1,700px.
            xs += [e["x"] + p[0] for p in pts]
            ys += [e["y"] + p[1] for p in pts]
        else:
            xs += [e["x"], e["x"] + e.get("width", 0)]
            ys += [e["y"], e["y"] + e.get("height", 0)]
    minx, maxx = min(xs) - PAD, max(xs) + PAD
    miny, maxy = min(ys) - PAD, max(ys) + PAD
    w, h = maxx - minx, maxy - miny

    out: list[str] = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{w:.0f}" height="{h:.0f}" '
        f'viewBox="{minx:.0f} {miny:.0f} {w:.0f} {h:.0f}">',
        f'<rect x="{minx:.0f}" y="{miny:.0f}" width="{w:.0f}" height="{h:.0f}" fill="#ffffff"/>',
        # No <marker>: `context-stroke` is not supported by every SVG rasteriser, and a marker
        # that silently fails to render turns "this arrow points nowhere" into an invisible bug —
        # exactly the class of thing this preview exists to catch. Arrowheads are explicit paths.
        "",
    ]

    # Rectangles first, then lines/arrows, then text — same paint order Excalidraw uses.
    for e in els:
        if e["type"] != "rectangle":
            continue
        fill = e.get("backgroundColor", "transparent")
        fill = "none" if fill in ("transparent", None) else fill
        op = e.get("opacity", 100) / 100
        # Precomputed: Python 3.10 f-strings cannot contain a backslash, and quoting this inline
        # needs one.
        dash = " stroke-dasharray='8 6'" if e.get("strokeStyle") == "dashed" else ""
        out.append(
            f'<rect x="{e["x"]:.1f}" y="{e["y"]:.1f}" width="{e["width"]:.1f}" '
            f'height="{e["height"]:.1f}" rx="8" fill="{fill}" fill-opacity="{op:.2f}" '
            f'stroke="{e.get("strokeColor", "#1e1e1e")}" stroke-width="{e.get("strokeWidth", 2)}"'
            f'{dash}/>'
        )

    for e in els:
        if e["type"] not in ("arrow", "line"):
            continue
        pts = e.get("points") or [[0, 0], [e.get("width", 0), e.get("height", 0)]]
        d = " ".join(
            ("M" if i == 0 else "L") + f" {e['x'] + p[0]:.1f} {e['y'] + p[1]:.1f}"
            for i, p in enumerate(pts)
        )
        dash = " stroke-dasharray='8 6'" if e.get("strokeStyle") == "dashed" else ""
        colour = e.get("strokeColor", "#1e1e1e")
        out.append(
            f'<path d="{d}" fill="none" stroke="{colour}" '
            f'stroke-width="{e.get("strokeWidth", 2)}"{dash}/>'
        )
        if e["type"] == "arrow" and e.get("endArrowhead") and len(pts) >= 2:
            import math
            (x0, y0), (x1, y1) = pts[-2], pts[-1]
            ang = math.atan2(y1 - y0, x1 - x0)
            tx, ty = e["x"] + x1, e["y"] + y1
            size = 11
            p1 = (tx - size * math.cos(ang - 0.42), ty - size * math.sin(ang - 0.42))
            p2 = (tx - size * math.cos(ang + 0.42), ty - size * math.sin(ang + 0.42))
            out.append(
                f'<path d="M {tx:.1f} {ty:.1f} L {p1[0]:.1f} {p1[1]:.1f} '
                f'L {p2[0]:.1f} {p2[1]:.1f} Z" fill="{colour}"/>'
            )

    for e in els:
        if e["type"] != "text":
            continue
        size = e.get("fontSize", 16)
        lines = (e.get("text") or "").split("\n")
        anchor = {"left": "start", "center": "middle", "right": "end"}.get(e.get("textAlign", "left"), "start")
        # Excalidraw vertically centres a bound label inside its container; free text is top-left.
        x = e["x"] + (e["width"] / 2 if anchor == "middle" else 0)
        for i, line in enumerate(lines):
            y = e["y"] + size * LINE_H * (i + 0.8)
            out.append(
                f'<text x="{x:.1f}" y="{y:.1f}" font-family="Helvetica, Arial, sans-serif" '
                f'font-size="{size}" fill="{e.get("strokeColor", "#1e1e1e")}" '
                f'text-anchor="{anchor}" xml:space="preserve">{esc(line)}</text>'
            )

    out.append("</svg>")
    return "\n".join(out), w, h


def main() -> None:
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    src = Path(sys.argv[1])
    svg, w, h = render(src)
    svg_path = src.with_suffix(".preview.svg")
    svg_path.write_text(svg)
    print(f"{svg_path}  ({w:.0f} x {h:.0f})")

    if "--png" in sys.argv:
        png = Path(sys.argv[sys.argv.index("--png") + 1])
        # Chrome caps very large screenshots; scale down to something it will actually produce.
        scale = min(1.0, 2400 / w, 4000 / h)
        with tempfile.TemporaryDirectory() as td:
            shim = Path(td) / "p.html"
            shim.write_text(
                f'<html><body style="margin:0">'
                f'<img src="file://{svg_path.resolve()}" width="{w * scale:.0f}">'
                f"</body></html>"
            )
            subprocess.run(
                ["google-chrome-stable", "--headless", "--disable-gpu", "--no-sandbox",
                 f"--screenshot={png}", f"--window-size={w * scale:.0f},{h * scale:.0f}",
                 "--hide-scrollbars", "--default-background-color=ffffff",
                 f"file://{shim}"],
                check=False, capture_output=True, timeout=180,
            )
        if png.exists():
            print(f"{png}  ({png.stat().st_size // 1024} KB, scale {scale:.2f})")
        else:
            print("PNG render failed — the SVG is still usable in a browser")


if __name__ == "__main__":
    main()
