/**
 * Voice in and voice out on the device.
 *
 * What this is, honestly: **the platform's own speech stack, with no API key and no vendor.**
 * Two implementations behind one `recognise()`:
 *
 *   · on a handset — Android's native `SpeechRecognizer`, via a Capacitor plugin. This is the
 *     primary path, because Android System WebView does not implement the Web Speech API at all.
 *   · in a browser tab — `webkitSpeechRecognition`, which is Chrome's.
 *
 * Output is `speechSynthesis`, which on Android is the device's own TTS engine and does work
 * offline once a voice is installed.
 *
 * It is enough to demonstrate the whole product end to end and it costs nothing, but it is NOT the
 * shipping answer for two reasons that matter and must not be glossed over:
 *
 *   1. **Android's SpeechRecognizer usually needs a network round trip**, which breaks the one
 *      claim the kiosk channel exists to make — a complete interview in aeroplane mode. Offline
 *      recognition depends on the user having downloaded an on-device language pack, which most
 *      ₹6,000 handsets have not.
 *   2. **Its Hindi model is a general-purpose one.** The 26.8-to-59.9 WER problem applies here as
 *      much as anywhere; this layer is not better than Google STT, it IS roughly Google STT.
 *
 * The real offline path is Vosk (~50 MB per language, Apache-2.0) behind a small Capacitor plugin.
 * That plugin is the single remaining native piece, and `recognise()` is the seam it slots into:
 * everything above this file consumes n-best strings and does not care where they came from. The
 * ladder in @rc097/core is what absorbs the accuracy gap either way — which is the point of
 * building it that way.
 *
 * Output is deliberately asymmetric. Fixed prompts are pre-rendered WAVs addressed by prompt id
 * (decisions.md) and `speak()` prefers a file if one has been rendered; `speechSynthesis` is the
 * fallback so the app is usable before the recording session happens.
 */

export interface RecogniseControl {
  /**
   * End the utterance and KEEP the result. This is what a "stop" button must call.
   *
   * `abort()` and `stop()` are not interchangeable: abort throws the audio away, stop finalises it.
   * An earlier version wired the mic's release to abort, so every utterance was discarded and the
   * FSM saw a timeout — the mic appeared to be stuck on.
   */
  stop(): void;
  /** Discard the utterance — for navigating away, or barge-in over our own playback. */
  abort(): void;
}

export interface RecogniseOptions {
  locale: string;
  /** Ask for alternates — the ladder's rung 1 matches against all of them, not just the top one. */
  maxAlternatives?: number;
  onPartial?: (text: string) => void;
  signal?: AbortSignal;
  /** Handed a controller as soon as recognition starts, so the UI can stop it. */
  register?: (ctl: RecogniseControl) => void;
}

export interface RecogniseResult {
  /** Best-first. May be a single string when the engine gives no alternates. */
  transcripts: string[];
  engine: string;
  version: string;
  /** Wall-clock for the recognition leg only. Goes into turn telemetry. */
  latencyMs: number;
}

type SR = new () => SpeechRecognitionLike;

interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  onspeechend: (() => void) | null;
}

interface SpeechRecognitionEventLike {
  results: ArrayLike<ArrayLike<{ transcript: string; confidence: number }> & { isFinal: boolean }>;
  resultIndex: number;
}

function getSR(): SR | null {
  const w = window as unknown as { SpeechRecognition?: SR; webkitSpeechRecognition?: SR };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/**
 * Synchronous best-effort check, for rendering a warning band.
 *
 * The native plugin is discovered asynchronously, so this is primed at module load and may read
 * `false` for the first few milliseconds. `listen()` does not gate on it — it calls `recognise()`
 * and handles the failure — precisely so a slow probe never stops somebody speaking.
 */
export const asrAvailable = (): boolean => getSR() !== null || nativeAsr?.available === true;

// Prime the native probe so the UI settles on the truth quickly.
void (async () => {
  try {
    await getNative();
  } catch {
    /* browser */
  }
})();

/**
 * BCP-47 tags for the locales we author prompts in.
 *
 * Note what this map says out loud: Bhojpuri, Magahi, Rajasthani and Chhattisgarhi — about
 * 11 crore speakers — have no tag and no model, so they are recognised as Hindi and the resulting
 * error is absorbed downstream by the vernacular lexicon. We do not pretend otherwise, and
 * `degraded` is surfaced in the UI so nobody watching a demo concludes we trained something.
 */
export const ASR_LOCALE: Record<string, { tag: string; degraded: boolean }> = {
  hi: { tag: 'hi-IN', degraded: false },
  bho: { tag: 'hi-IN', degraded: true },
  mag: { tag: 'hi-IN', degraded: true },
  raj: { tag: 'hi-IN', degraded: true },
  cgh: { tag: 'hi-IN', degraded: true },
  ta: { tag: 'ta-IN', degraded: false },
  en: { tag: 'en-IN', degraded: false },
};

// ---------------------------------------------------------------------------- server path

/**
 * Record on the device, transcribe on a server we choose.
 *
 * This is the path the spec always described and the one the dialect argument depends on: capture
 * audio, send it to a provider selected by config, get back one or more hypotheses, and let the
 * extraction ladder do the rest. The on-device recogniser below is the *fallback* — it exists for
 * the moment there is no network, not as the architecture.
 *
 * The vendor key never ships in the APK. `VITE_ASR_URL` points at our own endpoint, which holds
 * the credential; the handset only ever talks to us.
 */
const ASR_URL = import.meta.env.VITE_ASR_URL as string | undefined;

export const serverAsrConfigured = Boolean(ASR_URL);

async function recogniseServer(opts: RecogniseOptions, localeKey: string): Promise<RecogniseResult> {
  const { startRecording, blobToBase64 } = await import('./record');
  const started = performance.now();
  const rec = await startRecording();

  let settle: () => void = () => undefined;
  const finished = new Promise<void>((resolve) => {
    settle = resolve;
  });

  opts.register?.({
    stop: () => settle(),
    abort: () => {
      rec.cancel();
      settle();
    },
  });

  // A live level readout, so the speaker can see she is being heard. There is no partial
  // transcript on this path — nothing has been sent yet — and a silent screen during a long answer
  // is exactly what makes people stop talking.
  const meter = window.setInterval(() => {
    if (rec.level() > 0.02) opts.onPartial?.('…');
  }, 250);

  // Hard cap. Sarvam bills by audio duration, and a phone left face-up in a pocket is a bill.
  const cap = window.setTimeout(() => settle(), 25_000);

  await finished;
  window.clearInterval(meter);
  window.clearTimeout(cap);

  const capture = await rec.stop().catch(() => null);
  if (!capture || capture.durationMs < 300) {
    return { transcripts: [], engine: 'server', version: 'too-short', latencyMs: Math.round(performance.now() - started) };
  }

  const res = await fetch(String(ASR_URL), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      locale: localeKey,
      rate: capture.sampleRate,
      audioBase64: await blobToBase64(capture.wav),
    }),
  });
  if (!res.ok) throw new Error(`asr ${res.status}`);
  const body = (await res.json()) as { transcripts?: string[]; engine?: string; version?: string };
  return {
    transcripts: body.transcripts ?? [],
    engine: body.engine ?? 'server',
    version: body.version ?? '',
    latencyMs: Math.round(performance.now() - started),
  };
}

// ---------------------------------------------------------------------------- native path

/**
 * Android's own SpeechRecognizer, via @capacitor-community/speech-recognition.
 *
 * This is the primary path on a handset, and it has to be, because **Android System WebView does
 * not implement the Web Speech API at all** — `window.SpeechRecognition` is a Chrome-browser
 * feature, not a WebView one. The first APK shipped with only the browser path and a mic button
 * that could not start, which is what the mic appearing "stuck on" actually was.
 *
 * Still not the shipping answer for R6: Android's recogniser normally needs a network round trip
 * unless the user has downloaded an offline language pack. Vosk behind a small plugin is the real
 * offline path, and it slots in right here.
 */
let nativeAsr: { available: boolean; mod: any } | null = null;

/**
 * Returns a WRAPPER, never the plugin object itself.
 *
 * Capacitor plugin handles are Proxies that forward every property access to a native call —
 * including `then`. Returning one from an `async` function makes the JavaScript runtime treat it as
 * a thenable and invoke `.then()`, which on Android throws
 * `"SpeechRecognition.then() is not implemented"` as an unhandled rejection, and the mic never
 * starts. Boxing it in a plain object is the whole fix.
 */
async function getNative(): Promise<{ sr: any } | null> {
  if (nativeAsr) return nativeAsr.available ? { sr: nativeAsr.mod } : null;
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (!Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable('SpeechRecognition')) {
      nativeAsr = { available: false, mod: null };
      return null;
    }
    const mod = await import('@capacitor-community/speech-recognition');
    nativeAsr = { available: true, mod: mod.SpeechRecognition };
    return { sr: nativeAsr.mod };
  } catch {
    nativeAsr = { available: false, mod: null };
    return null;
  }
}

async function recogniseNative(sr: any, opts: RecogniseOptions): Promise<RecogniseResult> {
  const started = performance.now();

  const perm = await sr.checkPermissions().catch(() => ({ speechRecognition: 'prompt' }));
  if (perm.speechRecognition !== 'granted') {
    const asked = await sr.requestPermissions().catch(() => ({ speechRecognition: 'denied' }));
    if (asked.speechRecognition !== 'granted') throw new Error('mic_permission_denied');
  }

  // Partial results are the only feedback the user gets that the machine is hearing them, and on
  // this channel that reassurance matters more than it does on a phone call, where silence is
  // expected.
  let best: string[] = [];
  const partialHandle = await sr.addListener('partialResults', (data: { matches?: string[] }) => {
    if (data.matches?.length) {
      best = data.matches;
      opts.onPartial?.(data.matches[0]);
    }
  });

  /**
   * The turn ends on `listeningState: stopped`, NOT on `start()` resolving.
   *
   * This is the bug that made the mic look stuck. With `partialResults: true` the plugin's
   * `start()` promise resolves the moment recognition *begins* — it does not wait for speech. The
   * first version awaited it, concluded the turn was over, set the button back to idle and dropped
   * the controller, while Android's recogniser carried on listening with the mic live. Tapping
   * again then started a *second* recognition instead of stopping the first.
   *
   * Resolving on the stop event also means Android's own endpointing ends the turn by itself after
   * a couple of seconds of silence, so the second tap is a shortcut rather than a requirement.
   */
  let settle: (v: string[]) => void = () => undefined;
  const finished = new Promise<string[]>((resolve) => {
    settle = resolve;
  });

  const stateHandle = await sr.addListener('listeningState', (data: { status?: string }) => {
    if (data.status === 'stopped') settle(best);
  });

  opts.register?.({
    stop: () => void sr.stop().catch(() => settle(best)),
    abort: () => {
      best = [];
      void sr.stop().catch(() => settle([]));
    },
  });

  // Last-resort cap. If neither the stop event nor the promise ever arrives — a vendor WebView
  // quirk we cannot rule out on every handset — the turn must still end rather than hold the mic
  // open indefinitely.
  const cap = setTimeout(() => {
    void sr.stop().catch(() => undefined);
    settle(best);
  }, 20_000);

  try {
    const res = await sr.start({
      language: opts.locale,
      maxResults: opts.maxAlternatives ?? 5,
      partialResults: true,
      popup: false,
    });
    // Some Android builds return the final matches here anyway. Take them if they come.
    if (res?.matches?.length) {
      best = res.matches;
      settle(best);
    }
  } catch {
    settle(best);
  }

  const matches = await finished;
  clearTimeout(cap);
  await partialHandle?.remove?.();
  await stateHandle?.remove?.();

  return {
    transcripts: matches,
    engine: 'android-speechrecognizer',
    version: 'capacitor-community',
    latencyMs: Math.round(performance.now() - started),
  };
}

/**
 * Order of preference, and the reason for it:
 *
 *   1. **our server** — a provider we chose, the language we asked for, and alternates where the
 *      provider returns them. Needs network.
 *   2. **on-device recogniser** — one hypothesis, whatever model the handset happens to have.
 *      Works when the server does not.
 *   3. **browser Web Speech** — dev only; Android WebView does not implement it.
 *
 * `localeKey` is our own code ('bho', 'mai'), not a BCP-47 tag: the mapping to a provider's
 * language code is a property of that provider and belongs beside it on the server.
 */
export async function recognise(opts: RecogniseOptions & { localeKey?: string }): Promise<RecogniseResult> {
  const localeKey = opts.localeKey ?? 'hi';

  if (ASR_URL && navigator.onLine) {
    try {
      return await recogniseServer(opts, localeKey);
    } catch (e) {
      // Network gone mid-answer. Fall back to the device rather than losing the turn — on a rural
      // connection this is the normal case, not an exception.
      console.warn('[asr] server path failed, falling back on device:', e instanceof Error ? e.message : e);
    }
  }

  const native = await getNative();
  if (native) return recogniseNative(native.sr, opts);
  return recogniseWeb(opts);
}

function recogniseWeb(opts: RecogniseOptions): Promise<RecogniseResult> {
  const SRClass = getSR();
  if (!SRClass) return Promise.reject(new Error('no_asr'));

  const started = performance.now();
  const rec = new SRClass();
  rec.lang = opts.locale;
  rec.continuous = false;
  rec.interimResults = Boolean(opts.onPartial);
  rec.maxAlternatives = opts.maxAlternatives ?? 5;

  return new Promise<RecogniseResult>((resolve, reject) => {
    let settled = false;
    const finish = (r: RecogniseResult) => {
      if (settled) return;
      settled = true;
      resolve(r);
    };
    const fail = (e: Error) => {
      if (settled) return;
      settled = true;
      reject(e);
    };

    rec.onresult = (e) => {
      const last = e.results[e.results.length - 1];
      const alts: string[] = [];
      for (let i = 0; i < last.length; i++) {
        const t = last[i]?.transcript?.trim();
        if (t && !alts.includes(t)) alts.push(t);
      }
      if (!last.isFinal) {
        opts.onPartial?.(alts[0] ?? '');
        return;
      }
      finish({
        transcripts: alts,
        engine: 'webspeech',
        version: navigator.userAgent.slice(0, 40),
        latencyMs: Math.round(performance.now() - started),
      });
    };

    rec.onerror = (e) => {
      // `no-speech` and `aborted` are ordinary outcomes on a noisy village line, not faults. The
      // FSM treats an empty result as a timeout and re-asks, which is what a considerate human
      // interviewer does anyway.
      if (e.error === 'no-speech' || e.error === 'aborted') {
        finish({ transcripts: [], engine: 'webspeech', version: '', latencyMs: Math.round(performance.now() - started) });
        return;
      }
      fail(new Error(e.error));
    };

    rec.onend = () => finish({ transcripts: [], engine: 'webspeech', version: '', latencyMs: Math.round(performance.now() - started) });

    opts.signal?.addEventListener('abort', () => {
      try {
        rec.abort();
      } catch {
        /* already stopped */
      }
    });

    try {
      rec.start();
      opts.register?.({
        stop: () => {
          try {
            rec.stop(); // finalise: onresult still fires with isFinal
          } catch {
            /* already stopped */
          }
        },
        abort: () => {
          try {
            rec.abort();
          } catch {
            /* already stopped */
          }
        },
      });
    } catch (e) {
      fail(e instanceof Error ? e : new Error('start_failed'));
    }
  });
}

// ---------------------------------------------------------------------------- output

/**
 * Where a pre-rendered prompt WAV would live, given its id.
 *
 * The render step (a one-off script over the prompt registry, then a human listening to all ~45 of
 * them once) has not run yet, so these files do not exist and `speak()` falls through to
 * synthesis. The lookup is here now so that when the WAVs land, nothing above this line changes —
 * and so the same prompt id resolves to a file on the phone, a WAV on the IVR box and a Meta media
 * id on WhatsApp, which is what stops the four channels drifting apart.
 */
export function promptAudioUrl(promptId: string, locale: string): string {
  return `./prompts/${locale}/${promptId}.wav`;
}

const audioCache = new Map<string, boolean>();

async function tryPlayFile(url: string): Promise<boolean> {
  if (audioCache.get(url) === false) return false;
  try {
    const res = await fetch(url, { method: 'HEAD' });
    if (!res.ok) {
      audioCache.set(url, false);
      return false;
    }
  } catch {
    audioCache.set(url, false);
    return false;
  }
  audioCache.set(url, true);
  await new Promise<void>((resolve) => {
    const a = new Audio(url);
    a.onended = () => resolve();
    a.onerror = () => resolve();
    void a.play().catch(() => resolve());
  });
  return true;
}

// ---------------------------------------------------------------------------- native TTS

/**
 * Android's own text-to-speech, via @capacitor-community/text-to-speech.
 *
 * Needed for the same reason as the recogniser: **Android System WebView implements neither half
 * of the Web Speech API.** `window.speechSynthesis` is missing, so the browser path renders no
 * replay control and the app is silent on a handset — which, for a product whose entire premise is
 * that the user cannot read, is not a degraded experience, it is no product at all.
 *
 * Boxed in a wrapper for the same reason as the recogniser: a Capacitor plugin proxy forwards
 * `then` to native, so returning one from an `async` function makes the runtime call `.then()` on
 * it and throw.
 */
let nativeTts: { available: boolean; mod: any } | null = null;

async function getNativeTts(): Promise<{ tts: any } | null> {
  if (nativeTts) return nativeTts.available ? { tts: nativeTts.mod } : null;
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (!Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable('TextToSpeech')) {
      nativeTts = { available: false, mod: null };
      return null;
    }
    const mod = await import('@capacitor-community/text-to-speech');
    nativeTts = { available: true, mod: mod.TextToSpeech };
    return { tts: nativeTts.mod };
  } catch {
    nativeTts = { available: false, mod: null };
    return null;
  }
}

void (async () => {
  try {
    await getNativeTts();
  } catch {
    /* browser */
  }
})();

export function cancelSpeech(): void {
  try {
    window.speechSynthesis?.cancel();
  } catch {
    /* not available */
  }
  if (nativeTts?.available) void nativeTts.mod.stop().catch(() => undefined);
}

export async function speak(text: string, locale: string, promptId?: string): Promise<void> {
  if (promptId) {
    const played = await tryPlayFile(promptAudioUrl(promptId, locale));
    if (played) return;
  }
  const native = await getNativeTts();
  if (native) {
    // Slightly slower than default: the listener may be hearing scheme vocabulary for the first
    // time, over a poor speaker, in a second dialect.
    await native.tts
      .speak({
        text,
        lang: ASR_LOCALE[locale]?.tag ?? 'hi-IN',
        rate: 0.92,
        pitch: 1.0,
        volume: 1.0,
        category: 'playback',
      })
      .catch((e: unknown) => console.warn('[tts] native speak failed:', e));
    return;
  }

  const synth = window.speechSynthesis;
  if (!synth) return;
  cancelSpeech();
  await new Promise<void>((resolve) => {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = ASR_LOCALE[locale]?.tag ?? 'hi-IN';
    // Slightly slower than default: the listener may be hearing scheme vocabulary for the first
    // time, over a poor speaker, in a second dialect.
    u.rate = 0.92;
    u.onend = () => resolve();
    u.onerror = () => resolve();
    synth.speak(u);
  });
}

export const ttsAvailable = (): boolean =>
  nativeTts?.available === true || (typeof window !== 'undefined' && 'speechSynthesis' in window);
