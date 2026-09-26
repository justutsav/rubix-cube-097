/**
 * WhatsApp voice notes via the Meta Cloud API — panel 4.
 *
 * Direct to Meta, not through Twilio or Exotel. Three reasons, all from the audit: no per-message
 * markup (Exotel adds ₹0.06/message on top of Meta's rate), audio replies are straightforward on
 * the direct API and awkward through a reseller, and a reseller's routing nudges you toward text —
 * for people who, by the PS's own first sentence, cannot deal with text.
 *
 * Two decisions encoded here rather than in a document:
 *
 *   · **One question per message.** Batching two or three questions into one voice note was
 *     proposed, costed and rejected: it turns WhatsApp into a form read aloud, which is exactly
 *     what R1 forbids and R7 penalises, and it saves ₹0.77 per beneficiary. If cost ever bites at
 *     100k scale, batch *acknowledgement + next question* — never question + question.
 *
 *   · **Resume is forward-only.** On this channel we ask the next unanswered field and never read
 *     prior answers back, because a chat log lives on a handset we cannot erase and that handset is
 *     frequently shared (spec §9 BLOCKER 1).
 *
 * Prompt audio is uploaded to Meta once at deploy time and addressed by media id forever after —
 * the WhatsApp analogue of the pre-rendered WAVs on the phone channel. Same prompt id, three
 * renderings, zero drift.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  OPPORTUNITIES,
  QUALIFICATIONS,
  startSession,
  turn,
  type SayRef,
  type SessionState,
  type Utterance,
} from '@rc097/core';
import { makeAsr } from './asr.js';

const GRAPH = process.env.META_GRAPH_URL ?? 'https://graph.facebook.com/v19.0';
const TOKEN = process.env.META_ACCESS_TOKEN ?? '';
const PHONE_ID = process.env.META_PHONE_NUMBER_ID ?? '';
const VERIFY_TOKEN = process.env.META_VERIFY_TOKEN ?? 'rc097-verify';
const APP_SECRET = process.env.META_APP_SECRET ?? '';

const asr = makeAsr();

/**
 * In-memory session map.
 *
 * ponytail: process-local, so a restart loses in-flight WhatsApp sessions. Acceptable while the
 * `turn` edge function is the durable store and this service is a single process; move to the
 * server-side session (mode: 'turn' with a sessionId) before running more than one instance.
 */
const sessions = new Map<string, SessionState>();

/** Prompt id → Meta media id, populated by scripts/upload_wa_prompts.py. */
const mediaIds = new Map<string, string>();

export function verifyWhatsAppWebhook(params: URLSearchParams): { status: number; body: string } {
  if (params.get('hub.mode') === 'subscribe' && params.get('hub.verify_token') === VERIFY_TOKEN) {
    return { status: 200, body: params.get('hub.challenge') ?? '' };
  }
  return { status: 403, body: 'verification failed' };
}

/**
 * Verify Meta's payload signature.
 *
 * This endpoint is public and it writes to a register of caste-identified beneficiaries. An
 * unsigned POST must not be able to create or advance an interview, so a configured app secret is
 * enforced and a missing one is a loud warning rather than a silent pass.
 */
function signatureValid(raw: string, header: string | undefined): boolean {
  if (!APP_SECRET) {
    console.warn('[whatsapp] META_APP_SECRET unset — signature NOT verified. Do not run this way in production.');
    return true;
  }
  if (!header?.startsWith('sha256=')) return false;
  const expected = 'sha256=' + createHmac('sha256', APP_SECRET).update(raw, 'utf8').digest('hex');
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function meta(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${GRAPH}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${TOKEN}`, ...(init.headers ?? {}) },
  });
}

/** Two hops by design: the id yields a short-lived signed URL, so a leaked URL is worthless later. */
async function downloadMedia(mediaId: string): Promise<Buffer> {
  const metaRes = await meta(`/${mediaId}`);
  if (!metaRes.ok) throw new Error(`media lookup ${metaRes.status}`);
  const { url } = (await metaRes.json()) as { url: string };
  const bin = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` } });
  if (!bin.ok) throw new Error(`media download ${bin.status}`);
  return Buffer.from(await bin.arrayBuffer());
}

async function sendAudio(to: string, mediaId: string): Promise<void> {
  const res = await meta(`/${PHONE_ID}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'audio', audio: { id: mediaId } }),
  });
  if (!res.ok) console.error('[whatsapp] sendAudio failed:', await res.text());
}

async function sendText(to: string, body: string): Promise<void> {
  const res = await meta(`/${PHONE_ID}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body } }),
  });
  if (!res.ok) console.error('[whatsapp] sendText failed:', await res.text());
}

/** `expect.kind === 'enum'` renders as interactive reply buttons — the DTMF equivalent here. */
async function sendButtons(to: string, body: string, options: { id: string; label: string }[]): Promise<void> {
  const res = await meta(`/${PHONE_ID}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: body.slice(0, 1024) },
        // Meta caps reply buttons at three. Beyond that the list type is correct, but three covers
        // yes/no and the common closed sets.
        action: { buttons: options.slice(0, 3).map((o) => ({ type: 'reply', reply: { id: o.id, title: o.label.slice(0, 20) } })) },
      },
    }),
  });
  if (!res.ok) console.error('[whatsapp] sendButtons failed:', await res.text());
}

async function deliver(to: string, say: SayRef[], expect: { kind: string; options?: { id: string; label: string; labelLocal?: string }[] }): Promise<void> {
  for (const line of say) {
    const text = 'text' in line ? line.text : '';
    const mediaId = line.kind === 'prerendered' ? mediaIds.get(line.id) : undefined;

    if (mediaId) {
      // Pre-uploaded once at deploy, reused forever: zero synthesis and zero upload per turn.
      await sendAudio(to, mediaId);
      continue;
    }

    // No media id yet (the recording session has not happened). Text is the fallback, and it is
    // logged as a shortfall rather than accepted as normal — a text reply fails the person this
    // channel exists for.
    if (text) {
      console.log(`[whatsapp] no media id for ${'id' in line ? line.id : 'tts'} — falling back to text`);
      await sendText(to, text);
    }
  }

  if (expect.kind === 'enum' && expect.options?.length) {
    await sendButtons(to, 'चुनिए:', expect.options.map((o) => ({ id: o.id, label: o.labelLocal ?? o.label })));
  }
}

export async function handleWhatsAppWebhook(raw: string, signature: string | undefined): Promise<void> {
  if (!signatureValid(raw, signature)) {
    console.error('[whatsapp] bad signature — dropped');
    return;
  }

  const body = JSON.parse(raw) as {
    entry?: { changes?: { value?: { messages?: Record<string, any>[] } }[] }[];
  };

  const messages = body.entry?.flatMap((e) => e.changes?.flatMap((c) => c.value?.messages ?? []) ?? []) ?? [];

  for (const m of messages) {
    const from = m.from as string;
    if (!from) continue;

    let session = sessions.get(from);
    if (!session) {
      session = startSession({ channel: 'whatsapp', channelRef: from });
      sessions.set(from, session);
      const opened = await turn(
        session,
        { channel: 'whatsapp', channelRef: from, identity: { kind: 'msisdn_hash', value: from }, utterance: { kind: 'opened' } },
        { catalogue: QUALIFICATIONS, opportunities: OPPORTUNITIES },
      );
      sessions.set(from, opened.session);
      await deliver(from, opened.say, opened.expect);
      continue;
    }

    let utterance: Utterance | null = null;

    if (m.type === 'audio' && m.audio?.id) {
      try {
        const ogg = await downloadMedia(m.audio.id);
        // Opus → PCM needs a decoder. ffmpeg is the obvious one and is deliberately NOT bundled:
        // adding a 70 MB binary dependency to make a demo work is the kind of thing that quietly
        // becomes a deploy requirement. Wire it here when the channel goes live.
        console.log(`[whatsapp] received ${ogg.length}B of OGG/Opus — decoder not wired`);
        const r = await asr.transcribe(ogg, 16000, session.locale);
        utterance = r.transcripts.length
          ? { kind: 'audio', transcripts: r.transcripts, asrEngine: r.engine, asrVersion: r.version }
          : { kind: 'timeout' };
      } catch (e) {
        console.error('[whatsapp] audio failed:', e instanceof Error ? e.message : e);
        utterance = { kind: 'timeout' };
      }
    } else if (m.type === 'interactive' && m.interactive?.button_reply?.id) {
      utterance = { kind: 'choice', optionId: m.interactive.button_reply.id };
    } else if (m.type === 'text' && m.text?.body) {
      utterance = { kind: 'text', value: m.text.body };
    }

    if (!utterance) continue;

    const res = await turn(
      session,
      { channel: 'whatsapp', channelRef: from, identity: { kind: 'msisdn_hash', value: from }, utterance },
      { catalogue: QUALIFICATIONS, opportunities: OPPORTUNITIES },
    );
    sessions.set(from, res.session);

    if (res.events.length > 0 && process.env.SUPABASE_FUNCTIONS_URL) {
      void fetch(`${process.env.SUPABASE_FUNCTIONS_URL}/turn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''}` },
        body: JSON.stringify({ mode: 'apply', events: res.events }),
      }).catch((e) => console.error('[whatsapp] persist failed:', e.message));
    }

    console.log(`[whatsapp] ${from} → ${res.session.state}/${res.session.phase} · ${res.progress.confirmed.length}/7`);
    await deliver(from, res.say, res.expect);

    if (res.terminal) sessions.delete(from);
  }
}

export function registerMediaId(promptId: string, mediaId: string): void {
  mediaIds.set(promptId, mediaId);
}
