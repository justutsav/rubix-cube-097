#!/usr/bin/env python3
"""Apply the schema, seed reference data, and check the project — without the CLI.

Why this exists rather than `supabase db push`: that command wants the database password, which
nobody has to hand at 2am, and the CLI login flow needs the personal access token on a command
line. The Management API takes the access token in a header and runs SQL directly, which is both
fewer moving parts and one less place for a credential to end up in a shell history file.

The token is read from a file, never from a flag and never from a literal in this script:

    ~/.config/rc097/supabase-access-token      (mode 600, outside the repo)

Usage:
    python3 scripts/supabase_admin.py status
    python3 scripts/supabase_admin.py apply          # run every migration in supabase/migrations
    python3 scripts/supabase_admin.py seed           # districts, blocks, qualifications, opportunities
    python3 scripts/supabase_admin.py demo           # a synthetic cohort, for the spread chart
    python3 scripts/supabase_admin.py sql "select 1"
"""

from __future__ import annotations

import json
import os
import random
import sys
import urllib.error
import urllib.request
from pathlib import Path

PROJECT_REF = os.environ.get("RC097_PROJECT_REF", "sktrbrtaprzzdnjvqxlu")
TOKEN_PATH = Path.home() / ".config" / "rc097" / "supabase-access-token"
ROOT = Path(__file__).resolve().parent.parent
API = "https://api.supabase.com/v1"


def token() -> str:
    if not TOKEN_PATH.exists():
        sys.exit(
            f"No access token at {TOKEN_PATH}.\n"
            "Create it with:  mkdir -p ~/.config/rc097 && "
            "printf '%s' '<your sbp_ token>' > ~/.config/rc097/supabase-access-token && "
            "chmod 600 ~/.config/rc097/supabase-access-token"
        )
    return TOKEN_PATH.read_text().strip()


def api(method: str, path: str, body: dict | None = None) -> tuple[int, object]:
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(
        f"{API}{path}",
        data=data,
        method=method,
        headers={
            "Authorization": f"Bearer {token()}",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            raw = r.read().decode()
            return r.status, (json.loads(raw) if raw else None)
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return e.code, json.loads(raw)
        except json.JSONDecodeError:
            return e.code, raw


def run_sql(sql: str) -> object:
    status, body = api("POST", f"/projects/{PROJECT_REF}/database/query", {"query": sql})
    if status >= 300:
        raise SystemExit(f"SQL failed ({status}): {body}")
    return body


# --------------------------------------------------------------------------- commands


def cmd_status() -> None:
    status, projects = api("GET", "/projects")
    if status >= 300:
        raise SystemExit(f"Could not list projects ({status}): {projects}")
    for p in projects if isinstance(projects, list) else []:
        mark = " <-- this one" if p["ref"] == PROJECT_REF else ""
        print(f"{p['name']:<20} {p['ref']}  {p['region']}  {p['status']}{mark}")

    tables = run_sql(
        "select table_name from information_schema.tables "
        "where table_schema = 'public' order by table_name"
    )
    names = [t["table_name"] for t in tables] if isinstance(tables, list) else []
    print(f"\npublic tables ({len(names)}): {', '.join(names) if names else '(none — run apply)'}")

    if "qualification" in names:
        for t in ("district", "block", "qualification", "district_opportunity", "beneficiary", "answer", "recommendation"):
            n = run_sql(f"select count(*) as n from {t}")
            print(f"  {t:<22} {n[0]['n']}")


def cmd_apply() -> None:
    migrations = sorted((ROOT / "supabase" / "migrations").glob("*.sql"))
    if not migrations:
        raise SystemExit("no migrations found")
    for m in migrations:
        print(f"applying {m.name} …", flush=True)
        run_sql(m.read_text())
        print(f"  ok  {m.name}")
    print("\nSchema applied.")


def _esc(v: object) -> str:
    if v is None:
        return "null"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float)):
        return str(v)
    return "'" + str(v).replace("'", "''") + "'"


def _read_ts_array(path: Path, marker: str) -> str:
    """Pull a TypeScript literal out of the core package.

    The seed data lives in packages/core/src/data/ because the offline app has to ship with it, and
    duplicating it into SQL would create a second copy that drifts. So it is read from there — the
    same file the FSM uses — rather than retyped.
    """
    text = path.read_text()
    start = text.index(marker)
    # Scan from after the `=`, not from the marker. `export const DISTRICTS: DistrictSeed[] = [`
    # contains a `[` inside the TYPE ANNOTATION, and locking on to that one returns the empty
    # array `[]`. That is exactly how districts and blocks seeded as zero while reporting success,
    # which then left every district_opportunity row with a null foreign key.
    eq = text.index("=", start)
    depth, i, out = 0, text.index("[", eq), []
    while i < len(text):
        c = text[i]
        out.append(c)
        if c == "[":
            depth += 1
        elif c == "]":
            depth -= 1
            if depth == 0:
                break
        i += 1
    return "".join(out)


def cmd_seed() -> None:
    """Districts, blocks, qualifications and opportunities, from packages/core."""
    import re

    core = ROOT / "packages" / "core" / "src" / "data"

    # --- districts and blocks
    dist_src = _read_ts_array(core / "districts.ts", "export const DISTRICTS")

    # One regex per district object, capturing that district's nested blocks array along with it.
    # Splitting the file on "name: '" does not work, because block entries carry a `name` too: each
    # district's chunk ended at its own first block and every block list came back empty.
    district_re = re.compile(
        r"name:\s*'([^']+)',\s*\n\s*stateName:\s*'([^']+)',\s*\n\s*lgdCode:\s*(null|\d+),"
        r"\s*\n\s*isPilot:\s*(true|false).*?blocks:\s*\[(.*?)\n\s*\]",
        re.S,
    )
    found = district_re.findall(dist_src)
    if not found:
        # Loud, not silent. A seed that reports success while inserting nothing is worse than one
        # that stops — the failure only surfaced three commands later as a null FK.
        raise SystemExit("could not parse DISTRICTS from packages/core/src/data/districts.ts")

    rows = [f"({_esc(n)}, {_esc(s)}, {lgd}, {pilot})" for n, s, lgd, pilot, _ in found]
    run_sql(
        "insert into district (name, state_name, lgd_code, is_pilot) values "
        + ", ".join(rows)
        + " on conflict (name, state_name) do nothing"
    )
    print(f"  districts: {len(rows)}")

    nblocks = 0
    for dname, _state, _lgd, _pilot, blocks_src in found:
        blocks = re.findall(r"name:\s*'([^']+)'", blocks_src)
        if not blocks:
            continue
        vals = ", ".join(
            f"((select id from district where name = {_esc(dname)} limit 1), {_esc(b)})" for b in blocks
        )
        run_sql(f"insert into block (district_id, name) values {vals} on conflict (district_id, name) do nothing")
        nblocks += len(blocks)
    print(f"  blocks: {nblocks}")

    # --- qualifications
    q_src = (core / "qualifications.ts").read_text()
    quals = re.findall(
        r"q\('([^']+)',\s*'([^']+)',\s*'([^']+)',\s*([\d.]+),\s*(\d+),\s*\[([^\]]*)\],\s*(true|false),\s*'(low|moderate|high)',\s*\[([\d, ]+)\]\)",
        q_src,
    )
    if quals:
        vals = []
        for local_id, title, sector, level, hours, concepts, self_emp, demand, delivery in quals:
            cs = [c.strip().strip("'") for c in concepts.split(",") if c.strip()]
            th, pr, em, ojt = [int(x.strip()) for x in delivery.split(",")]
            vals.append(
                f"({_esc(local_id)}, null, {_esc(title)}, {_esc(sector)}, {_esc('Level ' + level)}, {level}, "
                f"{hours}, {hours}, "
                f"{_esc(json.dumps({'theory': th, 'practical': pr, 'employability': em, 'ojtMandatory': ojt}))}::jsonb, "
                f"array[{', '.join(_esc(c) for c in cs)}]::text[], {self_emp}, {_esc(demand)}, "
                f"'PROTOTYPE_PENDING_NQR_IMPORT', current_date)"
            )
        run_sql(
            "insert into qualification (local_id, qp_code, title, sector, level_label, level_numeric, "
            "min_notional_hours, max_notional_hours, delivery_hours, concepts, self_employable, "
            "physical_demand, source, source_date) values " + ", ".join(vals) + " on conflict (local_id) do nothing"
        )
        print(f"  qualifications: {len(vals)}  (qp_code NULL — prototype, awaiting import_nqr.py)")

    # --- opportunities
    o_src = (core / "districts.ts").read_text()
    opps = re.findall(
        r"districtName:\s*'([^']+)',\s*\n\s*blockName:\s*(null|'[^']*'),\s*\n\s*conceptId:\s*'([^']+)',\s*\n\s*kind:\s*'([^']+)',\s*\n\s*title:\s*'([^']+)'",
        o_src,
    )
    sources = re.findall(r"source:\s*\n?\s*'([^']+)'|source:\s*'([^']+)'", o_src)
    flat_sources = [a or b for a, b in sources]
    if opps:
        vals = []
        for i, (dname, bname, concept, kind, title) in enumerate(opps):
            src = flat_sources[i] if i < len(flat_sources) else "PLACEHOLDER_NEEDS_SOURCING"
            # Unsourced rows are seeded too, deliberately — the officer console counts them and
            # shows a red band. Hiding them would make the data look better than it is.
            date = "current_date" if src != "PLACEHOLDER_NEEDS_SOURCING" else "current_date"
            bsel = (
                f"(select b.id from block b join district d on d.id = b.district_id "
                f"where d.name = {_esc(dname)} and b.name = {_esc(bname.strip(chr(39)))} limit 1)"
                if bname != "null"
                else "null"
            )
            vals.append(
                f"((select id from district where name = {_esc(dname)} limit 1), {bsel}, {_esc(concept)}, "
                f"{_esc(kind)}, {_esc(title)}, null, {_esc(src)}, {date})"
            )
        # Clearing first makes a re-run idempotent without inventing a unique constraint over a
        # free-text title. Every row in this table is seed data.
        run_sql("delete from district_opportunity")
        # `where district_id is not null` rather than letting one unmatched district abort the
        # batch. A row we cannot place is dropped and counted, never given a guessed district —
        # the whole point of this table is that each row is traceable to a real place.
        run_sql(
            "insert into district_opportunity (district_id, block_id, concept_id, kind, title, detail, source, source_date) "
            "select * from (values " + ", ".join(vals) + ") "
            "as v(district_id, block_id, concept_id, kind, title, detail, source, source_date) "
            "where v.district_id is not null"
        )
        placed = run_sql("select count(*) as n from district_opportunity")[0]["n"]
        print(f"  opportunities: {placed} of {len(opps)}"
              + ("" if placed == len(opps) else "  (unplaceable rows skipped, not faked)"))

    print("\nSeed complete.")


def cmd_demo() -> None:
    """A synthetic district cohort, so the spread chart has something to be judged against.

    This is explicitly fake data and it is labelled as such: every beneficiary gets
    village_name = 'DEMO — synthetic', so nobody mistakes a demo cohort for a real register. The
    point of it is the CAG comparison: run the recommender over a cohort and see whether the output
    concentrates the way PMKVY's did (40% of certifications in 10 job-roles).
    """
    rng = random.Random(26097)
    trades = [
        "TRADE.TAILORING", "TRADE.HANDLOOM_WEAVING", "TRADE.DAIRY", "TRADE.GOAT_REARING",
        "TRADE.POULTRY", "TRADE.MASONRY", "TRADE.CARPENTRY", "TRADE.ELECTRICIAN",
        "TRADE.BEAUTY_PARLOUR", "TRADE.FOOD_PROCESSING", "TRADE.MOBILE_REPAIR",
        "TRADE.BAMBOO_CANE", "TRADE.FISHERIES", "TRADE.BEEKEEPING", "TRADE.RETAIL_SHOP",
    ]
    educations = ["none", "read_write", "primary", "middle", "secondary", "higher_sec"]
    n = 60

    blocks = run_sql("select b.id, b.district_id from block b limit 12")
    if not blocks:
        raise SystemExit("seed the districts first: python3 scripts/supabase_admin.py seed")

    made = 0
    for i in range(n):
        blk = rng.choice(blocks)
        is_woman = rng.random() < 0.42
        edu = rng.choice(educations)
        trade = rng.choice(trades)
        interest = rng.sample(trades, k=rng.randint(1, 2))
        years = rng.randint(0, 20)

        b = run_sql(
            "insert into beneficiary (phone_hash, ordinal, district_id, block_id, village_name, is_woman, consent_state) "
            f"values (decode(md5('demo{i}'), 'hex'), 1, {_esc(blk['district_id'])}::uuid, {_esc(blk['id'])}::uuid, "
            f"'DEMO — synthetic', {str(is_woman).lower()}, 'GIVEN') returning id"
        )
        bid = b[0]["id"]
        sid = run_sql(
            f"insert into session (beneficiary_id, channel, fsm_state, status) values "
            f"({_esc(bid)}::uuid, 'app', 'CLOSE', 'COMPLETED') returning id"
        )[0]["id"]

        vals = [
            (1, {"kind": "education", "education": edu}),
            (2, {"kind": "occupation", "conceptId": trade, "years": years}),
            (3, {"kind": "livelihood", "conceptId": None, "status": rng.choice(["wage", "self", "casual", "none"])}),
            (4, {"kind": "concepts", "conceptIds": interest}),
            (5, {"kind": "mobility", "constraint": rng.choice(["none", "distance", "care_duty"]), "radiusKm": rng.choice([3, 5, 10, 30])}),
            (6, {"kind": "pref", "pref": rng.choice(["self", "wage", "either"])}),
            (7, {"kind": "local", "conceptIds": rng.sample(trades, k=1), "note": None}),
        ]
        rows = ", ".join(
            f"({_esc(bid)}::uuid, {fno}, null, null, {_esc(json.dumps(v))}::jsonb, 0.9, 'LEXICON', now(), {_esc(sid)}::uuid, now())"
            for fno, v in vals
        )
        run_sql(
            "insert into answer (beneficiary_id, field_no, raw_transcript, nbest, value, confidence, method, "
            "confirmed_at, session_id, updated_at) values " + rows
        )
        run_sql(
            "insert into consent_event (beneficiary_id, kind, script_version, channel, evidence) values "
            f"({_esc(bid)}::uuid, 'SPOKEN_YES', 'consent.ask.v1', 'app', '{{\"demo\":true}}'::jsonb)"
        )
        made += 1

    print(f"Demo cohort: {made} synthetic beneficiaries, all tagged 'DEMO — synthetic'.")
    print("Delete them with:  delete from beneficiary where village_name = 'DEMO — synthetic';")


def main() -> None:
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    cmd = sys.argv[1]
    if cmd == "status":
        cmd_status()
    elif cmd == "apply":
        cmd_apply()
    elif cmd == "seed":
        cmd_seed()
    elif cmd == "demo":
        cmd_demo()
    elif cmd == "sql":
        print(json.dumps(run_sql(sys.argv[2]), indent=2))
    else:
        print(__doc__)
        sys.exit(1)


if __name__ == "__main__":
    main()
