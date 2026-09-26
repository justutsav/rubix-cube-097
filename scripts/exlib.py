#!/usr/bin/env python3
"""Minimal Excalidraw element builders, shared by the diagram generators.

Excalidraw has no "label on a shape" concept. A labelled box is two elements: the container, and a
text element carrying `containerId`, listed back in the container's `boundElements`. Text also
needs explicit width/height/fontFamily or the app drops it silently and you get boxes with nothing
in them. That failure is why these diagrams are generated rather than hand-written.
"""

from __future__ import annotations

import json
import random
from pathlib import Path

FONT = 2  # Helvetica. 1 is Virgil/hand-drawn, unreadable at panorama zoom.
LINE_HEIGHT = 1.25
CHAR_W = 0.55  # width of one char as a fraction of fontSize, Helvetica-ish


class Scene:
    def __init__(self, seed: int = 26097) -> None:
        self.elements: list[dict] = []
        self._rng = random.Random(seed)

    # ---------------------------------------------------------------- internals

    def _seed(self) -> int:
        return self._rng.randint(1, 2**31)

    def _base(self, eid, etype, x, y, w, h, stroke="#1e1e1e", bg="transparent",
              stroke_width=2, opacity=100, style="solid") -> dict:
        return {
            "id": eid, "type": etype, "x": x, "y": y, "width": w, "height": h,
            "angle": 0, "strokeColor": stroke, "backgroundColor": bg,
            "fillStyle": "solid", "strokeWidth": stroke_width, "strokeStyle": style,
            "roughness": 1, "opacity": opacity, "groupIds": [], "frameId": None,
            "roundness": None, "seed": self._seed(), "version": 1,
            "versionNonce": self._seed(), "isDeleted": False, "boundElements": None,
            "updated": 1, "link": None, "locked": False,
        }

    @staticmethod
    def measure(text: str, size: int) -> tuple[float, float]:
        lines = text.split("\n")
        return max(len(l) for l in lines) * size * CHAR_W, len(lines) * size * LINE_HEIGHT

    # ---------------------------------------------------------------- public

    def text(self, eid, x, y, text, size=16, color="#1e1e1e", align="left") -> dict:
        w, h = self.measure(text, size)
        e = self._base(eid, "text", x, y, w, h, stroke=color)
        e.update({
            "text": text, "originalText": text, "fontSize": size, "fontFamily": FONT,
            "textAlign": align, "verticalAlign": "top", "containerId": None,
            "lineHeight": LINE_HEIGHT, "autoResize": True,
        })
        self.elements.append(e)
        return e

    def box(self, eid, x, y, w, h, bg="transparent", stroke="#1e1e1e", label=None,
            size=16, sw=2, opacity=100, round_=True, label_color="#1e1e1e",
            align="center", style="solid") -> dict:
        e = self._base(eid, "rectangle", x, y, w, h, stroke=stroke, bg=bg,
                       stroke_width=sw, opacity=opacity, style=style)
        if round_:
            e["roundness"] = {"type": 3}
        self.elements.append(e)
        if label:
            tid = eid + "_t"
            tw, th = self.measure(label, size)
            # Left-aligned labels sit inset; centred ones are centred on both axes.
            tx = x + 12 if align == "left" else x + (w - tw) / 2
            t = self._base(tid, "text", tx, y + (h - th) / 2, tw if align == "left" else tw, th,
                           stroke=label_color)
            t.update({
                "text": label, "originalText": label, "fontSize": size, "fontFamily": FONT,
                "textAlign": align, "verticalAlign": "middle", "containerId": eid,
                "lineHeight": LINE_HEIGHT, "autoResize": False,
            })
            e["boundElements"] = [{"type": "text", "id": tid}]
            self.elements.append(t)
        return e

    def arrow(self, eid, x, y, dx, dy, color="#1e1e1e", style="solid", head="arrow", sw=2) -> dict:
        e = self._base(eid, "arrow", x, y, abs(dx), abs(dy), stroke=color, style=style, stroke_width=sw)
        e.update({
            "points": [[0, 0], [dx, dy]], "lastCommittedPoint": None,
            "startBinding": None, "endBinding": None,
            "startArrowhead": None, "endArrowhead": head, "elbowed": False,
            "roundness": {"type": 2},
        })
        self.elements.append(e)
        return e

    def elbow(self, eid, x, y, pts, color="#1e1e1e", style="solid", head="arrow", sw=2) -> dict:
        """Multi-segment arrow. `pts` are offsets from (x, y), starting at [0, 0]."""
        xs = [p[0] for p in pts]
        ys = [p[1] for p in pts]
        e = self._base(eid, "arrow", x, y, max(xs) - min(xs) or 1, max(ys) - min(ys) or 1,
                       stroke=color, style=style, stroke_width=sw)
        e.update({
            "points": pts, "lastCommittedPoint": None,
            "startBinding": None, "endBinding": None,
            "startArrowhead": None, "endArrowhead": head, "elbowed": False,
            "roundness": {"type": 2},
        })
        self.elements.append(e)
        return e

    # ---------------------------------------------------------------- output

    def save(self, path: Path) -> None:
        scene = {
            "type": "excalidraw", "version": 2, "source": "https://excalidraw.com",
            "elements": self.elements,
            "appState": {"gridSize": None, "viewBackgroundColor": "#ffffff"},
            "files": {},
        }
        path.write_text(json.dumps(scene, ensure_ascii=False, indent=1))
        self.check()
        texts = [e for e in self.elements if e["type"] == "text"]
        print(f"{path}  ok: {len(self.elements)} elements, {len(texts)} text")

    def check(self) -> None:
        """The bug this exists to prevent is silently-dropped text."""
        ids = {e["id"] for e in self.elements}
        assert len(ids) == len(self.elements), "duplicate element id"
        texts = [e for e in self.elements if e["type"] == "text"]
        assert texts, "no text elements at all"
        for t in texts:
            assert t["width"] > 0 and t["height"] > 0, f"{t['id']} has zero size"
            assert t["fontFamily"] and t["fontSize"], f"{t['id']} missing font"
            if t["containerId"] is not None:
                assert t["containerId"] in ids, f"{t['id']} points at a missing container"
        for e in self.elements:
            for b in (e.get("boundElements") or []):
                assert b["id"] in ids, f"{e['id']} binds a missing text {b['id']}"


# Palette shared by both diagrams.
BLU, GRN, ORG, PUR, RED, YEL, TEA = ("#a5d8ff", "#b2f2bb", "#ffd8a8", "#d0bfff",
                                     "#ffc9c9", "#fff3bf", "#c3fae8")
sBLU, sGRN, sORG, sPUR, sRED, sTEA = ("#4a9eed", "#22c55e", "#f59e0b", "#8b5cf6",
                                      "#ef4444", "#06b6d4")
GREY, DRED, DGRN, DBLU, DPUR, DORG = ("#757575", "#c62828", "#15803d", "#2563eb",
                                      "#6d28d9", "#b45309")
WHITE = "#ffffff"
