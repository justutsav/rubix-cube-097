#!/usr/bin/env python3
"""Render the SIH 26097 video-script pack to PDF.

One master PDF plus one page per speaker, so each person can be handed only their
own section. Markdown -> HTML -> Chrome headless -> PDF; no pandoc, no LaTeX.

    python3 scripts/build_video_script_pdf.py
"""

import re
import shutil
import subprocess
import sys
from pathlib import Path

import markdown

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "docs/Utsav/video/26097_Video_Script_source.md"
OUT = ROOT / "docs/Utsav/video"
SPEAKER_DIR = OUT / "Individual_Speaker_Pages"

CSS = """
@page { size: A4; margin: 16mm 14mm 16mm 14mm; }
* { box-sizing: border-box; }
body {
  font-family: "Georgia", "Times New Roman", serif;
  font-size: 10.5pt; line-height: 1.5; color: #1a1a1a; margin: 0;
}
h1 { font-family: "Helvetica Neue", Arial, sans-serif; font-size: 19pt;
     letter-spacing: -0.4px; margin: 0 0 2px; color: #0b1a33; }
h2 { font-family: "Helvetica Neue", Arial, sans-serif; font-size: 14pt;
     margin: 22px 0 8px; padding-bottom: 5px; border-bottom: 2px solid #0b1a33;
     color: #0b1a33; page-break-after: avoid; }
h3 { font-family: "Helvetica Neue", Arial, sans-serif; font-size: 11.5pt;
     margin: 16px 0 6px; color: #33415c; page-break-after: avoid; }
h1 + p, h2 + p { margin-top: 4px; }
p { margin: 7px 0; }
ul, ol { margin: 7px 0 7px 18px; padding-left: 6px; }
li { margin: 3px 0; }
code { font-family: "DejaVu Sans Mono", monospace; font-size: 9pt;
       background: #eef1f6; padding: 1px 4px; border-radius: 3px; }
strong { color: #000; }
hr { border: 0; border-top: 1px solid #ccd3de; margin: 20px 0; }

table { border-collapse: collapse; width: 100%; margin: 10px 0;
        font-size: 9pt; page-break-inside: avoid; }
th { background: #0b1a33; color: #fff; text-align: left; padding: 5px 7px;
     font-family: "Helvetica Neue", Arial, sans-serif; font-weight: 600; }
td { border-bottom: 1px solid #dde2ea; padding: 5px 7px; vertical-align: top; }
tr:nth-child(even) td { background: #f6f8fb; }

/* The SAY THIS / warning blocks are all blockquotes in the source; colour them
   by the marker the author put at the start so the reader can triage at a glance. */
blockquote {
  margin: 10px 0; padding: 9px 14px; border-left: 4px solid #8a94a6;
  background: #f4f6f9; page-break-inside: avoid;
}
blockquote p { margin: 5px 0; }
blockquote.say {
  border-left-color: #1d6f42; background: #eef7f1;
  font-size: 12pt; line-height: 1.65;
}
blockquote.warn { border-left-color: #b3261e; background: #fdeeed; font-size: 9.5pt; }
blockquote.ok   { border-left-color: #1d6f42; background: #eef7f1; font-size: 9.5pt; }

.hdr { border-bottom: 3px solid #0b1a33; padding-bottom: 8px; margin-bottom: 14px; }
.hdr .sub { font-family: "Helvetica Neue", Arial, sans-serif; font-size: 9pt;
            color: #55607a; margin-top: 3px; }
.speaker-badge {
  display: inline-block; background: #0b1a33; color: #fff; padding: 3px 10px;
  border-radius: 3px; font-family: "Helvetica Neue", Arial, sans-serif;
  font-size: 9pt; font-weight: 600; margin-bottom: 8px;
}
.rule-card {
  border: 2px solid #b3261e; background: #fdeeed; padding: 10px 14px;
  margin: 0 0 16px; page-break-inside: avoid;
}
.rule-card h3 { margin-top: 0; color: #b3261e; }
.rule-card p { font-size: 9.5pt; margin: 4px 0; }
.page-break { page-break-before: always; }
"""

HTML = """<!doctype html>
<html><head><meta charset="utf-8"><title>{title}</title><style>{css}</style></head>
<body>{body}</body></html>"""

# Handed to every speaker on their own page. The full rationale lives in the master.
RULE_CARD = """
<div class="rule-card">
<h3>&#9888; The one rule for this video</h3>
<p><strong>We did no field work for this problem statement. Nobody says otherwise on camera.</strong></p>
<p>Never say &ldquo;we surveyed&rdquo;, &ldquo;we visited&rdquo;, &ldquo;we interviewed&rdquo; or
&ldquo;people told us&rdquo;. Our credibility comes from primary-source documents we read in full &mdash;
a CAG performance audit, the NSQF gazette, PM&#8209;AJAY&rsquo;s own guidelines and the national
qualification register. Attribute to <em>them</em>, never to us.</p>
<p>If anyone ad&#8209;libs a field&#8209;work claim, the take is dead &mdash; re&#8209;shoot it.</p>
</div>"""


def md_to_html(text: str) -> str:
    html = markdown.markdown(text, extensions=["tables", "fenced_code", "attr_list", "sane_lists"])
    # Tag blockquotes by their leading marker so the CSS can colour-code them.
    html = re.sub(r"<blockquote>\s*<p>(&#9888;|⚠)", r'<blockquote class="warn"><p>\1', html)
    html = re.sub(r"<blockquote>\s*<p>(✅)", r'<blockquote class="ok"><p>\1', html)
    # Anything still unclassified that follows a "SAY THIS" heading is the spoken take.
    html = re.sub(
        r"(<h3>SAY THIS.*?</h3>\s*)<blockquote>",
        r'\1<blockquote class="say">',
        html,
        flags=re.S,
    )
    return html


def find_chrome() -> str:
    for name in ("google-chrome", "chromium", "chromium-browser", "google-chrome-stable"):
        path = shutil.which(name)
        if path:
            return path
    sys.exit("No Chrome/Chromium found; cannot render PDF.")


def write_pdf(html: str, title: str, dest: Path, chrome: str) -> None:
    tmp = dest.with_suffix(".html")
    tmp.write_text(HTML.format(title=title, css=CSS, body=html), encoding="utf-8")
    subprocess.run(
        [chrome, "--headless", "--disable-gpu", "--no-sandbox", "--no-pdf-header-footer",
         f"--print-to-pdf={dest}", tmp.as_uri()],
        check=True, capture_output=True,
    )
    tmp.unlink()
    print(f"  {dest.relative_to(ROOT)}")


def split_sections(text: str) -> list[tuple[int, str, str]]:
    """Return (number, title, body) for each '## SECTION n — title' block."""
    pattern = re.compile(r"^## \U0001f3ac SECTION (\d+) — (.+?)$", re.M)
    marks = list(pattern.finditer(text))
    out = []
    for i, m in enumerate(marks):
        end = marks[i + 1].start() if i + 1 < len(marks) else len(text)
        body = text[m.end():end]
        # Drop the trailing '---' separator that leads into the next section.
        body = re.sub(r"\n---\s*$", "\n", body.rstrip()) + "\n"
        out.append((int(m.group(1)), m.group(2).strip(), body))
    return out


def main() -> None:
    chrome = find_chrome()

    # Any markdown passed on the command line renders to a PDF beside itself; no argument
    # means build the speaker pack.
    if len(sys.argv) > 1:
        for arg in sys.argv[1:]:
            src = Path(arg).resolve()
            if not src.exists():
                sys.exit(f"Missing source: {src}")
            title = src.stem.replace("-", " ").replace("_", " ").title()
            header = (
                f'<div class="hdr"><h1>{title}</h1>'
                '<div class="sub">TEAM RUBIXCUBE &middot; SIH 2026 &middot; PS 26097</div></div>'
            )
            write_pdf(header + md_to_html(src.read_text(encoding="utf-8")),
                      title, src.with_suffix(".pdf"), chrome)
        return

    if not SRC.exists():
        sys.exit(f"Missing source: {SRC}")
    SPEAKER_DIR.mkdir(parents=True, exist_ok=True)
    text = SRC.read_text(encoding="utf-8")

    print("Master pack:")
    write_pdf(md_to_html(text), "RubixCube 26097 Video Script",
              OUT / "RubixCube_26097_Video_Script.pdf", chrome)

    print("Speaker pages:")
    for num, title, body in split_sections(text):
        slug = re.sub(r"[^A-Za-z0-9]+", "_", title).strip("_")
        header = (
            '<div class="hdr">'
            f'<h1>Speaker {num} &mdash; {title.title()}</h1>'
            '<div class="sub">TEAM RUBIXCUBE &middot; SIH 2026 &middot; PS 26097 &middot; '
            'Idea video &mdash; your section only</div></div>'
        )
        html = header + RULE_CARD + md_to_html(body)
        write_pdf(html, f"Speaker {num}", SPEAKER_DIR / f"Speaker_{num}_{slug}.pdf", chrome)


if __name__ == "__main__":
    main()
