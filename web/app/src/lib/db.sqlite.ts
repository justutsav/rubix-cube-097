/**
 * The SQLite implementation of `Store`, for the real Android build.
 *
 * Reached only from `openStore()` when `@capacitor-community/sqlite` is actually installed and we
 * are on a native platform. It exists because on a handset IndexedDB is evictable — Android can
 * reclaim WebView storage under pressure, and losing a mobiliser's afternoon of doorstep
 * interviews to a cache eviction is not an acceptable failure mode. A SQLite file is also
 * something you can pull off a device with adb when a district reports a discrepancy.
 *
 * It reuses `SQLITE_DDL` from db.ts, which is deliberately the same column set as the Postgres
 * migration — including the two CHECK constraints that make it impossible to hold a raw
 * transcript against a confirmed answer. The DPDP invariant holds on the phone, not just on the
 * server.
 *
 * The plugin is typed loosely on purpose: it is an optional dependency, so its types are not
 * guaranteed to be installed, and a hard import would break `tsc --noEmit` for everyone who has
 * not added it.
 */

import { SQLITE_DDL } from './db';
import type {
  Answer,
  Channel,
  DomainEvent,
  RecommendationResult,
  SessionState,
} from '@rc097/core';
import type {
  BeneficiaryRow,
  ConsentRow,
  OutboxRow,
  OutcomeRow,
  RecommendationRow,
  Store,
  TelemetryRow,
} from './db';
import { hashPin } from './db';

type Row = Record<string, unknown>;

interface SqlitePlugin {
  createConnection(o: Record<string, unknown>): Promise<unknown>;
  open(o: Record<string, unknown>): Promise<unknown>;
  execute(o: Record<string, unknown>): Promise<unknown>;
  run(o: Record<string, unknown>): Promise<unknown>;
  query(o: Record<string, unknown>): Promise<{ values?: Row[] }>;
}

const DB = 'rc097';
const rid = (): string =>
  globalThis.crypto?.randomUUID?.() ?? `r_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export class SqlStore implements Store {
  readonly kind = 'sqlite' as const;

  private constructor(private readonly p: SqlitePlugin) {}

  static async create(plugin: unknown): Promise<SqlStore> {
    const p = plugin as SqlitePlugin;
    await p.createConnection({ database: DB, encrypted: false, mode: 'no-encryption', version: 1, readonly: false });
    await p.open({ database: DB, readonly: false });
    await p.execute({ database: DB, statements: SQLITE_DDL });
    return new SqlStore(p);
  }

  private async all<T>(statement: string, values: unknown[] = []): Promise<T[]> {
    const res = await this.p.query({ database: DB, statement, values });
    return (res.values ?? []) as T[];
  }

  private async run(statement: string, values: unknown[] = []): Promise<void> {
    await this.p.run({ database: DB, statement, values, transaction: false });
  }

  // ---------------------------------------------------------------- mapping
  // The session is stored twice over: the columns the officer console filters on, plus the whole
  // object as JSON. Filtering needs columns; resuming needs the exact state the FSM left behind,
  // and reconstructing that from columns would be a second, drifting definition of the session.

  private static toSession(r: Row): SessionState {
    return JSON.parse(String(r.blob)) as SessionState;
  }

  private static toAnswer(r: Row): Answer {
    return {
      beneficiaryId: String(r.beneficiary_id),
      fieldNo: Number(r.field_no) as Answer['fieldNo'],
      rawTranscript: (r.raw_transcript as string | null) ?? null,
      nbest: r.nbest ? (JSON.parse(String(r.nbest)) as string[]) : null,
      value: JSON.parse(String(r.value)) as Answer['value'],
      confidence: Number(r.confidence),
      method: String(r.method) as Answer['method'],
      asrEngine: (r.asr_engine as string | null) ?? null,
      asrVersion: (r.asr_version as string | null) ?? null,
      confirmedAt: (r.confirmed_at as string | null) ?? null,
      sessionId: String(r.session_id ?? ''),
      updatedAt: String(r.updated_at),
    };
  }

  private static toBeneficiary(r: Row): BeneficiaryRow {
    return {
      id: String(r.id),
      phoneHash: (r.phone_hash as string | null) ?? null,
      ordinal: Number(r.ordinal ?? 1),
      firstName: (r.first_name as string | null) ?? null,
      resumePinHash: (r.resume_pin_hash as string | null) ?? null,
      districtName: (r.district_name as string | null) ?? null,
      blockName: (r.block_name as string | null) ?? null,
      villageName: (r.village_name as string | null) ?? null,
      ageBand: (r.age_band as BeneficiaryRow['ageBand']) ?? null,
      isWoman: r.is_woman === null || r.is_woman === undefined ? null : Number(r.is_woman) === 1,
      consentState: String(r.consent_state ?? 'NONE'),
      updatedAt: String(r.updated_at),
    };
  }

  // ---------------------------------------------------------------- events

  async applyEvents(events: DomainEvent[], opts: { queue?: boolean } = {}): Promise<void> {
    for (const ev of events) {
      switch (ev.type) {
        case 'session.upsert': {
          const s = ev.session;
          await this.run(
            `insert into session (id, beneficiary_id, channel, channel_ref, locale, fsm_state, phase, status, blob, last_turn_at)
             values (?,?,?,?,?,?,?,?,?,?)
             on conflict(id) do update set fsm_state=excluded.fsm_state, phase=excluded.phase,
               status=excluded.status, blob=excluded.blob, last_turn_at=excluded.last_turn_at`,
            [s.sessionId, s.beneficiaryId, s.channel, s.channelRef, s.locale, s.state, s.phase, s.status, JSON.stringify(s), s.lastTurnAt],
          );
          const pinHash = s.resumePin ? await hashPin(s.resumePin, s.beneficiaryId) : null;
          await this.run(
            `insert into beneficiary (id, consent_state, district_name, block_name, village_name, resume_pin_hash, updated_at)
             values (?,?,?,?,?,?,?)
             on conflict(id) do update set consent_state=excluded.consent_state,
               district_name=coalesce(excluded.district_name, beneficiary.district_name),
               block_name=coalesce(excluded.block_name, beneficiary.block_name),
               village_name=coalesce(excluded.village_name, beneficiary.village_name),
               resume_pin_hash=coalesce(excluded.resume_pin_hash, beneficiary.resume_pin_hash),
               updated_at=excluded.updated_at`,
            [s.beneficiaryId, s.consentState, s.registration.districtName, s.registration.blockName, s.registration.villageName, pinHash, s.lastTurnAt],
          );
          break;
        }
        case 'answer.upsert': {
          const a = ev.answer;
          await this.run(
            `insert into answer (beneficiary_id, field_no, raw_transcript, nbest, value, confidence, method, asr_engine, asr_version, confirmed_at, session_id, updated_at)
             values (?,?,?,?,?,?,?,?,?,?,?,?)
             on conflict(beneficiary_id, field_no) do update set
               raw_transcript=excluded.raw_transcript, nbest=excluded.nbest, value=excluded.value,
               confidence=excluded.confidence, method=excluded.method, confirmed_at=excluded.confirmed_at,
               session_id=excluded.session_id, updated_at=excluded.updated_at`,
            [a.beneficiaryId, a.fieldNo, a.rawTranscript, a.nbest ? JSON.stringify(a.nbest) : null, JSON.stringify(a.value),
              a.confidence, a.method, a.asrEngine, a.asrVersion, a.confirmedAt, a.sessionId, a.updatedAt],
          );
          break;
        }
        case 'answer.confirmed':
        case 'transcript.erase':
          await this.run(
            `update answer set raw_transcript = null, nbest = null where beneficiary_id = ? and field_no = ?`,
            [ev.beneficiaryId, ev.fieldNo],
          );
          break;
        case 'registration.upsert':
          await this.run(
            `update beneficiary set district_name = coalesce(?, district_name),
               block_name = coalesce(?, block_name), village_name = coalesce(?, village_name) where id = ?`,
            [ev.registration.districtName, ev.registration.blockName, ev.registration.villageName, ev.beneficiaryId],
          );
          break;
        case 'consent.record':
          await this.run(
            `insert into consent_event (id, beneficiary_id, kind, script_version, channel, evidence, captured_at) values (?,?,?,?,?,?,?)`,
            [rid(), ev.beneficiaryId, ev.kind, ev.scriptVersion, ev.channel, JSON.stringify(ev.evidence), ev.at],
          );
          break;
        case 'recommendation.create':
          await this.run(
            `insert into recommendation (id, beneficiary_id, result, created_at, delivered_at) values (?,?,?,?,null)`,
            [rid(), ev.beneficiaryId, JSON.stringify(ev.result), ev.at],
          );
          break;
        case 'outcome.upsert':
          await this.run(
            `insert into outcome (id, beneficiary_id, qualification_ref, status, status_date, note) values (?,?,?,?,?,null)
             on conflict(id) do update set status_date=excluded.status_date`,
            [`${ev.beneficiaryId}:${ev.qualificationRef}:${ev.status}`, ev.beneficiaryId, ev.qualificationRef, ev.status, ev.at.slice(0, 10)],
          );
          break;
        case 'telemetry.turn':
          await this.run(
            `insert into turn_telemetry (id, session_id, fsm_state, method, latency_ms, created_at) values (?,?,?,?,?,?)`,
            [rid(), ev.sessionId, ev.state, ev.method, ev.latencyMs, new Date().toISOString()],
          );
          break;
      }
    }

    if (opts.queue !== false) {
      await this.run(`insert into outbox (id, kind, payload, created_at, attempts, last_error) values (?,?,?,?,0,null)`, [
        rid(),
        'events',
        JSON.stringify(events),
        new Date().toISOString(),
      ]);
    }
  }

  // ---------------------------------------------------------------- reads

  async putSession(s: SessionState) {
    await this.applyEvents([{ type: 'session.upsert', session: s }], { queue: false });
  }

  async getSession(id: string) {
    const rows = await this.all<Row>(`select blob from session where id = ?`, [id]);
    return rows[0] ? SqlStore.toSession(rows[0]) : null;
  }

  async listSessions() {
    const rows = await this.all<Row>(`select blob from session order by last_turn_at desc`);
    return rows.map(SqlStore.toSession);
  }

  async resumableFor(beneficiaryId: string) {
    const rows = await this.all<Row>(`select blob from session where beneficiary_id = ? and status = 'RESUMABLE'`, [beneficiaryId]);
    return rows.map(SqlStore.toSession);
  }

  async putBeneficiary(b: BeneficiaryRow) {
    await this.run(
      `insert into beneficiary (id, phone_hash, ordinal, first_name, resume_pin_hash, district_name, block_name, village_name, age_band, is_woman, consent_state, updated_at)
       values (?,?,?,?,?,?,?,?,?,?,?,?)
       on conflict(id) do update set phone_hash=excluded.phone_hash, ordinal=excluded.ordinal,
         first_name=excluded.first_name, resume_pin_hash=coalesce(excluded.resume_pin_hash, beneficiary.resume_pin_hash),
         district_name=excluded.district_name, block_name=excluded.block_name, village_name=excluded.village_name,
         age_band=excluded.age_band, is_woman=excluded.is_woman, consent_state=excluded.consent_state,
         updated_at=excluded.updated_at`,
      [b.id, b.phoneHash, b.ordinal, b.firstName, b.resumePinHash, b.districtName, b.blockName, b.villageName,
        b.ageBand, b.isWoman === null ? null : b.isWoman ? 1 : 0, b.consentState, b.updatedAt],
    );
  }

  async getBeneficiary(id: string) {
    const rows = await this.all<Row>(`select * from beneficiary where id = ?`, [id]);
    return rows[0] ? SqlStore.toBeneficiary(rows[0]) : null;
  }

  async listBeneficiaries() {
    const rows = await this.all<Row>(`select * from beneficiary order by updated_at desc`);
    return rows.map(SqlStore.toBeneficiary);
  }

  async findByPhoneHash(hash: string) {
    const rows = await this.all<Row>(`select * from beneficiary where phone_hash = ? order by ordinal`, [hash]);
    return rows.map(SqlStore.toBeneficiary);
  }

  async answersFor(beneficiaryId: string) {
    const rows = await this.all<Row>(`select * from answer where beneficiary_id = ? order by field_no`, [beneficiaryId]);
    return rows.map(SqlStore.toAnswer);
  }

  async listAnswers() {
    const rows = await this.all<Row>(`select * from answer`);
    return rows.map(SqlStore.toAnswer);
  }

  async listConsent() {
    const rows = await this.all<Row>(`select * from consent_event order by captured_at desc`);
    return rows.map((r) => ({
      id: String(r.id),
      beneficiaryId: String(r.beneficiary_id),
      kind: String(r.kind),
      scriptVersion: String(r.script_version),
      channel: String(r.channel) as Channel,
      evidence: JSON.parse(String(r.evidence ?? '{}')) as Record<string, unknown>,
      capturedAt: String(r.captured_at),
    })) satisfies ConsentRow[];
  }

  async listRecommendations() {
    const rows = await this.all<Row>(`select * from recommendation order by created_at desc`);
    return rows.map((r) => ({
      id: String(r.id),
      beneficiaryId: String(r.beneficiary_id),
      result: JSON.parse(String(r.result)) as RecommendationResult,
      createdAt: String(r.created_at),
      deliveredAt: (r.delivered_at as string | null) ?? null,
    })) satisfies RecommendationRow[];
  }

  async latestRecommendation(beneficiaryId: string) {
    const all = await this.listRecommendations();
    return all.find((r) => r.beneficiaryId === beneficiaryId) ?? null;
  }

  async listOutcomes() {
    const rows = await this.all<Row>(`select * from outcome`);
    return rows.map((r) => ({
      id: String(r.id),
      beneficiaryId: String(r.beneficiary_id),
      qualificationRef: String(r.qualification_ref),
      status: String(r.status) as OutcomeRow['status'],
      statusDate: String(r.status_date),
      note: (r.note as string | null) ?? null,
    })) satisfies OutcomeRow[];
  }

  async putOutcome(o: OutcomeRow) {
    await this.run(
      `insert into outcome (id, beneficiary_id, qualification_ref, status, status_date, note) values (?,?,?,?,?,?)
       on conflict(id) do update set status_date=excluded.status_date, note=excluded.note`,
      [o.id, o.beneficiaryId, o.qualificationRef, o.status, o.statusDate, o.note],
    );
  }

  async listTelemetry() {
    const rows = await this.all<Row>(`select * from turn_telemetry order by created_at desc limit 500`);
    return rows.map((r) => ({
      id: String(r.id),
      sessionId: String(r.session_id ?? ''),
      state: String(r.fsm_state),
      method: (r.method as string | null) ?? null,
      latencyMs: r.latency_ms === null || r.latency_ms === undefined ? null : Number(r.latency_ms),
      createdAt: String(r.created_at),
    })) satisfies TelemetryRow[];
  }

  async outboxSize() {
    const rows = await this.all<Row>(`select count(*) as n from outbox`);
    return Number(rows[0]?.n ?? 0);
  }

  async outboxPeek(limit = 25) {
    const rows = await this.all<Row>(`select * from outbox order by created_at limit ?`, [limit]);
    return rows.map((r) => ({
      id: String(r.id),
      kind: 'events' as const,
      payload: JSON.parse(String(r.payload)) as DomainEvent[],
      createdAt: String(r.created_at),
      attempts: Number(r.attempts ?? 0),
      lastError: (r.last_error as string | null) ?? null,
    })) satisfies OutboxRow[];
  }

  async outboxDelete(id: string) {
    await this.run(`delete from outbox where id = ?`, [id]);
  }

  async outboxFail(id: string, error: string) {
    await this.run(`update outbox set attempts = attempts + 1, last_error = ? where id = ?`, [error, id]);
  }

  async get<T>(key: string) {
    const rows = await this.all<Row>(`select v from kv where k = ?`, [key]);
    return rows[0] ? (JSON.parse(String(rows[0].v)) as T) : null;
  }

  async set<T>(key: string, value: T) {
    await this.run(`insert into kv (k, v) values (?,?) on conflict(k) do update set v = excluded.v`, [key, JSON.stringify(value)]);
  }

  async wipe() {
    for (const t of ['session', 'beneficiary', 'answer', 'consent_event', 'recommendation', 'outcome', 'turn_telemetry', 'outbox', 'kv']) {
      await this.run(`delete from ${t}`);
    }
  }
}
