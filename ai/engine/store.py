"""SQLite storage, schema per spec §2.1 (simplified). Standard library only.

Answers hang off the person (beneficiary), not the call, so a dropped call loses
nothing. Stored: confirmed/normalised values only. Never stored: audio, transcripts,
raw phone numbers.
"""

import datetime as dt
import json
import os
import sqlite3
import threading
import uuid
from pathlib import Path

DEFAULT = Path(__file__).resolve().parent.parent / ".storage" / "engine.db"

SCHEMA = """
create table if not exists beneficiary (
  id text primary key,
  phone_hash text not null,
  ordinal integer not null,
  district text,
  consent_state text not null default 'NONE',   -- NONE|GIVEN|GUARDIAN_GIVEN|GUARDIAN_PENDING|WITHDRAWN
  created_at text not null,
  unique (phone_hash, ordinal)
);
create table if not exists session (
  id text primary key,
  beneficiary_id text references beneficiary,
  channel text not null,
  channel_ref text not null unique,
  phone_hash text not null,
  state text not null,                            -- JSON: flow position, retries, candidate
  status text not null,                           -- ACTIVE|RESUMABLE|COMPLETED|ABANDONED
  started_at text not null,
  last_turn_at text not null
);
create table if not exists answer (
  beneficiary_id text not null references beneficiary,
  field text not null,                            -- q0..q7
  value text,                                     -- JSON; null while deferred
  confidence real not null,
  method text not null,                           -- LEXICON|REGEX|LLM|DTMF|DEFER
  confirmed_at text,                              -- null = not (yet) accepted by the caller
  session_id text,
  primary key (beneficiary_id, field)
);
create table if not exists consent_event (
  id text primary key, beneficiary_id text not null, kind text not null,
  script_version text not null, channel text not null, captured_at text not null
);
create table if not exists callback_request (
  id text primary key, beneficiary_id text not null, session_id text not null,
  at_state text not null, status text not null default 'OPEN', created_at text not null
);
create table if not exists recommendation (
  id text primary key, beneficiary_id text not null, ranked text not null,
  weights_version text not null, nqr_snapshot_sha text not null,
  asset_grant_path integer not null, created_at text not null
);
"""


def now():
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")


class Store:
    def __init__(self, path: str | Path | None = None):
        path = Path(path or os.environ.get("ENGINE_DB", DEFAULT))
        if str(path) != ":memory:":
            path.parent.mkdir(parents=True, exist_ok=True)
        self.db = sqlite3.connect(str(path), check_same_thread=False, isolation_level=None)
        self.db.row_factory = sqlite3.Row
        self.db.executescript(SCHEMA)
        # ponytail: one lock for the whole engine; per-session locks if throughput ever matters
        self.lock = threading.RLock()

    def q(self, sql, *args):
        return self.db.execute(sql, args)

    # --- people ------------------------------------------------------------------

    def new_beneficiary(self, phone_hash) -> str:
        n = self.q("select coalesce(max(ordinal),0)+1 from beneficiary where phone_hash=?",
                   phone_hash).fetchone()[0]
        bid = str(uuid.uuid4())
        self.q("insert into beneficiary(id,phone_hash,ordinal,created_at) values(?,?,?,?)",
               bid, phone_hash, n, now())
        return bid

    def resumable(self, phone_hash):
        """Latest person on this phone who consented: the one a redial may continue."""
        return self.q("""select * from beneficiary where phone_hash=?
                         and consent_state in ('GIVEN','GUARDIAN_GIVEN') order by ordinal desc limit 1""",
                      phone_hash).fetchone()

    def beneficiary(self, bid):
        return self.q("select * from beneficiary where id=?", bid).fetchone()

    def set_beneficiary(self, bid, **cols):
        for k, v in cols.items():
            self.q(f"update beneficiary set {k}=? where id=?", v, bid)

    def consent(self, bid, kind, channel, script_version="consent.hi.v1"):
        self.q("insert into consent_event values(?,?,?,?,?,?)",
               str(uuid.uuid4()), bid, kind, script_version, channel, now())

    # --- sessions ------------------------------------------------------------------

    def session(self, channel_ref):
        r = self.q("select * from session where channel_ref=?", channel_ref).fetchone()
        return (dict(r) | {"state": json.loads(r["state"])}) if r else None

    def new_session(self, channel, channel_ref, phone_hash, state):
        sid = str(uuid.uuid4())
        self.q("insert into session values(?,?,?,?,?,?,?,?,?)", sid, None, channel, channel_ref,
               phone_hash, json.dumps(state), "ACTIVE", now(), now())
        return self.session(channel_ref)

    def save_session(self, s):
        self.q("update session set beneficiary_id=?, state=?, status=?, last_turn_at=? where id=?",
               s["beneficiary_id"], json.dumps(s["state"], ensure_ascii=False), s["status"], now(), s["id"])

    # --- answers --------------------------------------------------------------------

    def answers(self, bid) -> dict:
        rows = self.q("select * from answer where beneficiary_id=?", bid).fetchall()
        return {r["field"]: dict(r) | {"value": json.loads(r["value"]) if r["value"] else None}
                for r in rows}

    def put_answer(self, bid, field, value, confidence, method, session_id, confirmed=True):
        self.q("""insert into answer values(?,?,?,?,?,?,?)
                  on conflict(beneficiary_id, field) do update set value=excluded.value,
                  confidence=excluded.confidence, method=excluded.method,
                  confirmed_at=excluded.confirmed_at, session_id=excluded.session_id""",
               bid, field, None if value is None else json.dumps(value, ensure_ascii=False),
               confidence, method, now() if confirmed else None, session_id)

    def callback_request(self, bid, session_id, at_state):
        """Caller pressed the help key: a district worker should call them."""
        self.q("insert into callback_request(id,beneficiary_id,session_id,at_state,created_at) values(?,?,?,?,?)",
               str(uuid.uuid4()), bid, session_id, at_state, now())

    def save_recommendation(self, bid, result, ranked):
        self.q("insert into recommendation values(?,?,?,?,?,?,?)", str(uuid.uuid4()), bid,
               json.dumps(ranked, ensure_ascii=False), result["weights_version"],
               result["nqr_snapshot_sha"], int(result["self_employment"]), now())
