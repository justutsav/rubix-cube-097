#!/usr/bin/env python3
"""Deploy the edge functions and their secrets through the Management API.

Why not `supabase functions deploy`: that needs an interactive CLI login, and the access token is
already sitting in ~/.config/rc097/ where the rest of this toolchain reads it from. One credential
path, one place to revoke.

Every deploy re-vendors packages/core into supabase/functions/_core first, because the CLI (and
this API) only ship what lives under `supabase/functions/`, and a stale copy of the interview
engine on the server is the exact drift the single-core rule exists to prevent.

Usage:
    python3 scripts/deploy_functions.py secrets     # SARVAM_API_KEY, SERVER_PEPPER
    python3 scripts/deploy_functions.py deploy      # all three functions
    python3 scripts/deploy_functions.py deploy asr  # just one
    python3 scripts/deploy_functions.py list
"""

from __future__ import annotations

import json
import mimetypes
import os
import secrets as pysecrets
import subprocess
import sys
import urllib.error
import urllib.request
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FUNCTIONS = ROOT / "supabase" / "functions"
PROJECT_REF = os.environ.get("RC097_PROJECT_REF", "sktrbrtaprzzdnjvqxlu")
TOKEN_PATH = Path.home() / ".config" / "rc097" / "supabase-access-token"
SARVAM_PATH = Path.home() / ".config" / "rc097" / "sarvam-api-key"
PEPPER_PATH = Path.home() / ".config" / "rc097" / "server-pepper"
API = "https://api.supabase.com/v1"

# Shared directories every function needs. Underscore-prefixed, so Supabase treats them as
# libraries rather than as functions in their own right.
SHARED = ["_shared", "_core"]

FUNCS = {
    # verify_jwt=False on all three, and each for a different reason:
    #   asr      — the interview runs before any sign-in, and the kiosk channel has no account.
    #   turn     — called by the IVR and WhatsApp adapters, which authenticate with the service
    #              role, not with a user JWT.
    #   identity — reads the phone claim itself and returns 401 without one, so the gateway check
    #              would be redundant.
    "asr": {"entrypoint": "asr/index.ts", "verify_jwt": False},
    "turn": {"entrypoint": "turn/index.ts", "verify_jwt": False},
    "identity": {"entrypoint": "identity/index.ts", "verify_jwt": False},
}


def token() -> str:
    if not TOKEN_PATH.exists():
        sys.exit(f"No access token at {TOKEN_PATH}")
    return TOKEN_PATH.read_text().strip()


def api(method: str, path: str, body=None, raw: bytes | None = None, content_type: str | None = None):
    headers = {"Authorization": f"Bearer {token()}"}
    data = raw
    if body is not None:
        data = json.dumps(body).encode()
        headers["Content-Type"] = "application/json"
    if content_type:
        headers["Content-Type"] = content_type
    req = urllib.request.Request(f"{API}{path}", data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=300) as r:
            text = r.read().decode()
            return r.status, (json.loads(text) if text.strip().startswith(("{", "[")) else text)
    except urllib.error.HTTPError as e:
        text = e.read().decode()
        try:
            return e.code, json.loads(text)
        except json.JSONDecodeError:
            return e.code, text


def collect(slug: str) -> list[tuple[str, Path]]:
    """Every file the function needs, as (path-relative-to-functions-dir, absolute)."""
    out: list[tuple[str, Path]] = []
    fn_dir = FUNCTIONS / slug
    if not fn_dir.is_dir():
        sys.exit(f"no such function directory: {fn_dir}")
    for p in sorted(fn_dir.rglob("*.ts")):
        out.append((p.relative_to(FUNCTIONS).as_posix(), p))
    for shared in SHARED:
        d = FUNCTIONS / shared
        if not d.is_dir():
            continue
        for p in sorted(d.rglob("*.ts")):
            out.append((p.relative_to(FUNCTIONS).as_posix(), p))
    return out


def multipart(fields: dict[str, str], files: list[tuple[str, Path]]) -> tuple[bytes, str]:
    boundary = f"----rc097{uuid.uuid4().hex}"
    buf = bytearray()
    for name, value in fields.items():
        buf += f"--{boundary}\r\n".encode()
        buf += f'Content-Disposition: form-data; name="{name}"\r\n\r\n'.encode()
        buf += value.encode() + b"\r\n"
    for rel, path in files:
        ctype = mimetypes.guess_type(rel)[0] or "application/typescript"
        buf += f"--{boundary}\r\n".encode()
        buf += f'Content-Disposition: form-data; name="file"; filename="{rel}"\r\n'.encode()
        buf += f"Content-Type: {ctype}\r\n\r\n".encode()
        buf += path.read_bytes() + b"\r\n"
    buf += f"--{boundary}--\r\n".encode()
    return bytes(buf), f"multipart/form-data; boundary={boundary}"


def cmd_deploy(only: str | None = None) -> None:
    # Always re-sync the vendored core. A server running yesterday's FSM against today's app is the
    # drift the whole single-core rule exists to prevent.
    subprocess.run([sys.executable, str(ROOT / "scripts" / "vendor_core.py")], check=True)

    slugs = [only] if only else list(FUNCS)
    for slug in slugs:
        if slug not in FUNCS:
            sys.exit(f"unknown function {slug!r}; known: {', '.join(FUNCS)}")
        cfg = FUNCS[slug]
        files = collect(slug)
        meta = json.dumps(
            {
                "name": slug,
                "entrypoint_path": cfg["entrypoint"],
                "verify_jwt": cfg["verify_jwt"],
            }
        )
        payload, ctype = multipart({"metadata": meta}, files)
        kb = len(payload) / 1024
        print(f"deploying {slug}: {len(files)} files, {kb:.0f} KB …", flush=True)
        status, body = api(
            "POST",
            f"/projects/{PROJECT_REF}/functions/deploy?slug={slug}",
            raw=payload,
            content_type=ctype,
        )
        if status >= 300:
            print(f"  FAILED ({status}): {body}")
            continue
        version = body.get("version") if isinstance(body, dict) else "?"
        print(f"  ok  {slug}  version={version}")

    print(f"\nBase URL: https://{PROJECT_REF}.supabase.co/functions/v1/<slug>")


def cmd_secrets() -> None:
    """Push the vendor key and the phone-hash pepper into the project's secrets."""
    payload = []

    if SARVAM_PATH.exists():
        payload.append({"name": "SARVAM_API_KEY", "value": SARVAM_PATH.read_text().strip()})
    else:
        print(f"  ! {SARVAM_PATH} missing — the asr function will return an empty transcript")

    # The pepper makes hmac(e164, pepper) non-reversible by anyone holding a list of Indian mobile
    # numbers. Generated once and kept, because rotating it orphans every existing beneficiary row.
    if not PEPPER_PATH.exists():
        PEPPER_PATH.parent.mkdir(parents=True, exist_ok=True)
        PEPPER_PATH.write_text(pysecrets.token_hex(32))
        PEPPER_PATH.chmod(0o600)
        print(f"  generated a new server pepper at {PEPPER_PATH} (keep it; rotating it orphans "
              f"every phone_hash already stored)")
    payload.append({"name": "SERVER_PEPPER", "value": PEPPER_PATH.read_text().strip()})

    status, body = api("POST", f"/projects/{PROJECT_REF}/secrets", body=payload)
    if status >= 300:
        sys.exit(f"secrets failed ({status}): {body}")
    print(f"  set {len(payload)} secret(s): {', '.join(p['name'] for p in payload)}")


def cmd_list() -> None:
    status, body = api("GET", f"/projects/{PROJECT_REF}/functions")
    if status >= 300:
        sys.exit(f"list failed ({status}): {body}")
    if not body:
        print("no functions deployed")
        return
    for f in body:
        print(f"{f.get('slug', '?'):<12} v{f.get('version', '?'):<4} {f.get('status', '?'):<10} "
              f"verify_jwt={f.get('verify_jwt')}")


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    if cmd == "deploy":
        cmd_deploy(sys.argv[2] if len(sys.argv) > 2 else None)
    elif cmd == "secrets":
        cmd_secrets()
    elif cmd == "list":
        cmd_list()
    else:
        print(__doc__)
        sys.exit(1)
