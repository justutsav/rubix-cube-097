#!/usr/bin/env python3
"""Cut Section 5's source shots out of the primary-source PDFs.

Section 5 is "The Evidence": the only thing it claims is that we read the
documents. So every document on screen is a real render of a real page, and the
highlights are the real word boxes — same pipeline as
`scripts-build-s1-sources.py`, which this deliberately mirrors rather than
abstracting: two call sites is not a library.

    python3 scripts-build-s5-sources.py

Writes public/s5/*.png and src/s5Sources.ts (generated — do not hand-edit).
"""
import html
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path
from xml.etree import ElementTree

HERE = Path(__file__).resolve().parent
REFS = HERE.parent / "docs" / "references"
CAG = REFS / "CAG-Report-No-20-of-2025-PMKVY-PerformanceAudit.pdf"
PMAJAY = REFS / "PM-AJAY-Guidelines-Revised-May2023.pdf"
NSQF = REFS / "NSQF-Gazette-Notification-June2023.pdf"
OUT = HERE / "public" / "s5"
DPI = 200
PAD = (26, 16, 26, 18)  # left, top, right, bottom in PDF points

# `full=True` renders the whole page (a cover has no text layer to anchor to).
SPECS = [
    dict(id="cagcover", pdf=CAG, page=1, full=True, highlights=[]),
    dict(
        id="pmcover",
        pdf=PMAJAY,
        page=1,
        anchors=["Centrally Sponsored Scheme", "GUIDELINES", "Revised"],
        pad=(120, 24, 120, 20),
        highlights=[("title", "GUIDELINES")],
    ),
    dict(
        id="gazette",
        pdf=NSQF,
        page=1,
        anchors=[
            "MINISTRY OF SKILL DEVELOPMENT AND ENTREPRENEURSHIP",
            "is hereby notified, in supersession of the earlier notification dated 27 th December 2013, as per",
        ],
        highlights=[("notified", "is hereby notified, in supersession of the earlier notification")],
    ),
    dict(
        id="nqr",
        pdf=NSQF,
        page=16,
        anchors=[
            "6.2. The National Qualification Register (NQR) will be the official national public record of all",
            "made available on a web portal and regularly updated.",
        ],
        pad=(26, 7, 26, 9),
        highlights=[("record", "the official national public record of all qualifications aligned to NSQF levels")],
    ),
]


def words(pdf: Path, page: int):
    """Every word on the page in reading order, with a top-left-origin box."""
    xml = subprocess.run(
        ["pdftotext", "-bbox-layout", "-f", str(page), "-l", str(page), str(pdf), "-"],
        capture_output=True, text=True, check=True,
    ).stdout
    xml = re.sub(r'\sxmlns="[^"]+"', "", xml, count=1)
    root = ElementTree.fromstring(xml)
    pg = root.find(".//page")
    out = [dict(
        text=html.unescape((w.text or "")).strip(),
        x0=float(w.get("xMin")), y0=float(w.get("yMin")),
        x1=float(w.get("xMax")), y1=float(w.get("yMax")),
    ) for w in pg.iter("word")]
    return [w for w in out if w["text"]], float(pg.get("width")), float(pg.get("height"))


def norm(s: str) -> str:
    return re.sub(r"[^a-z0-9]", "", s.lower())


def find(ws, phrase: str):
    want = [norm(t) for t in phrase.split() if norm(t)]
    have = [norm(w["text"]) for w in ws]
    for i in range(len(have) - len(want) + 1):
        if have[i:i + len(want)] == want:
            return ws[i:i + len(want)]
    raise SystemExit(f"phrase not found on page: {phrase!r}")


def lines(boxes, tol=3.0):
    rows = []
    for b in boxes:
        for r in rows:
            if abs(r[0]["y0"] - b["y0"]) <= tol:
                r.append(b)
                break
        else:
            rows.append([b])
    return [dict(
        x0=min(w["x0"] for w in r), y0=min(w["y0"] for w in r),
        x1=max(w["x1"] for w in r), y1=max(w["y1"] for w in r),
    ) for r in rows]


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    manifest = {}
    with tempfile.TemporaryDirectory() as tmp:
        for spec in SPECS:
            ws, pw, ph = words(spec["pdf"], spec["page"])
            if spec.get("full"):
                cx0, cy0, cx1, cy1 = 0.0, 0.0, pw, ph
            else:
                anchor_boxes = [b for a in spec["anchors"] for b in find(ws, a)]
                pad = spec.get("pad", PAD)
                cx0 = max(0.0, min(b["x0"] for b in anchor_boxes) - pad[0])
                cy0 = max(0.0, min(b["y0"] for b in anchor_boxes) - pad[1])
                cx1 = min(pw, max(b["x1"] for b in anchor_boxes) + pad[2])
                cy1 = min(ph, max(b["y1"] for b in anchor_boxes) + pad[3])

            s = DPI / 72.0
            stem = Path(tmp) / spec["id"]
            subprocess.run([
                "pdftoppm", "-r", str(DPI), "-f", str(spec["page"]), "-l", str(spec["page"]),
                "-png", "-x", str(int(cx0 * s)), "-y", str(int(cy0 * s)),
                "-W", str(int((cx1 - cx0) * s)), "-H", str(int((cy1 - cy0) * s)),
                str(spec["pdf"]), str(stem),
            ], check=True)
            produced = sorted(Path(tmp).glob(f"{spec['id']}-*.png"))
            if not produced:
                raise SystemExit(f"pdftoppm produced nothing for {spec['id']}")
            produced[0].replace(OUT / f"{spec['id']}.png")

            w_px, h_px = (cx1 - cx0) * s, (cy1 - cy0) * s
            hl = {}
            for name, phrase in spec["highlights"]:
                hl[name] = [dict(
                    x=(r["x0"] - cx0) * s / w_px,
                    y=(r["y0"] - cy0) * s / h_px,
                    w=(r["x1"] - r["x0"]) * s / w_px,
                    h=(r["y1"] - r["y0"]) * s / h_px,
                ) for r in lines(find(ws, phrase))]
            manifest[spec["id"]] = dict(src=f"s5/{spec['id']}.png",
                                        aspect=round(w_px / h_px, 4), hl=hl)
            print(f"{spec['id']:12s} {int(w_px)}x{int(h_px)}  {len(hl)} highlight(s)")

    ts = HERE / "src" / "s5Sources.ts"
    ts.write_text(
        "/** Generated by scripts-build-s5-sources.py — do not edit by hand.\n"
        " *  Crops and highlight boxes come straight out of the source PDFs. */\n"
        "import type { SourceShot } from './s1Sources';\n"
        f"export const SOURCES_S5: Record<string, SourceShot> = {json.dumps(manifest, indent=2)} as const;\n"
    )
    print("wrote", ts)


if __name__ == "__main__":
    sys.exit(main())
