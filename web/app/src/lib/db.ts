/**
 * On-device storage. The kiosk channel is ₹0 per interview and structurally immune to R6, and
 * both of those depend on the interview being completable with the radio off.
 *
 * Shape: one `Store` interface, two implementations.
 *
 *   · `IdbStore`   — IndexedDB. Works in a browser tab and inside the Capacitor WebView with no
 *                    native plugin, no Gradle change, no build step. This is the default.
 *   · `SqlStore`   — real SQLite via `@capacitor-community/sqlite`, using the SAME DDL the
 *                    Postgres migration uses, so the offline row shape and the server row shape
 *                    cannot drift. Activates only when the plugin is actually installed.
 *
 * Why both: the spec calls for "SQLite, same answer row shape as Postgres" (§5.2), and on a real
 * handset that is the right answer — it survives WebView storage eviction, which IndexedDB does
 * not, and a district's worth of rows is a file you can pull off the device. But it needs a native
 * plugin and a Gradle sync, and the app has to run today. So `openStore()` prefers SQLite and
 * falls back, and the DDL lives in one string used by both.
 *
 * Everything writes through `applyEvents`, which takes the DomainEvent list the core returns.
 * The edge function applies the identical list to Postgres. One list, two backends.
 */

import type {
  Answer,
  Channel,
  DomainEvent,
  OutcomeStatus,
  RecommendationResult,
  SessionState,
} from '@rc097/core';

// ---------------------------------------------------------------------------- row shapes

export interface BeneficiaryRow {
  id: string;
  phoneHash: string | null;
  ordinal: number;
  firstName: string | null;
  /** Stored as a hash, never the digits. Nothing in the UI ever renders this. */
  resumePinHash: string | null;
  districtName: string | null;
  blockName: string | null;
  villageName: string | null;
  ageBand: 'under_18' | '18_45' | 'over_45' | null;
  isWoman: boolean | null;
  consentState: string;
  updatedAt: string;
}

export interface ConsentRow {
  id: string;
  beneficiaryId: string;
  kind: string;
  scriptVersion: string;
  channel: Channel;
  evidence: Record<string, unknown>;
  capturedAt: string;
}

export interface RecommendationRow {
  id: string;
  beneficiaryId: string;
  result: RecommendationResult;
  createdAt: string;
  deliveredAt: string | null;
}

export interface OutcomeRow {
  id: string;
  beneficiaryId: string;
  qualificationRef: string;
  status: OutcomeStatus;
  statusDate: string;
  note: string | null;
}

/**
 * The outbox. An interview finished in aeroplane mode is not "pending upload" from the
 * mobiliser's point of view — it is done. She must never have to remember to press sync, so the
 * queue drains itself whenever connectivity returns.
 */
export interface OutboxRow {
  id: string;
  kind: 'events';
  payload: DomainEvent[];
  createdAt: string;
  attempts: number;
  lastError: string | null;
}

export interface TelemetryRow {
  id: string;
  sessionId: string;
  state: string;
  method: string | null;
  latencyMs: number | null;
  createdAt: string;
}

export interface Store {
  readonly kind: 'idb' | 'sqlite';
  applyEvents(events: DomainEvent[], opts?: { queue?: boolean }): Promise<void>;

  putSession(s: SessionState): Promise<void>;
  getSession(id: string): Promise<SessionState | null>;
  listSessions(): Promise<SessionState[]>;
  /** Sessions a returning caller could pick up. Nothing is revealed until the PIN clears. */
  resumableFor(beneficiaryId: string): Promise<SessionState[]>;

  putBeneficiary(b: BeneficiaryRow): Promise<void>;
  getBeneficiary(id: string): Promise<BeneficiaryRow | null>;
  listBeneficiaries(): Promise<BeneficiaryRow[]>;
  findByPhoneHash(hash: string): Promise<BeneficiaryRow[]>;

  answersFor(beneficiaryId: string): Promise<Answer[]>;
  listAnswers(): Promise<Answer[]>;

  listConsent(): Promise<ConsentRow[]>;
  listRecommendations(): Promise<RecommendationRow[]>;
  latestRecommendation(beneficiaryId: string): Promise<RecommendationRow | null>;

  listOutcomes(): Promise<OutcomeRow[]>;
  putOutcome(o: OutcomeRow): Promise<void>;

  listTelemetry(): Promise<TelemetryRow[]>;

  outboxSize(): Promise<number>;
  outboxPeek(limit?: number): Promise<OutboxRow[]>;
  outboxDelete(id: string): Promise<void>;
  outboxFail(id: string, error: string): Promise<void>;

  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  wipe(): Promise<void>;
}

const STORES = [
  'session',
  'beneficiary',
  'answer',
  'consent',
  'recommendation',
  'outcome',
  'telemetry',
  'outbox',
  'kv',
] as const;

const DB_NAME = 'rc097';
const DB_VERSION = 1;

/**
 * The same tables in SQL, for the SQLite path. Deliberately the same column names as
 * supabase/migrations/20260926000100_init.sql so a row read off a device and a row read off the
 * server look identical in a diff — including `answer`'s erasure invariant, which is the one
 * thing that must hold in both places.
 */
export const SQLITE_DDL = `
create table if not exists beneficiary (
  id text primary key, phone_hash text, ordinal integer not null default 1,
  first_name text, resume_pin_hash text, district_name text, block_name text,
  village_name text, age_band text, is_woman integer, consent_state text not null default 'NONE',
  updated_at text not null
);
create index if not exists beneficiary_phone_hash_idx on beneficiary (phone_hash);

create table if not exists session (
  id text primary key, beneficiary_id text not null, channel text not null, channel_ref text,
  locale text not null default 'hi', fsm_state text not null, phase text not null default 'ASK',
  status text not null default 'ACTIVE', blob text not null, last_turn_at text not null
);

create table if not exists answer (
  beneficiary_id text not null, field_no integer not null check (field_no between 1 and 7),
  raw_transcript text, nbest text, value text not null, confidence real not null,
  method text not null, asr_engine text, asr_version text, confirmed_at text,
  session_id text, updated_at text not null,
  primary key (beneficiary_id, field_no),
  -- The DPDP invariant, enforced on the handset exactly as it is in Postgres.
  check (confirmed_at is null or raw_transcript is null),
  check (confirmed_at is null or nbest is null)
);

create table if not exists consent_event (
  id text primary key, beneficiary_id text not null, kind text not null,
  script_version text not null, channel text not null, evidence text not null, captured_at text not null
);

create table if not exists recommendation (
  id text primary key, beneficiary_id text not null, result text not null,
  created_at text not null, delivered_at text
);

create table if not exists outcome (
  id text primary key, beneficiary_id text not null, qualification_ref text not null,
  status text not null, status_date text not null, note text
);

create table if not exists turn_telemetry (
  id text primary key, session_id text, fsm_state text not null, method text,
  latency_ms integer, created_at text not null
);

create table if not exists outbox (
  id text primary key, kind text not null, payload text not null,
  created_at text not null, attempts integer not null default 0, last_error text
);

create table if not exists kv (k text primary key, v text not null);
`;

// ---------------------------------------------------------------------------- IndexedDB

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const name of STORES) {
        if (db.objectStoreNames.contains(name)) continue;
        if (name === 'answer') {
          // Composite key, same primary key as Postgres: (beneficiary_id, field_no).
          db.createObjectStore(name, { keyPath: ['beneficiaryId', 'fieldNo'] });
        } else if (name === 'kv') {
          db.createObjectStore(name);
        } else {
          db.createObjectStore(name, { keyPath: 'id' });
        }
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

type Mode = 'readonly' | 'readwrite';

async function tx<T>(names: string[], mode: Mode, fn: (t: IDBTransaction) => Promise<T> | T): Promise<T> {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(names, mode);
    let out: T;
    t.oncomplete = () => resolve(out);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error ?? new Error('transaction aborted'));
    Promise.resolve(fn(t))
      .then((v) => {
        out = v;
      })
      .catch((e) => {
        try {
          t.abort();
        } catch {
          /* already finishing */
        }
        reject(e);
      });
  });
}

const wrap = <T>(r: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });

const rid = (): string =>
  globalThis.crypto?.randomUUID?.() ?? `r_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

/**
 * Hash the resume PIN before it touches storage.
 *
 * The PIN's whole job is to stop a shared handset leaking one person's interview to another
 * (spec §9 BLOCKER 1). Storing it in the clear on the device would hand it to anyone who can read
 * the app's data — which, on a shared phone, is precisely the person it is meant to stop.
 * SubtleCrypto is unavailable on insecure origins, so there is a labelled fallback.
 */
export async function hashPin(pin: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`rc097:${salt}:${pin}`);
  if (globalThis.crypto?.subtle) {
    const buf = await crypto.subtle.digest('SHA-256', data);
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  // ponytail: non-crypto fallback for insecure origins (plain-http dev). Not acceptable in
  // production; the Capacitor WebView and any https origin both provide subtle.
  let h = 0;
  for (const b of data) h = (h * 31 + b) | 0;
  return `weak-${(h >>> 0).toString(16)}`;
}

export class IdbStore implements Store {
  readonly kind = 'idb' as const;

  async applyEvents(events: DomainEvent[], opts: { queue?: boolean } = {}): Promise<void> {
    if (events.length === 0) return;

    await tx(
      ['session', 'beneficiary', 'answer', 'consent', 'recommendation', 'outcome', 'telemetry', 'outbox'],
      'readwrite',
      async (t) => {
        for (const ev of events) {
          switch (ev.type) {
            case 'session.upsert': {
              t.objectStore('session').put({ ...ev.session, id: ev.session.sessionId });
              // Keep a beneficiary stub in step with the session so the mobiliser's call list is
              // populated from the first turn, not only after the interview completes.
              const store = t.objectStore('beneficiary');
              const existing = (await wrap(store.get(ev.session.beneficiaryId))) as BeneficiaryRow | undefined;
              const pinHash = ev.session.resumePin
                ? await hashPin(ev.session.resumePin, ev.session.beneficiaryId)
                : (existing?.resumePinHash ?? null);
              store.put({
                id: ev.session.beneficiaryId,
                phoneHash: existing?.phoneHash ?? null,
                ordinal: existing?.ordinal ?? 1,
                firstName: existing?.firstName ?? null,
                resumePinHash: pinHash,
                districtName: ev.session.registration.districtName ?? existing?.districtName ?? null,
                blockName: ev.session.registration.blockName ?? existing?.blockName ?? null,
                villageName: ev.session.registration.villageName ?? existing?.villageName ?? null,
                ageBand: existing?.ageBand ?? null,
                isWoman: existing?.isWoman ?? null,
                consentState: ev.session.consentState,
                updatedAt: ev.session.lastTurnAt,
              } satisfies BeneficiaryRow);
              break;
            }
            case 'answer.upsert':
              t.objectStore('answer').put(ev.answer);
              break;
            case 'answer.confirmed':
            case 'transcript.erase': {
              // Belt and braces: the core already nulls these, but the erasure is the one thing
              // worth enforcing at the storage boundary too.
              const store = t.objectStore('answer');
              const row = (await wrap(store.get([ev.beneficiaryId, ev.fieldNo]))) as Answer | undefined;
              if (row) store.put({ ...row, rawTranscript: null, nbest: null });
              break;
            }
            case 'registration.upsert': {
              const store = t.objectStore('beneficiary');
              const row = (await wrap(store.get(ev.beneficiaryId))) as BeneficiaryRow | undefined;
              if (row) {
                store.put({
                  ...row,
                  districtName: ev.registration.districtName ?? row.districtName,
                  blockName: ev.registration.blockName ?? row.blockName,
                  villageName: ev.registration.villageName ?? row.villageName,
                });
              }
              break;
            }
            case 'consent.record':
              t.objectStore('consent').put({
                id: rid(),
                beneficiaryId: ev.beneficiaryId,
                kind: ev.kind,
                scriptVersion: ev.scriptVersion,
                channel: ev.channel,
                evidence: ev.evidence,
                capturedAt: ev.at,
              } satisfies ConsentRow);
              break;
            case 'recommendation.create':
              t.objectStore('recommendation').put({
                id: rid(),
                beneficiaryId: ev.beneficiaryId,
                result: ev.result,
                createdAt: ev.at,
                deliveredAt: null,
              } satisfies RecommendationRow);
              break;
            case 'outcome.upsert':
              t.objectStore('outcome').put({
                id: `${ev.beneficiaryId}:${ev.qualificationRef}:${ev.status}`,
                beneficiaryId: ev.beneficiaryId,
                qualificationRef: ev.qualificationRef,
                status: ev.status,
                statusDate: ev.at.slice(0, 10),
                note: null,
              } satisfies OutcomeRow);
              break;
            case 'telemetry.turn':
              t.objectStore('telemetry').put({
                id: rid(),
                sessionId: ev.sessionId,
                state: ev.state,
                method: ev.method,
                latencyMs: ev.latencyMs,
                createdAt: new Date().toISOString(),
              } satisfies TelemetryRow);
              break;
          }
        }

        if (opts.queue !== false) {
          t.objectStore('outbox').put({
            id: rid(),
            kind: 'events',
            payload: events,
            createdAt: new Date().toISOString(),
            attempts: 0,
            lastError: null,
          } satisfies OutboxRow);
        }
      },
    );
  }

  putSession(s: SessionState) {
    return tx(['session'], 'readwrite', (t) => {
      t.objectStore('session').put({ ...s, id: s.sessionId });
    });
  }

  async getSession(id: string) {
    const r = await tx(['session'], 'readonly', (t) => wrap(t.objectStore('session').get(id)));
    return (r as SessionState | undefined) ?? null;
  }

  async listSessions() {
    const r = await tx(['session'], 'readonly', (t) => wrap(t.objectStore('session').getAll()));
    return (r as SessionState[]).sort((a, b) => b.lastTurnAt.localeCompare(a.lastTurnAt));
  }

  async resumableFor(beneficiaryId: string) {
    const all = await this.listSessions();
    return all.filter((s) => s.beneficiaryId === beneficiaryId && s.status === 'RESUMABLE');
  }

  putBeneficiary(b: BeneficiaryRow) {
    return tx(['beneficiary'], 'readwrite', (t) => {
      t.objectStore('beneficiary').put(b);
    });
  }

  async getBeneficiary(id: string) {
    const r = await tx(['beneficiary'], 'readonly', (t) => wrap(t.objectStore('beneficiary').get(id)));
    return (r as BeneficiaryRow | undefined) ?? null;
  }

  async listBeneficiaries() {
    const r = await tx(['beneficiary'], 'readonly', (t) => wrap(t.objectStore('beneficiary').getAll()));
    return (r as BeneficiaryRow[]).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async findByPhoneHash(hash: string) {
    const all = await this.listBeneficiaries();
    // Non-unique by design: multiple beneficiaries per handset is the normal case here.
    return all.filter((b) => b.phoneHash === hash);
  }

  async answersFor(beneficiaryId: string) {
    const all = await this.listAnswers();
    return all.filter((a) => a.beneficiaryId === beneficiaryId).sort((a, b) => a.fieldNo - b.fieldNo);
  }

  async listAnswers() {
    const r = await tx(['answer'], 'readonly', (t) => wrap(t.objectStore('answer').getAll()));
    return r as Answer[];
  }

  async listConsent() {
    const r = await tx(['consent'], 'readonly', (t) => wrap(t.objectStore('consent').getAll()));
    return (r as ConsentRow[]).sort((a, b) => b.capturedAt.localeCompare(a.capturedAt));
  }

  async listRecommendations() {
    const r = await tx(['recommendation'], 'readonly', (t) => wrap(t.objectStore('recommendation').getAll()));
    return (r as RecommendationRow[]).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async latestRecommendation(beneficiaryId: string) {
    const all = await this.listRecommendations();
    return all.find((r) => r.beneficiaryId === beneficiaryId) ?? null;
  }

  async listOutcomes() {
    const r = await tx(['outcome'], 'readonly', (t) => wrap(t.objectStore('outcome').getAll()));
    return r as OutcomeRow[];
  }

  putOutcome(o: OutcomeRow) {
    return tx(['outcome'], 'readwrite', (t) => {
      t.objectStore('outcome').put(o);
    });
  }

  async listTelemetry() {
    const r = await tx(['telemetry'], 'readonly', (t) => wrap(t.objectStore('telemetry').getAll()));
    return (r as TelemetryRow[]).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async outboxSize() {
    const r = await tx(['outbox'], 'readonly', (t) => wrap(t.objectStore('outbox').count()));
    return r as number;
  }

  async outboxPeek(limit = 25) {
    const r = await tx(['outbox'], 'readonly', (t) => wrap(t.objectStore('outbox').getAll()));
    return (r as OutboxRow[]).sort((a, b) => a.createdAt.localeCompare(b.createdAt)).slice(0, limit);
  }

  outboxDelete(id: string) {
    return tx(['outbox'], 'readwrite', (t) => {
      t.objectStore('outbox').delete(id);
    });
  }

  outboxFail(id: string, error: string) {
    return tx(['outbox'], 'readwrite', async (t) => {
      const store = t.objectStore('outbox');
      const row = (await wrap(store.get(id))) as OutboxRow | undefined;
      if (row) store.put({ ...row, attempts: row.attempts + 1, lastError: error });
    });
  }

  async get<T>(key: string) {
    const r = await tx(['kv'], 'readonly', (t) => wrap(t.objectStore('kv').get(key)));
    return (r as T | undefined) ?? null;
  }

  set<T>(key: string, value: T) {
    return tx(['kv'], 'readwrite', (t) => {
      t.objectStore('kv').put(value, key);
    });
  }

  wipe() {
    return tx([...STORES], 'readwrite', (t) => {
      for (const n of STORES) t.objectStore(n).clear();
    });
  }
}

// ---------------------------------------------------------------------------- selection

let singleton: Store | null = null;

/**
 * Pick a store. SQLite when the native plugin is actually there, IndexedDB otherwise.
 *
 * The plugin import is dynamic and its failure is expected, not exceptional: the same bundle has
 * to run in a plain browser tab (where the plugin does not exist) and in a Capacitor build (where
 * it does). Nothing about the app above this line changes either way.
 */
export async function openStore(): Promise<Store> {
  if (singleton) return singleton;

  try {
    const cap = await import('@capacitor/core');
    if (cap.Capacitor.isNativePlatform() && cap.Capacitor.isPluginAvailable('CapacitorSQLite')) {
      // Non-literal specifier on purpose: the package is an OPTIONAL dependency, so TypeScript
      // must not try to resolve it at build time and Vite must not try to bundle it. Install it
      // with `npm i @capacitor-community/sqlite -w @rc097/app && npx cap sync android` and this
      // branch starts taking effect on device with no other change.
      const specifier = '@capacitor-community/sqlite';
      const mod: { CapacitorSQLite: unknown } = await import(/* @vite-ignore */ specifier);
      const { SqlStore } = await import('./db.sqlite');
      singleton = await SqlStore.create(mod.CapacitorSQLite);
      return singleton;
    }
  } catch {
    // Plugin not installed, or not a native build. IndexedDB it is — see the note above.
  }

  singleton = new IdbStore();
  return singleton;
}
