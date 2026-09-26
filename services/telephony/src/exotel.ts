/**
 * Exotel AgentStream adapter — panels 2 and 3.
 *
 * Wire protocol per developer.exotel.com/docs/agentstream/websocket-protocol: JSON over a
 * WebSocket, modelled on Twilio Media Streams. Audio both ways is base64 `audio/x-l16` — 16-bit
 * little-endian mono PCM at 8 kHz.
 *
 * The three things that make or break an IVR demo, all handled here:
 *
 *   · **VAD endpointing.** 12 consecutive non-speech 20 ms frames ends the utterance. A plain
 *     energy average is the classic weak link on a noisy village line, so the threshold adapts to
 *     the measured noise floor of this call rather than being a constant.
 *   · **Barge-in.** The VAD keeps running *while the assistant is speaking*. Speech detected →
 *     send `clear`, kill the send queue, go back to listening. Without it an impatient caller talks
 *     over a four-second prompt and neither side hears the other.
 *   · **Real-time paced playback.** Audio is written back in 20 ms frames roughly 20 ms apart. Dump
 *     it all at once and Exotel buffers it, which destroys barge-in and the latency measurement.
 *
 * The turn clock this is built against (spec §3.3): endpoint 240 ms, resample 10 ms, ASR 300 ms,
 * lexicon 5 ms, prompt resolve 5 ms → ~580 ms of perceived silence against an 1800 ms budget.
 */

import type { WebSocket } from 'ws';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  OPPORTUNITIES,
  QUALIFICATIONS,
  startSession,
  turn,
  type SayRef,
  type SessionState,
  type Utterance,
} from '@rc097/core';
import { makeAsr, rms, upsample8to16 } from './asr.js';

const SAMPLE_RATE = 8000;
const FRAME_MS = 20;
const SILENCE_FRAMES_TO_ENDPOINT = 12; // 240 ms
const MIN_SPEECH_FRAMES = 8; // ignore a cough
const MAX_UTTERANCE_MS = 15_000;
const PROMPT_DIR = process.env.PROMPT_DIR ?? join(process.cwd(), 'prompts');

const asr = makeAsr();

interface CallState {
  streamSid: string | null;
  callSid: string | null;
  session: SessionState;
  /** Frames of the current utterance. */
  buffer: Buffer[];
  speechFrames: number;
  silenceFrames: number;
  /** Rolling noise floor, so the threshold suits this line rather than a lab. */
  noiseFloor: number;
  listening: boolean;
  speaking: boolean;
  sendAbort: AbortController | null;
  utteranceStart: number;
}

export function handleExotelSocket(ws: WebSocket, url: URL): void {
  const call: CallState = {
    streamSid: null,
    callSid: null,
    session: startSession({ channel: 'ivr', locale: (url.searchParams.get('locale') as never) ?? 'hi' }),
    buffer: [],
    speechFrames: 0,
    silenceFrames: 0,
    noiseFloor: 0.01,
    listening: false,
    speaking: false,
    sendAbort: null,
    utteranceStart: 0,
  };

  const send = (obj: unknown) => {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(obj));
  };

  /** Flush the playback buffer instantly. This is barge-in. */
  const clear = () => {
    if (!call.streamSid) return;
    send({ event: 'clear', stream_sid: call.streamSid });
    call.sendAbort?.abort();
    call.sendAbort = null;
    call.speaking = false;
  };

  const playPcm = async (pcm: Buffer) => {
    if (!call.streamSid) return;
    const ctrl = new AbortController();
    call.sendAbort = ctrl;
    call.speaking = true;
    const bytesPerFrame = (SAMPLE_RATE * 2 * FRAME_MS) / 1000; // 320 bytes
    for (let i = 0; i < pcm.length; i += bytesPerFrame) {
      if (ctrl.signal.aborted) return;
      send({
        event: 'media',
        stream_sid: call.streamSid,
        media: { payload: pcm.subarray(i, i + bytesPerFrame).toString('base64') },
      });
      await new Promise((r) => setTimeout(r, FRAME_MS));
    }
    call.speaking = false;
    send({ event: 'mark', stream_sid: call.streamSid, mark: { name: 'prompt.end' } });
  };

  /**
   * Resolve a prompt id to an 8 kHz WAV on local disk.
   *
   * Pre-rendered audio is not a micro-optimisation: it removes ~0.6 s per turn and ~29% of
   * per-call cost, and it is what makes the offline kiosk possible at all. When a file is missing —
   * which is every file today, because the recording session has not happened — the prompt is
   * logged and skipped rather than silently swallowed, so the gap shows up instead of hiding.
   */
  const playSay = async (lines: SayRef[], locale: string) => {
    for (const line of lines) {
      if (line.kind !== 'prerendered') {
        console.log(`[ivr] TTS tail (not pre-rendered): ${'text' in line ? line.text : ''}`);
        continue;
      }
      const path = join(PROMPT_DIR, locale, `${line.id}.wav`);
      try {
        const wav = await readFile(path);
        await playPcm(wav.subarray(44)); // strip the RIFF header; the rest is raw 8 kHz PCM
      } catch {
        console.log(`[ivr] MISSING PROMPT ${path} — "${line.text}"`);
      }
    }
  };

  const advance = async (utterance: Utterance) => {
    const t0 = Date.now();
    const res = await turn(
      call.session,
      { channel: 'ivr', channelRef: call.callSid, identity: { kind: 'msisdn_hash', value: call.callSid ?? 'unknown' }, utterance },
      { catalogue: QUALIFICATIONS, opportunities: OPPORTUNITIES },
    );
    call.session = res.session;

    console.log(
      `[ivr] ${res.session.state}/${res.session.phase} · ${Date.now() - t0} ms · ` +
        `${res.progress.confirmed.length}/7 confirmed`,
    );

    // TODO(persist): POST res.events to the `turn` edge function in `apply` mode. Left explicit
    // rather than silently dropped — an unpersisted call is a lost interview, and in this scheme
    // that is a person who has to be phoned again.
    if (res.events.length > 0 && process.env.SUPABASE_FUNCTIONS_URL) {
      void fetch(`${process.env.SUPABASE_FUNCTIONS_URL}/turn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''}` },
        body: JSON.stringify({ mode: 'apply', events: res.events }),
      }).catch((e) => console.error('[ivr] persist failed:', e.message));
    }

    await playSay(res.say, res.session.locale);

    if (res.terminal) {
      setTimeout(() => ws.close(), 500);
      return;
    }
    call.listening = true;
  };

  const endpointUtterance = async () => {
    call.listening = false;
    const pcm8 = Buffer.concat(call.buffer);
    call.buffer = [];
    call.speechFrames = 0;
    call.silenceFrames = 0;

    if (pcm8.length === 0) {
      await advance({ kind: 'timeout' });
      return;
    }

    const pcm16 = upsample8to16(pcm8);
    try {
      const r = await asr.transcribe(pcm16, 16000, call.session.locale);
      if (r.transcripts.length === 0) {
        await advance({ kind: 'timeout' });
        return;
      }
      await advance({ kind: 'audio', transcripts: r.transcripts, asrEngine: r.engine, asrVersion: r.version });
    } catch (e) {
      console.error('[ivr] asr failed:', e instanceof Error ? e.message : e);
      await advance({ kind: 'timeout' });
    }
  };

  ws.on('message', (raw) => {
    let msg: Record<string, any>;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    switch (msg.event) {
      case 'connected':
        console.log('[ivr] connected');
        break;

      case 'start': {
        call.streamSid = msg.stream_sid ?? msg.start?.stream_sid ?? null;
        call.callSid = msg.start?.call_sid ?? null;
        console.log(`[ivr] start call=${call.callSid} from=${msg.start?.from ?? '?'} to=${msg.start?.to ?? '?'}`);
        void advance({ kind: 'opened' });
        break;
      }

      case 'media': {
        const frame = Buffer.from(msg.media?.payload ?? '', 'base64');
        if (frame.length === 0) return;
        const level = rms(frame);

        // Adapt the floor downward quickly and upward slowly, so a passing tractor does not
        // permanently deafen the endpointer.
        call.noiseFloor = level < call.noiseFloor ? call.noiseFloor * 0.9 + level * 0.1 : call.noiseFloor * 0.995 + level * 0.005;
        const isSpeech = level > Math.max(0.012, call.noiseFloor * 2.2);

        if (call.speaking) {
          // Barge-in: the caller talking over the prompt wins, always.
          if (isSpeech) {
            call.speechFrames++;
            if (call.speechFrames >= 3) {
              console.log('[ivr] barge-in');
              clear();
              call.listening = true;
              call.buffer = [frame];
              call.speechFrames = 1;
              call.silenceFrames = 0;
              call.utteranceStart = Date.now();
            }
          } else {
            call.speechFrames = 0;
          }
          return;
        }

        if (!call.listening) return;

        if (isSpeech) {
          if (call.buffer.length === 0) call.utteranceStart = Date.now();
          call.buffer.push(frame);
          call.speechFrames++;
          call.silenceFrames = 0;
        } else if (call.buffer.length > 0) {
          call.buffer.push(frame); // keep trailing silence: clipping the tail costs the last word
          call.silenceFrames++;
          if (call.silenceFrames >= SILENCE_FRAMES_TO_ENDPOINT && call.speechFrames >= MIN_SPEECH_FRAMES) {
            void endpointUtterance();
          }
        }

        if (call.buffer.length > 0 && Date.now() - call.utteranceStart > MAX_UTTERANCE_MS) {
          void endpointUtterance();
        }
        break;
      }

      case 'dtmf': {
        const digit = msg.dtmf?.digit;
        if (!digit) return;
        console.log(`[ivr] dtmf ${digit}`);
        clear();
        call.buffer = [];
        // ₹0, 0 ms, 0 WER — the safety net under a 26.8-WER recogniser.
        void advance({ kind: 'dtmf', digits: String(digit) });
        break;
      }

      case 'stop':
        console.log(`[ivr] stop reason=${msg.stop?.reason ?? '?'}`);
        // Rural calls drop constantly; this is the normal path, not the error path. The session
        // becomes RESUMABLE and the answer rows survive, because they hang off beneficiary_id and
        // not off session_id.
        void advance({ kind: 'hangup', reason: msg.stop?.reason });
        break;
    }
  });

  ws.on('close', () => {
    console.log('[ivr] socket closed');
    call.sendAbort?.abort();
  });

  ws.on('error', (e) => console.error('[ivr] socket error:', e.message));
}
