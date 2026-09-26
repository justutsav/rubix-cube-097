/**
 * POST /functions/v1/identity
 *
 * "Who is this verified number already?" — the endpoint that makes the cross-channel promise real.
 * Somebody who answered four questions on an IVR call, then installs the app and verifies the same
 * number, continues at question five (panel 6).
 *
 * What it deliberately does NOT return: names, trades, districts, answers, or anything else that
 * would identify the person behind an earlier interview. Only a state name, a count out of seven, a
 * timestamp and a channel.
 *
 * The reason is the one structural fact of this scheme: 51.6% of rural women 15+ own no mobile
 * phone, so the number is routinely a husband's or a son's. An OTP proves possession of a SIM, not
 * identity. If this endpoint returned "Sunita, weaving, 12 years, mobility: physical constraint",
 * verifying the household phone would disclose her disability to whoever holds it — an unauthorised
 * disclosure by a State instrumentality (spec §9 BLOCKER 1). The PIN gate does the rest, and it
 * lives in the FSM so the app and the phone line enforce it identically.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.10';
import { CORS, json, phoneHash, verifiedPhone } from '../_shared/identity.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const phone = verifiedPhone(req);
  if (!phone) return json({ error: 'no verified phone claim on this token' }, 401);

  let hash: string;
  try {
    hash = await phoneHash(phone);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'hash failed' }, 500);
  }

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });

  // Non-unique lookup by design: several beneficiaries per handset is the normal case here.
  const { data: people, error } = await admin
    .from('beneficiary')
    .select('id, ordinal, resume_pin_hash, consent_state')
    .eq('phone_hash', `\\x${hash}`)
    .order('ordinal');

  if (error) return json({ error: error.message }, 500);

  if (!people || people.length === 0) {
    const { data: created, error: insErr } = await admin
      .from('beneficiary')
      .insert({ phone_hash: `\\x${hash}`, ordinal: 1, consent_state: 'NONE' })
      .select('id')
      .single();
    if (insErr) return json({ error: insErr.message }, 500);
    return json({ beneficiaryId: created.id, candidates: [], isNew: true });
  }

  const ids = people.map((p) => p.id);

  const [{ data: sessions }, { data: answers }] = await Promise.all([
    admin
      .from('session')
      .select('id, beneficiary_id, fsm_state, status, channel, last_turn_at')
      .in('beneficiary_id', ids)
      .in('status', ['RESUMABLE', 'ACTIVE'])
      .order('last_turn_at', { ascending: false }),
    admin.from('answer').select('beneficiary_id, field_no, confirmed_at').in('beneficiary_id', ids),
  ]);

  const confirmedBy = new Map<string, number>();
  for (const a of answers ?? []) {
    if (!a.confirmed_at) continue;
    confirmedBy.set(a.beneficiary_id, (confirmedBy.get(a.beneficiary_id) ?? 0) + 1);
  }
  const pinBy = new Map(people.map((p) => [p.id, Boolean(p.resume_pin_hash)]));

  const candidates = (sessions ?? []).map((s) => ({
    sessionId: s.id,
    state: s.fsm_state,
    confirmedCount: confirmedBy.get(s.beneficiary_id) ?? 0,
    lastTurnAt: s.last_turn_at,
    channel: s.channel,
    pinRequired: pinBy.get(s.beneficiary_id) ?? false,
  }));

  return json({
    // Only safe to name a beneficiary id when exactly one exists on this handset AND no PIN was
    // set. Otherwise the caller must clear the gate before anything is attributed to them.
    beneficiaryId: people.length === 1 && !pinBy.get(people[0].id) ? people[0].id : null,
    candidates,
    isNew: false,
  });
});
