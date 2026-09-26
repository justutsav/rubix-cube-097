/**
 * Server link: auth, identity resolution, and the outbox drain.
 *
 * Phone-number sign-in is the mechanism that makes the cross-channel promise real: somebody who
 * already answered four questions on an IVR call, or sent voice notes on WhatsApp, installs the
 * app, verifies the same number, and continues from question five instead of starting again
 * (panel 6). One person, one profile; sessions are disposable.
 *
 * Two things about identity that are easy to get wrong and expensive to get wrong here:
 *
 * 1. **The phone hash is computed on the server, never here.** `hmac(e164, server_pepper)` is only
 *    as good as the pepper's secrecy, and a pepper shipped inside an APK is not secret — anyone
 *    could then take a list of numbers, hash them, and test which SC beneficiaries are in the
 *    register. So the client never sees the pepper and never computes the hash; the edge function
 *    reads the verified phone out of the JWT and does it.
 *
 * 2. **OTP verifies a SIM, not a person.** 51.6% of rural women 15+ own no phone, so the number is
 *    routinely a husband's or a son's. A verified OTP therefore does NOT entitle the holder to see
 *    whatever interviews exist against that number. The identity endpoint returns counts and
 *    timestamps only, and the PIN gate still stands between the caller and anyone else's answers.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { DomainEvent } from '@rc097/core';
import { openStore } from './db';

const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const serverConfigured = Boolean(URL && ANON);

/**
 * `null` when the app is built without server config. That is a supported state, not an error:
 * the kiosk channel is meant to work with no vendor in it at all, so every call site treats a
 * missing client as "offline forever" rather than throwing.
 */
export const supabase: SupabaseClient | null = serverConfigured
  ? createClient(URL!, ANON!, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
      global: { headers: { 'x-rc097-client': 'app' } },
    })
  : null;

// ---------------------------------------------------------------------------- phone auth

export type OtpResult =
  | { ok: true }
  | { ok: false; reason: 'no_server' | 'no_sms_provider' | 'rate_limited' | 'invalid_number' | 'unknown'; detail: string };

/** E.164 for India, from whatever the user typed. Ten digits with an optional 91/0 prefix. */
export function toE164(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  const ten = digits.length > 10 ? digits.slice(-10) : digits;
  if (ten.length !== 10 || !/^[6-9]/.test(ten)) return null;
  return `+91${ten}`;
}

export async function sendOtp(rawPhone: string): Promise<OtpResult> {
  const phone = toE164(rawPhone);
  if (!phone) return { ok: false, reason: 'invalid_number', detail: 'Needs a 10-digit Indian mobile number.' };
  if (!supabase) return { ok: false, reason: 'no_server', detail: 'This build has no server configured.' };

  const { error } = await supabase.auth.signInWithOtp({ phone });
  if (!error) return { ok: true };

  const msg = error.message.toLowerCase();
  // Supabase needs an SMS provider (MSG91, Twilio, …) wired in the dashboard before phone OTP
  // works at all. Saying so plainly beats "unknown error" — it is a one-time project setting.
  if (msg.includes('provider') || msg.includes('not enabled') || msg.includes('unsupported')) {
    return { ok: false, reason: 'no_sms_provider', detail: error.message };
  }
  if (msg.includes('rate') || msg.includes('too many')) return { ok: false, reason: 'rate_limited', detail: error.message };
  return { ok: false, reason: 'unknown', detail: error.message };
}

export async function verifyOtp(rawPhone: string, token: string) {
  const phone = toE164(rawPhone);
  if (!phone || !supabase) return { ok: false as const, detail: 'Not available' };
  const { data, error } = await supabase.auth.verifyOtp({ phone, token, type: 'sms' });
  if (error) return { ok: false as const, detail: error.message };
  return { ok: true as const, userId: data.user?.id ?? null, phone: data.user?.phone ?? null };
}

export async function signOut() {
  await supabase?.auth.signOut();
}

// ---------------------------------------------------------------------------- identity

export interface ResumableSummary {
  sessionId: string;
  /** Which question they reached. A state name, not an answer. */
  state: string;
  /** How many of the seven are confirmed. A count, never the content. */
  confirmedCount: number;
  lastTurnAt: string;
  channel: string;
  /** True when a PIN was set. The caller must clear it before anything is revealed. */
  pinRequired: boolean;
}

export interface IdentityResult {
  beneficiaryId: string | null;
  /** More than one means a shared handset — the normal case, not an edge case. */
  candidates: ResumableSummary[];
  isNew: boolean;
}

/**
 * Ask the server who this verified number already is.
 *
 * Deliberately returns no answers, no name, no trade, no district — only what is needed to say
 * "there is an earlier conversation from Monday, four of seven answered" and offer the PIN box.
 * Everything identifying stays behind the gate (spec §9 BLOCKER 1).
 */
export async function resolveIdentity(): Promise<IdentityResult | null> {
  if (!supabase) return null;
  const { data: sess } = await supabase.auth.getSession();
  if (!sess.session) return null;
  const { data, error } = await supabase.functions.invoke<IdentityResult>('identity', { body: {} });
  if (error) {
    console.warn('[identity] failed, continuing offline:', error.message);
    return null;
  }
  return data ?? null;
}

// ---------------------------------------------------------------------------- sync

export interface SyncReport {
  attempted: number;
  pushed: number;
  failed: number;
  errors: string[];
}

/**
 * Drain the outbox.
 *
 * Idempotent on the server side: events are keyed by `(beneficiary_id, field_no)` upserts with
 * the conflict rule "confirmed beats unconfirmed, later confirmed_at wins" (spec §5.2), so
 * replaying a batch after a half-failed sync cannot corrupt a profile. That is why a failed
 * attempt increments a counter and leaves the row in place rather than dropping it.
 */
export async function syncOutbox(): Promise<SyncReport> {
  const report: SyncReport = { attempted: 0, pushed: 0, failed: 0, errors: [] };
  if (!supabase) return report;

  const store = await openStore();
  const batch = await store.outboxPeek(25);
  report.attempted = batch.length;

  for (const row of batch) {
    try {
      const { data, error } = await supabase.functions.invoke('turn', {
        body: { mode: 'apply', events: row.payload as DomainEvent[] },
      });
      if (error) throw new Error(error.message);
      // A 207 means some events in the batch were rejected. Surface it rather than treating a
      // partial write as a clean one.
      const applied = data as { applied?: number; errors?: string[] } | null;
      if (applied?.errors?.length) {
        console.error(`[sync] batch ${row.id} partially applied:`, applied.errors.join(' | '));
        throw new Error(applied.errors[0]);
      }
      await store.outboxDelete(row.id);
      report.pushed++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // Log it. Storing the error on the outbox row alone made a failing sync look identical to
      // an idle one — the batches simply never left and nothing said why.
      console.error(`[sync] batch ${row.id} failed (attempt ${row.attempts + 1}):`, msg);
      await store.outboxFail(row.id, msg);
      report.failed++;
      if (!report.errors.includes(msg)) report.errors.push(msg);
      // Stop on the first failure: if the server is down, hammering 25 times tells us nothing new
      // and burns a rural data allowance.
      break;
    }
  }
  return report;
}

/** Wire the drain to connectivity. Called once at startup. */
export async function startSyncLoop(onReport?: (r: SyncReport) => void): Promise<() => void> {
  let stopped = false;

  const run = async () => {
    if (stopped || !navigator.onLine) return;
    const r = await syncOutbox();
    if (r.attempted > 0) onReport?.(r);
  };

  window.addEventListener('online', run);
  // A slow interval as a backstop: `online` does not fire when a captive portal lets go, and a
  // mobiliser must never have to press sync.
  const timer = window.setInterval(run, 60_000);
  void run();

  return () => {
    stopped = true;
    window.removeEventListener('online', run);
    window.clearInterval(timer);
  };
}
