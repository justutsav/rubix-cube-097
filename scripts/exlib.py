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

    def fitbox(self, eid, x, y, w, bg="transparent", stroke="#1e1e1e", label="",
               size=14, sw=2, pad=14, title=None, title_size=18, title_color=None,
               min_h=0) -> dict:
        """A box whose height is computed from its own text, so nothing can overflow.

        The hand-placed version of this diagram put title and body in separate free-floating text
        elements sized by eye, which is how labels ended up spilling outside their boxes. Here the
        box is measured from the text it contains, and `validate` re-checks it.
        """
        body = label
        if title:
            tw, th = self.measure(title, title_size)
            bw, bh = self.measure(body, size)
            h = max(min_h, th + bh + pad * 2 + 8)
            self.box(eid, x, y, w, h, bg, stroke, sw=sw)
            self.text(eid + "_ti", x + pad, y + pad, title, title_size, title_color or stroke)
            self.text(eid + "_bo", x + pad, y + pad + th + 8, body, size)
            return self.byid(eid)
        bw, bh = self.measure(body, size)
        h = max(min_h, bh + pad * 2)
        return self.box(eid, x, y, w, h, bg, stroke, body, size, sw=sw, align="left")

    def byid(self, eid: str) -> dict:
        return next(e for e in self.elements if e["id"] == eid)

    def vline(self, eid, x, y0, y1, color="#bbbbbb", style="dashed") -> dict:
        e = self._base(eid, "line", x, y0, 0, y1 - y0, stroke=color, style=style, stroke_width=2)
        e.update({"points": [[0, 0], [0, y1 - y0]], "lastCommittedPoint": None,
                  "startBinding": None, "endBinding": None,
                  "startArrowhead": None, "endArrowhead": None, "roundness": None})
        self.elements.append(e)
        return e

    # ---------------------------------------------------------------- validation

    def validate(self, zones: set[str] = frozenset()) -> None:
        """Assert the things a human would otherwise have to spot by eye.

        Exists because the first version of this flowchart was written blind, and the reviewer had
        to point out that text was spilling and the officer column had no arrows. These are the
        checks that would have caught it.
        """
        rects = [e for e in self.elements if e["type"] == "rectangle" and e["id"] not in zones]
        problems: list[str] = []

        # 1. Every bound label fits inside its container.
        for t in self.elements:
            if t["type"] != "text" or t["containerId"] is None:
                continue
            box = self.byid(t["containerId"])
            if t["width"] > box["width"] - 16:
                problems.append(f"label of {box['id']} is {t['width']:.0f}px wide in a {box['width']:.0f}px box")
            if t["height"] > box["height"] - 4:
                problems.append(f"label of {box['id']} is {t['height']:.0f}px tall in a {box['height']:.0f}px box")

        # 2. Free text placed inside a fitbox stays inside it.
        for t in self.elements:
            if t["type"] != "text" or t["containerId"] is not None:
                continue
            host = t["id"].rsplit("_", 1)[0]
            if not (t["id"].endswith("_ti") or t["id"].endswith("_bo")):
                continue
            try:
                box = self.byid(host)
            except StopIteration:
                continue
            if t["x"] + t["width"] > box["x"] + box["width"] - 6:
                problems.append(f"{t['id']} overflows {host} horizontally by "
                                f"{t['x'] + t['width'] - box['x'] - box['width'] + 6:.0f}px")
            if t["y"] + t["height"] > box["y"] + box["height"] - 4:
                problems.append(f"{t['id']} overflows {host} vertically by "
                                f"{t['y'] + t['height'] - box['y'] - box['height'] + 4:.0f}px")

        # 3. No two non-zone boxes overlap.
        for i, a in enumerate(rects):
            for b in rects[i + 1:]:
                if (a["x"] < b["x"] + b["width"] and b["x"] < a["x"] + a["width"]
                        and a["y"] < b["y"] + b["height"] and b["y"] < a["y"] + a["height"]):
                    problems.append(f"{a['id']} overlaps {b['id']}")

        if problems:
            raise SystemExit("LAYOUT PROBLEMS:\n  - " + "\n  - ".join(problems))
        print(f"  layout ok: {len(rects)} boxes, no overlaps, no overflow")

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
