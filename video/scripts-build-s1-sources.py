#!/usr/bin/env python3
"""Cut Section 1's source screenshots straight out of the primary-source PDFs.

Every frame that quotes a document in S1 is a real crop of that document's page,
and every yellow highlight is the real bounding box of the real words — both come
from the PDF itself (pdftoppm for the pixels, pdftotext -bbox-layout for the word
boxes), so a highlight cannot drift off the sentence it is highlighting.

    python3 scripts-build-s1-sources.py

Writes public/s1/*.png and src/s1Sources.ts (generated — do not hand-edit). The
logos and the cag.gov.in capture live in docs/Utsav/video/assets/s1 and are copied
through by the same run.
"""
import html
import json
import shutil
import re
import subprocess
import sys
import tempfile
from pathlib import Path
from xml.etree import ElementTree

HERE = Path(__file__).resolve().parent
ART = HERE.parent / "docs" / "Utsav" / "video" / "assets" / "s1"
REFS = HERE.parent / "docs" / "references"
CAG = REFS / "CAG-Report-No-20-of-2025-PMKVY-PerformanceAudit.pdf"
OUT = HERE / "public" / "s1"
DPI = 200

PMAJAY = REFS / "PM-AJAY-Guidelines-Revised-May2023.pdf"

# id, pdf, 1-based page, crop anchors (union + pad), highlight phrases
SPECS = [
    dict(
        id="clause",
        pdf=PMAJAY,
        page=23,
        anchors=[
            "c. Identification of beneficiaries should be carried carefully after assessing the",
            "thereafter holding of selection meeting.",
        ],
        highlights=[
            ("interest", "assessing the interest of the candidates in the skill proposed to be imparted"),
            ("advert", "advertisement in print media, social media etc."),
        ],
    ),
    dict(
        id="mandate",
        pdf=PMAJAY,
        page=24,
        anchors=[
            "ii) Short Term Training Programmes: The overall placement of the trained",
            "persons should by 70% in wage/self-employment.",
        ],
        highlights=[("seventy", "70% in wage/self-employment")],
    ),
    dict(
        id="placement",
        pdf=CAG,
        page=57,
        anchors=[
            "Analysis of data revealed that out of total candidates certified under STT/SP",
            "41 per cent (in 498 job-roles) were placed in 35 sectors as detailed in Annexure 3.4.",
        ],
        pad=(26, 2, 26, 14),
        highlights=[
            ("certified", "56.14 lakh (in 724 job-roles)"),
            ("placed", "41 per cent (in 498 job-roles) were placed"),
        ],
    ),
    dict(
        id="concentration",
        pdf=CAG,
        page=27,
        anchors=[
            "Analysis of PMKVY skill training data revealed that a total 56.14 lakh candidates",
            "sectors as detailed in Table 2.1(a):",
        ],
        highlights=[
            ("tenroles", "40 per cent of skill certifications were concentrated in only 10 job-roles"),
        ],
    ),
    dict(
        id="tableb",
        pdf=CAG,
        page=28,
        anchors=["Table 2.1(b): Concentration of skill certifications in specific job-roles",
                 "Green Jobs", "Worker", "59.37"],
        pad=(14, 4, 26, 10),
        highlights=[("green", "Green Jobs"), ("safai", "Safai Karmchari"), ("share", "90.35")],
    ),
]

PAD = (26, 16, 26, 18)  # left, top, right, bottom in PDF points


def words(pdf: Path, page: int):
    """Every word on the page in reading order, with a top-left-origin box."""
    xml = subprocess.run(
        ["pdftotext", "-bbox-layout", "-f", str(page), "-l", str(page), str(pdf), "-"],
        capture_output=True, text=True, check=True,
    ).stdout
    # poppler emits XHTML with a default namespace; strip it rather than fight it
    xml = re.sub(r'\sxmlns="[^"]+"', "", xml, count=1)
    root = ElementTree.fromstring(xml)
    pg = root.find(".//page")
    out = []
    for w in pg.iter("word"):
        out.append(dict(
            text=html.unescape((w.text or "")).strip(),
            x0=float(w.get("xMin")), y0=float(w.get("yMin")),
            x1=float(w.get("xMax")), y1=float(w.get("yMax")),
        ))
    return [w for w in out if w["text"]], float(pg.get("width")), float(pg.get("height"))


def norm(s: str) -> str:
    return re.sub(r"[^a-z0-9]", "", s.lower())


def find(ws, phrase: str):
    """Boxes of the run of words matching `phrase`. Raises if it is not on the page."""
    want = [norm(t) for t in phrase.split() if norm(t)]
    have = [norm(w["text"]) for w in ws]
    for i in range(len(have) - len(want) + 1):
        if have[i:i + len(want)] == want:
            return ws[i:i + len(want)]
    raise SystemExit(f"phrase not found on page: {phrase!r}")


def lines(boxes, tol=3.0):
    """Group word boxes into one rect per text line, so a swipe covers a line at a time."""
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
    # the logos and the site capture are fetched artefacts, not crops — copy them through
    for f in sorted(ART.glob("*.png")):
        shutil.copyfile(f, OUT / f.name)
    manifest = {}
    with tempfile.TemporaryDirectory() as tmp:
        for spec in SPECS:
            ws, _pw, _ph = words(spec["pdf"], spec["page"])
            anchor_boxes = [b for a in spec["anchors"] for b in find(ws, a)]
            pad = spec.get("pad", PAD)
            cx0 = min(b["x0"] for b in anchor_boxes) - pad[0]
            cy0 = min(b["y0"] for b in anchor_boxes) - pad[1]
            cx1 = max(b["x1"] for b in anchor_boxes) + pad[2]
            cy1 = max(b["y1"] for b in anchor_boxes) + pad[3]

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
            png = OUT / f"{spec['id']}.png"
            produced[0].replace(png)

            w_px, h_px = (cx1 - cx0) * s, (cy1 - cy0) * s
            hl = {}
            for name, phrase in spec["highlights"]:
                hl[name] = [dict(
                    x=(r["x0"] * s - cx0 * s) / w_px,
                    y=(r["y0"] * s - cy0 * s) / h_px,
                    w=(r["x1"] - r["x0"]) * s / w_px,
                    h=(r["y1"] - r["y0"]) * s / h_px,
                ) for r in lines(find(ws, phrase))]
            manifest[spec["id"]] = dict(src=f"s1/{spec['id']}.png",
                                        aspect=round(w_px / h_px, 4), hl=hl)
            print(f"{spec['id']:14s} {int(w_px)}x{int(h_px)}  {len(hl)} highlight(s)")

    ts = HERE / "src" / "s1Sources.ts"
    body = json.dumps(manifest, indent=2)
    ts.write_text(
        "/** Generated by scripts-build-s1-sources.py — do not edit by hand.\n"
        " *  Crops and highlight boxes come straight out of the source PDFs. */\n"
        "export type HlRect = { x: number; y: number; w: number; h: number };\n"
        "export type SourceShot = { src: string; aspect: number; hl: Record<string, HlRect[]> };\n"
        f"export const SOURCES: Record<string, SourceShot> = {body} as const;\n"
    )
    print("wrote", ts)


if __name__ == "__main__":
    sys.exit(main())
