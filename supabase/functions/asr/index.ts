/**
 * POST /functions/v1/asr  { locale, audioBase64, rate } -> { transcripts[], engine, version }
 *
 * The production speech endpoint. The app records 16 kHz mono WAV on the device and posts it here;
 * the Sarvam key lives in a Supabase secret and never leaves the server.
 *
 * Three reasons this is an edge function rather than a direct call from the handset:
 *
 *   1. **The key would be extractable.** An API key in an APK is one `unzip` away, and this one
 *      bills per hour of audio.
 *   2. **Jurisdiction.** `01-the-customer.md` §9.1 treats caste + voice + location + phone as the
 *      crown-jewel tuple and requires that any third-party inference endpoint be nameable, under
 *      contract, and in a known jurisdiction. That is a statement we can only make if the traffic
 *      goes through something we control.
 *   3. **It is https.** The dev setup pointed the WebView at `http://localhost:5001` through
 *      `adb reverse`, which needed `allowMixedContent: true` — unacceptable on a release build
 *      carrying a beneficiary's voice.
 *
 * Deliberately NOT verifying a JWT: the interview runs before any sign-in, and the kiosk channel
 * has no account at all. The endpoint is rate-limited by Supabase and carries no data of its own,
 * so the exposure is a quota, not a record.
 */

import { CORS, json } from '../_shared/identity.ts';

/**
 * Our locale codes → Sarvam's.
 *
 * Maithili is here and the other four dialects are not, and the line is constitutional rather than
 * technical: Maithili is Eighth Schedule, so `mai-IN` exists. Bhojpuri (5.05 crore speakers),
 * Rajasthani (2.58 cr), Chhattisgarhi (1.62 cr) and Magahi (1.27 cr) are non-scheduled and have no
 * model at Sarvam, at Bhashini, or in the open-source world. They are sent to the Hindi model
 * because there is nothing else to send them to, and the vernacular lexicon absorbs the error.
 */
const SARVAM_LANG: Record<string, string> = {
  hi: 'hi-IN',
  mai: 'mai-IN',
  ta: 'ta-IN',
  en: 'en-IN',
  bho: 'hi-IN',
  mag: 'hi-IN',
  raj: 'hi-IN',
  cgh: 'hi-IN',
};

/** Locales served by a model that was not trained on them. */
const DEGRADED = new Set(['bho', 'mag', 'raj', 'cgh']);

const MODEL = Deno.env.get('SARVAM_MODEL') ?? 'saaras:v3';
const MAX_BYTES = 4 * 1024 * 1024; // ~2 minutes of 16 kHz mono PCM

async function transcribeOnce(bytes: Uint8Array, languageCode: string, key: string) {
  const form = new FormData();
  form.append('file', new Blob([bytes], { type: 'audio/wav' }), 'turn.wav');
  form.append('model', MODEL);
  form.append('mode', 'transcribe');
  form.append('language_code', languageCode);

  const res = await fetch('https://api.sarvam.ai/speech-to-text', {
    method: 'POST',
    headers: { 'api-subscription-key': key },
    body: form,
  });
  if (!res.ok) throw new Error(`sarvam ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const body = (await res.json()) as {
    transcript?: string;
    language_code?: string;
    language_probability?: number;
  };
  return {
    text: (body.transcript ?? '').trim(),
    lang: body.language_code ?? languageCode,
    prob: body.language_probability ?? 0,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  const key = Deno.env.get('SARVAM_API_KEY');
  if (!key) return json({ transcripts: [], engine: 'error', version: 'SARVAM_API_KEY not set' });

  let body: { locale?: string; audioBase64?: string; rate?: number };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid json' }, 400);
  }
  if (!body.audioBase64) return json({ error: 'audioBase64 required' }, 400);

  let bytes: Uint8Array;
  try {
    const bin = atob(body.audioBase64);
    if (bin.length > MAX_BYTES) return json({ error: 'audio too large' }, 413);
    bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  } catch {
    return json({ error: 'audioBase64 is not valid base64' }, 400);
  }

  const locale = body.locale ?? 'hi';
  const started = Date.now();

  try {
    const first = await transcribeOnce(bytes, SARVAM_LANG[locale] ?? 'hi-IN', key);
    const transcripts = first.text ? [first.text] : [];

    /**
     * A second reading for the four dialects with no model of their own.
     *
     * Sarvam returns no n-best — exactly one transcript — and the extraction ladder gains its
     * confidence from several hypotheses agreeing. Asking again with `language_code=unknown` lets
     * Sarvam's own detector choose, and on dialect audio the two readings often differ, which is
     * precisely the alternate the lexicon was built to exploit.
     *
     * Restricted to those four because it doubles the per-turn cost and buys nothing for a language
     * that has a real model. Set SARVAM_DUAL_PASS=0 to disable.
     */
    if (DEGRADED.has(locale) && Deno.env.get('SARVAM_DUAL_PASS') !== '0') {
      try {
        const second = await transcribeOnce(bytes, 'unknown', key);
        if (second.text && !transcripts.includes(second.text)) transcripts.push(second.text);
      } catch {
        /* one hypothesis is still a usable turn */
      }
    }

    return json({
      transcripts,
      engine: 'sarvam',
      version: `${MODEL}/${first.lang}@${first.prob.toFixed(2)}`,
      latencyMs: Date.now() - started,
    });
  } catch (e) {
    // 200 with an empty list, not 500. To the FSM an empty result is a timeout, which re-asks —
    // so a vendor outage makes the assistant say "say that again" instead of breaking the
    // interview halfway through somebody's afternoon.
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[asr]', msg);
    return json({ transcripts: [], engine: 'error', version: msg.slice(0, 120), latencyMs: Date.now() - started });
  }
});
