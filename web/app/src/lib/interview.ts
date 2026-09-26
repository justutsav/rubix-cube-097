/**
 * The React binding for the interview engine.
 *
 * All this does is move data: utterance in → `turn()` → persist the returned DomainEvents → render
 * `say` and `expect`. No interview logic lives here, and none may be added. If a rule about the
 * seven questions ever appears in this file, the WhatsApp adapter and the IVR adapter immediately
 * have a different interview, and by day three they disagree about what was asked (spec §0).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DISTRICTS,
  OPPORTUNITIES,
  QUALIFICATIONS,
  NQR_SNAPSHOT_SHA,
  romanize,
  startSession,
  turn,
  type Channel,
  type Expect,
  type Locale,
  type SayRef,
  type SessionState,
  type RecommendationResult,
  type TurnDeps,
  type Utterance,
} from '@rc097/core';
import { openStore, type Store } from './db';
import { ASR_LOCALE, cancelSpeech, recognise, speak, type RecogniseControl } from './speech';

export type MicState = 'idle' | 'listening' | 'thinking' | 'speaking';

export interface InterviewView {
  session: SessionState | null;
  say: SayRef[];
  expect: Expect;
  progress: { confirmed: number[]; deferred: number[]; total: number };
  recommendation: RecommendationResult | null;
  mic: MicState;
  partial: string;
  error: string | null;
  /** Last measured turn latency, so the latency claim is visible rather than asserted. */
  lastTurnMs: number | null;
  asrDegraded: boolean;
}

/**
 * Resolve a spoken village or block against the pilot block list.
 *
 * Village and block names are a closed set per state, which makes Q0 the *easiest* field in the
 * interview rather than the hardest — and it reuses the trade matcher's romanisation, so
 * "पिंड्रा" and "Pindra" land on the same block. LGD codes stay null because the LGD directory has
 * not been pulled; a name with an honest null code beats a guessed number.
 */
function resolvePlace(text: string, hypotheses: string[]) {
  const cands = [text, ...hypotheses].map(romanize).filter(Boolean);
  for (const d of DISTRICTS) {
    for (const b of d.blocks) {
      const key = romanize(b.name);
      if (cands.some((c) => c.includes(key) || key.includes(c))) {
        return {
          villageName: text.trim(),
          blockName: b.name,
          blockLgd: b.lgdCode,
          districtName: d.name,
          districtLgd: d.lgdCode,
          confidence: 0.9,
        };
      }
    }
    const dk = romanize(d.name);
    if (cands.some((c) => c.includes(dk))) {
      return { villageName: text.trim(), blockName: null, blockLgd: null, districtName: d.name, districtLgd: d.lgdCode, confidence: 0.75 };
    }
  }
  return null;
}

export function useInterview(channel: Channel = 'app') {
  const [store, setStore] = useState<Store | null>(null);
  const [view, setView] = useState<InterviewView>({
    session: null,
    say: [],
    expect: { kind: 'none', timeoutMs: 0 },
    progress: { confirmed: [], deferred: [], total: 7 },
    recommendation: null,
    mic: 'idle',
    partial: '',
    error: null,
    lastTurnMs: null,
    asrDegraded: false,
  });

  const abort = useRef<AbortController | null>(null);
  const control = useRef<RecogniseControl | null>(null);
  const busy = useRef(false);

  useEffect(() => {
    void openStore().then(setStore);
  }, []);

  const deps: TurnDeps = useMemo(
    () => ({
      catalogue: QUALIFICATIONS,
      opportunities: OPPORTUNITIES,
      nqrSnapshotSha: NQR_SNAPSHOT_SHA,
      resolvePlace,
      // No `llm`. The app is the offline surface, so rung 3 is absent by design and the ladder
      // degrades to DTMF-equivalent taps and a re-ask. Nothing breaks; it just asks again.
    }),
    [],
  );

  /** Speak the assistant's lines in order, so the beneficiary hears a turn rather than a list. */
  const utter = useCallback(async (lines: SayRef[], locale: Locale) => {
    for (const line of lines) {
      const promptId = line.kind === 'prerendered' ? line.id : undefined;
      const text = 'text' in line ? line.text : '';
      if (!text) continue;
      await speak(text, locale, promptId);
    }
  }, []);

  const submit = useCallback(
    async (utterance: Utterance, sessionOverride?: SessionState) => {
      if (!store || busy.current) return;
      busy.current = true;
      const t0 = performance.now();
      try {
        const current = sessionOverride ?? view.session ?? startSession({ channel });
        setView((v) => ({ ...v, mic: 'thinking', error: null }));

        const res = await turn(
          current,
          { channel, channelRef: current.sessionId, identity: { kind: 'device', value: current.beneficiaryId }, utterance },
          deps,
        );

        // Persist before rendering. If the app is killed mid-turn — which on a cheap Android under
        // memory pressure is a routine event, not a rare one — the answer is already durable and the
        // session resumes at the right field.
        await store.applyEvents(res.events);

        setView((v) => ({
          ...v,
          session: res.session,
          say: res.say,
          expect: res.expect,
          progress: { confirmed: res.progress.confirmed, deferred: res.progress.deferred, total: 7 },
          recommendation: res.recommendation ?? v.recommendation,
          mic: 'speaking',
          partial: '',
          lastTurnMs: Math.round(performance.now() - t0),
          asrDegraded: ASR_LOCALE[res.session.locale]?.degraded ?? false,
        }));

        await utter(res.say, res.session.locale);
        setView((v) => ({ ...v, mic: 'idle' }));
      } catch (e) {
        setView((v) => ({ ...v, mic: 'idle', error: e instanceof Error ? e.message : String(e) }));
      } finally {
        busy.current = false;
      }
    },
    [channel, deps, store, utter, view.session],
  );

  const begin = useCallback(
    async (opts: { beneficiaryId?: string; locale?: Locale; resume?: SessionState } = {}) => {
      if (!store) return;
      const s = opts.resume ?? startSession({ channel, beneficiaryId: opts.beneficiaryId, locale: opts.locale });
      setView((v) => ({ ...v, session: s, recommendation: null }));
      await submit({ kind: 'opened' }, s);
    },
    [channel, store, submit],
  );

  /**
   * Tap to start, tap again to stop — not hold-to-talk.
   *
   * Hold-to-talk was tried on a real handset and does not work: once Android's recogniser takes the
   * mic, `pointerup` and `pointerleave` stop arriving reliably in the WebView, so the button never
   * released and the mic appeared stuck on. It is also the wrong interaction for this user — holding
   * a button steady for ten seconds while composing an answer is harder than pressing twice, and
   * impossible one-handed while holding a child.
   */
  const listen = useCallback(async () => {
    const s = view.session;
    if (!s || busy.current) return;

    // Second tap: finalise. `stop()` keeps the audio; `abort()` would throw it away.
    if (control.current) {
      control.current.stop();
      control.current = null;
      setView((v) => ({ ...v, mic: 'thinking' }));
      return;
    }

    cancelSpeech();
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setView((v) => ({ ...v, mic: 'listening', partial: '', error: null }));

    try {
      const tag = ASR_LOCALE[s.locale]?.tag ?? 'hi-IN';
      const r = await recognise({
        locale: tag,
        maxAlternatives: 5,
        signal: ctrl.signal,
        register: (ctl) => {
          control.current = ctl;
        },
        onPartial: (text) => setView((v) => ({ ...v, partial: text })),
      });
      control.current = null;
      if (r.transcripts.length === 0) {
        // Silence is a timeout, and a timeout is a re-ask. Not an error message.
        await submit({ kind: 'timeout' });
        return;
      }
      await submit({ kind: 'audio', transcripts: r.transcripts, asrEngine: r.engine, asrVersion: r.version });
    } catch (e) {
      control.current = null;
      const msg = e instanceof Error ? e.message : String(e);
      // Distinguish "this device cannot listen" from "the user said nothing", because the first is
      // a dead end that needs the on-screen buttons and the second is an ordinary re-ask.
      setView((v) => ({ ...v, mic: 'idle', error: /no_asr|not-allowed|permission/i.test(msg) ? 'no_asr' : msg }));
    }
  }, [submit, view.session]);

  /** Escape hatch: discard the current utterance without submitting it. */
  const stopListening = useCallback(() => {
    control.current?.abort();
    control.current = null;
    abort.current?.abort();
    setView((v) => (v.mic === 'listening' ? { ...v, mic: 'idle', partial: '' } : v));
  }, []);

  const choose = useCallback((optionId: string) => submit({ kind: 'choice', optionId }), [submit]);
  const sendText = useCallback((value: string) => submit({ kind: 'text', value }), [submit]);
  const sendDtmf = useCallback((digits: string) => submit({ kind: 'dtmf', digits }), [submit]);
  const hangup = useCallback(() => submit({ kind: 'hangup', reason: 'user_left' }), [submit]);

  /** Replay the current lines. "Press 9 to hear it again" has to exist on every surface. */
  const repeat = useCallback(() => {
    const s = view.session;
    if (s) void utter(view.say, s.locale);
  }, [utter, view.say, view.session]);

  useEffect(() => () => cancelSpeech(), []);

  return { ...view, store, begin, listen, stopListening, choose, sendText, sendDtmf, hangup, repeat };
}
