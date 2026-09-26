/**
 * POST /functions/v1/turn
 *
 * Two modes over one endpoint:
 *
 *   `apply` — the app's outbox drains here. It sends the exact DomainEvent list the core produced
 *             offline, and this writes it to Postgres. The same list the device wrote to
 *             SQLite/IndexedDB, applied to the server. One implementation, two backends, and they
 *             cannot drift.
 *
 *   `turn`  — the IVR and WhatsApp adapters call this. They post an utterance; the core runs here
 *             and the events are persisted server-side. The channel adapters stay thin: transport
 *             in, prompt out, no interview logic (spec §1.1).
 *
 * The upsert conflict rule is the one from spec §5.2 — **confirmed beats unconfirmed, later
 * confirmed_at wins** — which is what makes a replayed batch after a half-failed sync harmless.
 * Without it, a mobiliser syncing twice on a flaky village connection could overwrite a confirmed
 * answer with the unconfirmed version that preceded it.
 */

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.47.10';
import { CORS, json, sha256Hex } from '../_shared/identity.ts';

// The core is vendored into the function bundle at deploy time by scripts/deploy_functions.py so
// that the FSM running on the phone and the FSM running here are the same source file.
import {
  QUALIFICATIONS,
  OPPORTUNITIES,
  startSession,
  turn as runTurn,
  type DomainEvent,
  type SessionState,
  type TurnRequest,
} from '../_core/index.ts';

type Body =
  | { mode: 'apply'; events: DomainEvent[] }
  | ({ mode: 'turn' } & TurnRequest & { sessionId?: string });

/**
 * Make a Supabase error legible.
 *
 * Postgres errors arrive as plain objects, not Error instances, so `e.message` is undefined and
 * template-stringing them yields "[object Object]" — which is what the first sync failure reported,
 * hiding a foreign-key violation behind a shrug. The code and details are the whole diagnosis.
 */
function describeError(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === 'object') {
    const o = e as { message?: string; details?: string; hint?: string; code?: string };
    return [o.code && `[${o.code}]`, o.message, o.details, o.hint].filter(Boolean).join(' ') || JSON.stringify(e);
  }
  return String(e);
}

async function applyEvents(db: SupabaseClient, events: DomainEvent[]): Promise<{ applied: number; errors: string[] }> {
  const errors: string[] = [];
  let applied = 0;

  for (const ev of events) {
    try {
      switch (ev.type) {
        case 'session.upsert': {
          const s = ev.session;

          // BENEFICIARY FIRST. `session.beneficiary_id` is a foreign key, so inserting the session
          // before the person it belongs to fails every time — which is exactly what happened: the
          // app's outbox drained into two FK violations per batch and, because the failures were
          // only stored on the outbox row and never logged, it looked like nothing was syncing at
          // all rather than like something was failing.
          const pinHash = s.resumePin ? await sha256Hex(`rc097:${s.beneficiaryId}:${s.resumePin}`) : null;
          const { error: bErr } = await db.from('beneficiary').upsert(
            {
              id: s.beneficiaryId,
              // No phone_hash on this path. A kiosk or doorstep beneficiary has no phone, and
              // synthesising one from a device id would fabricate an identity that can never match
              // a real call. The column is nullable for this reason.
              consent_state: s.consentState,
              village_name: s.registration.villageName,
              ...(pinHash ? { resume_pin_hash: `\\x${pinHash}` } : {}),
              updated_at: s.lastTurnAt,
            },
            { onConflict: 'id' },
          );
          if (bErr) throw bErr;

          const { error } = await db.from('session').upsert(
            {
              id: s.sessionId,
              beneficiary_id: s.beneficiaryId,
              channel: s.channel,
              channel_ref: s.channelRef,
              locale: s.locale,
              fsm_state: s.state,
              phase: s.phase,
              status: s.status,
              re_ask_count: s.reAskCount,
              deferred: s.deferred,
              pin_attempts: s.pinAttempts,
              noticed_channels: s.noticedChannels,
              started_at: s.startedAt,
              last_turn_at: s.lastTurnAt,
            },
            { onConflict: 'id' },
          );
          if (error) throw error;
          break;
        }

        case 'answer.upsert': {
          const a = ev.answer;
          // Read before write so the conflict rule can be applied. A plain upsert would let a
          // replayed unconfirmed row clobber a confirmed one.
          const { data: existing } = await db
            .from('answer')
            .select('confirmed_at')
            .eq('beneficiary_id', a.beneficiaryId)
            .eq('field_no', a.fieldNo)
            .maybeSingle();

          if (existing?.confirmed_at && !a.confirmedAt) break; // confirmed beats unconfirmed
          if (existing?.confirmed_at && a.confirmedAt && a.confirmedAt < existing.confirmed_at) break; // later wins

          const { error } = await db.from('answer').upsert(
            {
              beneficiary_id: a.beneficiaryId,
              field_no: a.fieldNo,
              // The DB CHECK refuses a transcript against a confirmed answer, so null it here too
              // rather than let the insert fail on a constraint that is doing its job.
              raw_transcript: a.confirmedAt ? null : a.rawTranscript,
              nbest: a.confirmedAt ? null : a.nbest,
              value: a.value,
              confidence: a.confidence,
              method: a.method,
              asr_engine: a.asrEngine,
              asr_version: a.asrVersion,
              confirmed_at: a.confirmedAt,
              session_id: a.sessionId,
              updated_at: a.updatedAt,
            },
            { onConflict: 'beneficiary_id,field_no' },
          );
          if (error) throw error;
          break;
        }

        case 'answer.confirmed':
        case 'transcript.erase': {
          const { error } = await db
            .from('answer')
            .update({ raw_transcript: null, nbest: null, ...(ev.type === 'answer.confirmed' ? { confirmed_at: ev.at } : {}) })
            .eq('beneficiary_id', ev.beneficiaryId)
            .eq('field_no', ev.fieldNo);
          if (error) throw error;
          break;
        }

        case 'registration.upsert': {
          const r = ev.registration;
          let districtId: string | null = null;
          let blockId: string | null = null;
          if (r.districtName) {
            const { data: d } = await db.from('district').select('id').eq('name', r.districtName).maybeSingle();
            districtId = d?.id ?? null;
            if (districtId && r.blockName) {
              const { data: b } = await db.from('block').select('id').eq('district_id', districtId).eq('name', r.blockName).maybeSingle();
              blockId = b?.id ?? null;
            }
          }
          const { error } = await db
            .from('beneficiary')
            .update({ district_id: districtId, block_id: blockId, village_name: r.villageName })
            .eq('id', ev.beneficiaryId);
          if (error) throw error;
          break;
        }

        case 'consent.record': {
          const { error } = await db.from('consent_event').insert({
            beneficiary_id: ev.beneficiaryId,
            kind: ev.kind,
            script_version: ev.scriptVersion,
            channel: ev.channel,
            evidence: ev.evidence,
            captured_at: ev.at,
          });
          if (error) throw error;
          break;
        }

        case 'recommendation.create': {
          const r = ev.result;
          const { error } = await db.from('recommendation').insert({
            beneficiary_id: ev.beneficiaryId,
            ranked: r.top,
            near_miss: r.nearMiss,
            route_to_pm_daksh: r.routeToPmDaksh,
            needs_financial_literacy: r.needsFinancialLiteracy,
            asset_grant_eligible: r.assetGrantEligible,
            weights_version: r.weightsVersion,
            engine_version: r.engineVersion,
            nqr_snapshot_sha: r.nqrSnapshotSha,
            contains_prototype_data: r.containsPrototypeData,
            created_at: ev.at,
          });
          if (error) throw error;
          break;
        }

        case 'outcome.upsert': {
          const { error } = await db.from('outcome').upsert(
            {
              beneficiary_id: ev.beneficiaryId,
              qualification_ref: ev.qualificationRef,
              status: ev.status,
              status_date: ev.at.slice(0, 10),
            },
            { onConflict: 'beneficiary_id,qualification_ref,status' },
          );
          if (error) throw error;
          break;
        }

        case 'telemetry.turn': {
          await db.from('turn_telemetry').insert({
            session_id: ev.sessionId,
            channel: 'app',
            fsm_state: ev.state,
            method: ev.method,
            latency_ms: ev.latencyMs,
          });
          break;
        }
      }
      applied++;
    } catch (e) {
      errors.push(`${ev.type}: ${describeError(e)}`);
    }
  }

  return { applied, errors };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid json' }, 400);
  }

  if (body.mode === 'apply') {
    if (!Array.isArray(body.events)) return json({ error: 'events[] required' }, 400);
    const r = await applyEvents(db, body.events);
    // Partial failure is reported, not swallowed: the device keeps the batch and retries rather
    // than deleting an outbox row that never landed.
    return json(r, r.errors.length > 0 ? 207 : 200);
  }

  if (body.mode === 'turn') {
    let session: SessionState;
    if (body.sessionId) {
      const { data } = await db.from('session').select('*').eq('id', body.sessionId).maybeSingle();
      if (!data) return json({ error: 'unknown session' }, 404);
      const { data: answers } = await db.from('answer').select('*').eq('beneficiary_id', data.beneficiary_id);
      session = {
        sessionId: data.id,
        beneficiaryId: data.beneficiary_id,
        channel: data.channel,
        channelRef: data.channel_ref,
        locale: data.locale,
        state: data.fsm_state,
        phase: data.phase,
        reAskCount: data.re_ask_count ?? 0,
        deferred: data.deferred ?? [],
        consentState: 'GIVEN',
        resumePin: null,
        pinAttempts: data.pin_attempts ?? 0,
        noticedChannels: data.noticed_channels ?? [],
        registration: { districtName: null, districtLgd: null, blockName: null, blockLgd: null, villageName: null },
        answers: Object.fromEntries(
          (answers ?? []).map((a) => [
            a.field_no,
            {
              beneficiaryId: a.beneficiary_id,
              fieldNo: a.field_no,
              rawTranscript: a.raw_transcript,
              nbest: a.nbest,
              value: a.value,
              confidence: a.confidence,
              method: a.method,
              asrEngine: a.asr_engine,
              asrVersion: a.asr_version,
              confirmedAt: a.confirmed_at,
              sessionId: a.session_id,
              updatedAt: a.updated_at,
            },
          ]),
        ),
        resumedFrom: null,
        status: data.status,
        readbackCursor: null,
        startedAt: data.started_at,
        lastTurnAt: data.last_turn_at,
      } as SessionState;
    } else {
      session = startSession({ channel: body.channel, channelRef: body.channelRef, locale: body.localeHint });
    }

    const result = await runTurn(session, body, {
      catalogue: QUALIFICATIONS,
      opportunities: OPPORTUNITIES,
    });

    const applied = await applyEvents(db, result.events);

    return json({
      sessionId: result.session.sessionId,
      state: result.session.state,
      phase: result.session.phase,
      resumedFrom: result.session.resumedFrom,
      say: result.say,
      expect: result.expect,
      turnBudgetMs: result.turnBudgetMs,
      terminal: result.terminal,
      progress: result.progress,
      recommendation: result.recommendation ?? null,
      persisted: applied,
    });
  }

  return json({ error: 'mode must be "apply" or "turn"' }, 400);
});
