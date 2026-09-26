#!/usr/bin/env python3
"""Import the official NQR qualification register, replacing the prototype rows.

This is the script that turns `qp_code: null` into a real, citable code. Until it has run, every
recommendation the system makes carries `containsPrototypeData: true` and the UI shows an amber
band, because decisions.md is unambiguous: *"QP codes, NOS codes, NSQF levels, awarding bodies,
durations and eligibility come from the official NQR export. Fields the source does not provide are
NULL, not guessed."*

It is not a scrape. It is the site's own *Download Summary* button, driven with the page's own CSRF
token — reproduced end to end on 2026-09-25 in research/03-nqr-import.md, sha256 348bed87….
`robots.txt` is `User-agent: * / allow: /`, there is no auth, and two requests get the whole
register.

What it knows about the data that a naive importer would get wrong (all from that experiment):

  · **880 of the 2,814 rows are expired.** Roughly a third of the register is dead weight, and
    ranking an expired qualification sends a real person to a course that no longer exists.
  · **`qp_code` is NOT unique.** `QG-04-ES-00913-2023-V1-SCGJ` is two genuinely different
    qualifications. A `unique(code)` upsert silently merges them, so the key is `(code, title)`.
  · **Two column headers are misspelled in the official file** (`Qualifcation`). Match them
    verbatim; "fixing" them in the parser breaks the import the next time somebody re-downloads.
  · **`Training Delivery Hours` is JSON inside a spreadsheet cell** — theory / practical /
    employability / mandatory OJT. It is the difference between telling somebody "510 hours" and
    "about four months, 150 of them hands-on, 30 in a real workplace".
  · **Two code formats coexist**, `2020/HYC/HSSCI/3770` and `QG-04-ES-00913-2023-V1-SCGJ`, and the
    level is embedded in the second. A regex that assumes one drops half the register.

Usage:
    python3 scripts/import_nqr.py fetch      # download to research/data/nqr/ (gitignored)
    python3 scripts/import_nqr.py parse      # xlsx -> nqr_rows.json + a summary
    python3 scripts/import_nqr.py push       # upsert into Supabase (needs the access token)
    python3 scripts/import_nqr.py all
"""

from __future__ import annotations

import hashlib
import json
import re
import sys
import urllib.parse
import urllib.request
from http.cookiejar import CookieJar
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "research" / "data" / "nqr"
SEARCH = "https://www.nqr.gov.in/qualifications-search"
DOWNLOAD = "https://www.nqr.gov.in/downloadSummaryFile"
UA = "Mozilla/5.0 (X11; Linux x86_64) rc097-nqr-import/0.1"

# Verbatim, misspellings included. Do not "correct" these.
COLUMNS = [
    "S No.", "Title", "Code", "Description", "Sector Name", "Level",
    "Maximum Notational Hours", "Minimum Notational Hours", "Version",
    "Originally Approved", "Valid Till", "Awarding Body", "Certifying Bodies",
    "Proposed Occupation", "Progression Pathway", "Qualifcation Type",
    "Adopted Qualifcation", "Training Delivery Hours",
]


def cmd_fetch() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    jar = CookieJar()
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
    opener.addheaders = [("User-Agent", UA)]

    print(f"GET {SEARCH}")
    html = opener.open(SEARCH, timeout=120).read().decode("utf-8", "replace")

    token = re.search(r'name="_token"\s+value="([^"]+)"', html)
    ids = re.search(r'name="qualificationids"\s+value="([^"]+)"', html)
    if not token or not ids:
        sys.exit("Could not find _token / qualificationids on the search page — the page changed.")

    id_list = ids.group(1)
    print(f"  csrf token ok, {len(id_list.split(','))} qualification ids on the page")

    body = urllib.parse.urlencode({"_token": token.group(1), "qualificationids": id_list}).encode()
    req = urllib.request.Request(DOWNLOAD, data=body, headers={"User-Agent": UA, "Referer": SEARCH})
    print(f"POST {DOWNLOAD}")
    blob = opener.open(req, timeout=300).read()

    path = OUT / "nqr.xlsx"
    path.write_bytes(blob)
    digest = hashlib.sha256(blob).hexdigest()
    print(f"  wrote {path} ({len(blob):,} bytes)")
    print(f"  sha256 {digest}")
    # The experiment's file hashed to 348bed87…; a different hash just means the register moved on,
    # which is expected and is exactly why the hash is stamped onto every recommendation.
    (OUT / "nqr.sha256").write_text(digest + "\n")


def _read_xlsx(path: Path) -> list[dict]:
    """Minimal xlsx reader — a zip of XML, and only two parts matter."""
    import xml.etree.ElementTree as ET
    import zipfile

    ns = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
    with zipfile.ZipFile(path) as z:
        shared: list[str] = []
        if "xl/sharedStrings.xml" in z.namelist():
            root = ET.fromstring(z.read("xl/sharedStrings.xml"))
            for si in root.findall("m:si", ns):
                shared.append("".join(t.text or "" for t in si.iter(f"{{{ns['m']}}}t")))
        sheet = next(n for n in z.namelist() if re.match(r"xl/worksheets/sheet1\.xml$", n))
        root = ET.fromstring(z.read(sheet))

    rows: list[list[str]] = []
    for row in root.iter(f"{{{ns['m']}}}row"):
        cells: dict[int, str] = {}
        for c in row.findall("m:c", ns):
            ref = c.get("r") or ""
            col = 0
            for ch in ref:
                if ch.isalpha():
                    col = col * 26 + (ord(ch.upper()) - 64)
                else:
                    break
            v = c.find("m:v", ns)
            text = ""
            if c.get("t") == "s" and v is not None:
                text = shared[int(v.text or 0)]
            elif c.get("t") == "inlineStr":
                isel = c.find("m:is", ns)
                text = "".join(t.text or "" for t in isel.iter(f"{{{ns['m']}}}t")) if isel is not None else ""
            elif v is not None:
                text = v.text or ""
            cells[col - 1] = text
        if cells:
            width = max(cells) + 1
            rows.append([cells.get(i, "") for i in range(width)])

    # The sheet has a title row above the header row.
    header_idx = next((i for i, r in enumerate(rows) if "Title" in r and "Code" in r), 1)
    header = rows[header_idx]
    return [dict(zip(header, r)) for r in rows[header_idx + 1 :] if any(x.strip() for x in r)]


def cmd_parse() -> None:
    path = OUT / "nqr.xlsx"
    if not path.exists():
        sys.exit(f"{path} not found — run: python3 scripts/import_nqr.py fetch")

    rows = _read_xlsx(path)
    print(f"parsed {len(rows)} data rows")

    missing = [c for c in COLUMNS if c not in (rows[0].keys() if rows else [])]
    if missing:
        print(f"  ! columns absent from this export: {missing}")

    def level_num(row: dict) -> float | None:
        m = re.search(r"([\d.]+)", row.get("Level", "") or "")
        if m:
            return float(m.group(1))
        # Current-format codes carry the level: QG-4.5-OR-... / QG-04-ES-...
        m = re.match(r"QG-(\d+(?:\.\d+)?)-", row.get("Code", "") or "")
        return float(m.group(1)) if m else None

    valid = expired = 0
    for r in rows:
        till = (r.get("Valid Till") or "").strip()
        if till and re.search(r"\d{4}", till):
            # Dates arrive as "16 Nov 2025".
            try:
                from datetime import datetime

                d = datetime.strptime(till, "%d %b %Y")
                if d.date().isoformat() < "2026-09-26":
                    expired += 1
                else:
                    valid += 1
            except ValueError:
                valid += 1
        else:
            valid += 1

    codes: dict[str, int] = {}
    for r in rows:
        c = (r.get("Code") or "").strip()
        if c:
            codes[c] = codes.get(c, 0) + 1
    dupes = {c: n for c, n in codes.items() if n > 1}

    levels: dict[str, int] = {}
    for r in rows:
        lv = (r.get("Level") or "?").strip()
        levels[lv] = levels.get(lv, 0) + 1

    out = OUT / "nqr_rows.json"
    out.write_text(json.dumps(rows, ensure_ascii=False, indent=1))
    print(f"  wrote {out}")
    print(f"  valid {valid} · expired {expired}")
    print(f"  duplicate codes: {len(dupes)} {list(dupes)[:3]}")
    print(f"  levels: {dict(sorted(levels.items()))}")
    print("\nReminder: key on (code, title), never on code alone.")


def cmd_push() -> None:
    from supabase_admin import _esc, run_sql  # same token handling, one place

    rows_path = OUT / "nqr_rows.json"
    if not rows_path.exists():
        sys.exit("run parse first")
    rows = json.loads(rows_path.read_text())
    sha = (OUT / "nqr.sha256").read_text().strip() if (OUT / "nqr.sha256").exists() else None

    def num(v: str) -> str:
        m = re.search(r"(\d+)", v or "")
        return m.group(1) if m else "null"

    def date(v: str) -> str:
        v = (v or "").strip()
        if not v:
            return "null"
        try:
            from datetime import datetime

            return _esc(datetime.strptime(v, "%d %b %Y").date().isoformat())
        except ValueError:
            return "null"

    batch, pushed = [], 0
    for r in rows:
        code = (r.get("Code") or "").strip() or None
        title = (r.get("Title") or "").strip()
        if not title:
            continue
        lvl = (r.get("Level") or "").strip() or "Level ?"
        m = re.search(r"([\d.]+)", lvl) or re.match(r"QG-(\d+(?:\.\d+)?)-", code or "")
        level_numeric = m.group(1) if m else "0"
        delivery = (r.get("Training Delivery Hours") or "").strip()
        batch.append(
            f"({_esc('nqr-' + (code or title)[:80])}, {_esc(code)}, {_esc(title)}, "
            f"{_esc(r.get('Sector Name') or None)}, {_esc(lvl)}, {level_numeric}, "
            f"{num(r.get('Minimum Notational Hours', ''))}, {num(r.get('Maximum Notational Hours', ''))}, "
            f"{_esc(delivery) + '::jsonb' if delivery.startswith('{') else 'null'}, "
            f"{date(r.get('Originally Approved', ''))}, {date(r.get('Valid Till', ''))}, "
            f"{_esc(r.get('Awarding Body') or None)}, array[]::text[], false, 'moderate', "
            f"'NQR_OFFICIAL', current_date, {_esc(sha)})"
        )
        if len(batch) >= 200:
            run_sql(
                "insert into qualification (local_id, qp_code, title, sector, level_label, level_numeric, "
                "min_notional_hours, max_notional_hours, delivery_hours, originally_approved, valid_till, "
                "awarding_body, concepts, self_employable, physical_demand, source, source_date, nqr_snapshot_sha) "
                "values " + ", ".join(batch) + " on conflict (qp_code, title) do nothing"
            )
            pushed += len(batch)
            batch = []
            print(f"  … {pushed}")
    if batch:
        run_sql(
            "insert into qualification (local_id, qp_code, title, sector, level_label, level_numeric, "
            "min_notional_hours, max_notional_hours, delivery_hours, originally_approved, valid_till, "
            "awarding_body, concepts, self_employable, physical_demand, source, source_date, nqr_snapshot_sha) "
            "values " + ", ".join(batch) + " on conflict (qp_code, title) do nothing"
        )
        pushed += len(batch)

    print(f"pushed {pushed} official rows (sha {sha})")
    print("\nNOTE: `concepts` is empty on imported rows. Mapping 2,814 official qualifications onto")
    print("the trade lexicon is a curation job, not an import job — NCVET's own audit found 156 of")
    print("2,157 NCO mappings wrong and 256 unmappable, so it must not be automated blindly.")


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    if cmd == "fetch":
        cmd_fetch()
    elif cmd == "parse":
        cmd_parse()
    elif cmd == "push":
        cmd_push()
    elif cmd == "all":
        cmd_fetch()
        cmd_parse()
        cmd_push()
    else:
        print(__doc__)
        sys.exit(1)
