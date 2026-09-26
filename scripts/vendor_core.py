#!/usr/bin/env python3
"""Copy packages/core/src into supabase/functions/_core so Deno can run it.

Why a copy exists at all, given the whole point of @rc097/core is that there is exactly one
implementation of the interview: the Supabase CLI only uploads what lives under
`supabase/functions/`. A relative import that climbs out of that directory is not bundled, so the
edge function would deploy and then fail at runtime on a missing module.

This is therefore a *generated* directory, never edited by hand, and re-synced on every deploy. The
header written into each file says so. If the two ever disagree, the copy is wrong by definition.

It also rewrites `./x.js` imports to `./x.ts`. The core is authored with `.js` specifiers because
that is what Node and bundlers want from TypeScript ESM; Deno resolves the literal path and would
look for a `.js` file that was never emitted.

Run:  python3 scripts/vendor_core.py
"""

from __future__ import annotations

import re
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "packages" / "core" / "src"
DEST = ROOT / "supabase" / "functions" / "_core"

HEADER = """// GENERATED FILE — DO NOT EDIT.
// Copied from packages/core/src/{rel} by scripts/vendor_core.py.
// Edit the original; this copy is re-synced on every deploy.

"""


def main() -> None:
    if not SRC.exists():
        sys.exit(f"missing {SRC}")

    if DEST.exists():
        shutil.rmtree(DEST)
    DEST.mkdir(parents=True)

    count = 0
    for src_file in sorted(SRC.rglob("*.ts")):
        rel = src_file.relative_to(SRC)
        out = DEST / rel
        out.parent.mkdir(parents=True, exist_ok=True)

        text = src_file.read_text()
        # './types.js' -> './types.ts', including './data/x.js'
        text = re.sub(r"(from\s+['\"])(\.[^'\"]*?)\.js(['\"])", r"\1\2.ts\3", text)
        out.write_text(HEADER.format(rel=rel.as_posix()) + text)
        count += 1

    (DEST / ".gitattributes").write_text("* linguist-generated=true\n")
    print(f"vendored {count} files -> {DEST.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
