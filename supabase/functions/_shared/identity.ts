/**
 * Server-side identity helpers. Shared by the `identity` and `turn` edge functions.
 *
 * The pepper never leaves the server. `hmac(e164, SERVER_PEPPER)` is only as strong as the
 * pepper's secrecy: with it, anyone holding a list of Indian mobile numbers could hash them and
 * test which SC beneficiaries appear in a PM-AJAY register. That is precisely the crown-jewel
 * tuple — caste + phone — that `01-the-customer.md` §9.1 says must never leak. So the phone number
 * is read from the *verified* JWT claim rather than from a request body, and the hash is computed
 * here.
 */

export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

/** E.164 for India. Mirrors toE164() in the app so both sides agree on what a number is. */
export function toE164(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  const ten = digits.length > 10 ? digits.slice(-10) : digits;
  if (ten.length !== 10 || !/^[6-9]/.test(ten)) return null;
  return `+91${ten}`;
}

export async function phoneHash(e164: string): Promise<string> {
  const pepper = Deno.env.get('SERVER_PEPPER');
  if (!pepper) {
    // Refuse rather than fall back to an unpeppered hash. A silent downgrade here would produce a
    // rainbow-table-able digest of every beneficiary's phone number, which is worse than an outage.
    throw new Error('SERVER_PEPPER is not set — refusing to hash without it');
  }
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pepper), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(e164));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Decode the JWT payload without verifying — Supabase has already verified it at the gateway. */
export function claimsOf(req: Request): Record<string, unknown> | null {
  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  const parts = auth.slice(7).split('.');
  if (parts.length !== 3) return null;
  try {
    const pad = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(pad + '='.repeat((4 - (pad.length % 4)) % 4)));
  } catch {
    return null;
  }
}

export function verifiedPhone(req: Request): string | null {
  const c = claimsOf(req);
  const phone = typeof c?.phone === 'string' ? c.phone : null;
  if (!phone) return null;
  return phone.startsWith('+') ? phone : toE164(phone);
}
