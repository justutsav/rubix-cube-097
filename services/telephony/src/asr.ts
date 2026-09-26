/**
 * The speech provider seam.
 *
 * `02-tech-landscape.md` argues the differentiator is the *switch*, not the model: one interface,
 * several implementations, chosen by a config value. This is that interface. Three things about it
 * are deliberate:
 *
 *  1. **Metered API by default, self-hosted as the switch you demonstrate.** An always-on L4 costs
 *     ₹4.29 lakh/year whether anyone calls or not, and only beats Sarvam's ₹30/hour above roughly
 *     47,700 four-minute interviews a month — two orders of magnitude above pilot scale. The thing
 *     that breaks a district PIU is not the per-minute cost, it is a standing GPU bill they must
 *     justify before a single call is placed (spec §9, corrected cost model).
 *
 *  2. **n-best, not a single transcript.** The whole extraction ladder matches against alternates.
 *     A provider that returns one string throws away the signal the lexicon rung runs on — which is
 *     exactly why Dialogflow loses as an engine (spec §11).
 *
 *  3. **8 kHz in, and say so.** Telephony is narrowband. Upsampling to 16 kHz makes the model
 *     accept the audio; it does not restore the missing band, and the published WER numbers for
 *     these models are not measured on telephone audio. The degradation is absorbed downstream by
 *     the lexicon, and it is measured rather than assumed.
 */

export interface AsrResult {
  transcripts: string[];
  engine: string;
  version: string;
  latencyMs: number;
}

export interface AsrProvider {
  id: string;
  /** `pcm` is 16-bit little-endian mono at `rate` Hz. */
  transcribe(pcm: Buffer, rate: number, locale: string): Promise<AsrResult>;
}

/**
 * Polyphase-free linear upsample, 8 kHz → 16 kHz.
 *
 * Honest about what it is: a format fix, not a quality fix. Stretching a small photo to fit a
 * frame adds no detail that was never captured. It is here because IndicConformer and most hosted
 * models want 16 kHz input and will refuse or mangle 8 kHz.
 */
export function upsample8to16(pcm8: Buffer): Buffer {
  const inSamples = pcm8.length >> 1;
  const out = Buffer.alloc(inSamples * 4);
  for (let i = 0; i < inSamples; i++) {
    const a = pcm8.readInt16LE(i * 2);
    const b = i + 1 < inSamples ? pcm8.readInt16LE((i + 1) * 2) : a;
    out.writeInt16LE(a, i * 4);
    out.writeInt16LE((a + b) >> 1, i * 4 + 2);
  }
  return out;
}

/** Root-mean-square of a PCM frame, 0..1. The VAD's input. */
export function rms(pcm: Buffer): number {
  const n = pcm.length >> 1;
  if (n === 0) return 0;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const s = pcm.readInt16LE(i * 2) / 32768;
    sum += s * s;
  }
  return Math.sqrt(sum / n);
}

class StubProvider implements AsrProvider {
  id = 'stub';
  async transcribe(pcm: Buffer, rate: number): Promise<AsrResult> {
    // Returns nothing, on purpose. An empty result is a timeout to the FSM, which re-asks — so the
    // call flow is still fully exercisable end to end without a vendor key, and nobody can mistake
    // a stub for a working recogniser.
    return {
      transcripts: [],
      engine: 'stub',
      version: `${pcm.length}B@${rate}`,
      latencyMs: 0,
    };
  }
}

class BhashiniProvider implements AsrProvider {
  id = 'bhashini';
  constructor(private readonly key: string, private readonly endpoint: string) {}

  async transcribe(pcm: Buffer, rate: number, locale: string): Promise<AsrResult> {
    const started = Date.now();
    const res = await fetch(this.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: this.key },
      body: JSON.stringify({
        pipelineTasks: [{ taskType: 'asr', config: { language: { sourceLanguage: locale }, audioFormat: 'wav', samplingRate: rate } }],
        inputData: { audio: [{ audioContent: pcm.toString('base64') }] },
      }),
    });
    if (!res.ok) throw new Error(`bhashini ${res.status}: ${await res.text()}`);
    const body = (await res.json()) as { pipelineResponse?: { output?: { source?: string }[] }[] };
    const text = body.pipelineResponse?.[0]?.output?.[0]?.source ?? '';
    return { transcripts: text ? [text] : [], engine: 'bhashini', version: 'ulca-v1', latencyMs: Date.now() - started };
  }
}

class SarvamProvider implements AsrProvider {
  id = 'sarvam';
  constructor(private readonly key: string) {}

  async transcribe(pcm: Buffer, rate: number, locale: string): Promise<AsrResult> {
    const started = Date.now();
    const form = new FormData();
    form.append('file', new Blob([wavHeader(pcm, rate), pcm], { type: 'audio/wav' }), 'turn.wav');
    form.append('language_code', locale);
    const res = await fetch('https://api.sarvam.ai/speech-to-text', {
      method: 'POST',
      headers: { 'api-subscription-key': this.key },
      body: form,
    });
    if (!res.ok) throw new Error(`sarvam ${res.status}: ${await res.text()}`);
    const body = (await res.json()) as { transcript?: string };
    return {
      transcripts: body.transcript ? [body.transcript] : [],
      engine: 'sarvam',
      version: 'saarika',
      latencyMs: Date.now() - started,
    };
  }
}

/** Minimal 44-byte RIFF header so raw PCM can be posted as a .wav. */
export function wavHeader(pcm: Buffer, rate: number, channels = 1, bits = 16): Buffer {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0);
  h.writeUInt32LE(36 + pcm.length, 4);
  h.write('WAVE', 8);
  h.write('fmt ', 12);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(channels, 22);
  h.writeUInt32LE(rate, 24);
  h.writeUInt32LE((rate * channels * bits) / 8, 28);
  h.writeUInt16LE((channels * bits) / 8, 32);
  h.writeUInt16LE(bits, 34);
  h.write('data', 36);
  h.writeUInt32LE(pcm.length, 40);
  return h;
}

export function makeAsr(): AsrProvider {
  const which = process.env.ASR_PROVIDER ?? 'stub';
  if (which === 'bhashini') {
    const key = process.env.BHASHINI_API_KEY;
    const endpoint = process.env.BHASHINI_ENDPOINT;
    if (!key || !endpoint) throw new Error('ASR_PROVIDER=bhashini needs BHASHINI_API_KEY and BHASHINI_ENDPOINT');
    return new BhashiniProvider(key, endpoint);
  }
  if (which === 'sarvam') {
    const key = process.env.SARVAM_API_KEY;
    if (!key) throw new Error('ASR_PROVIDER=sarvam needs SARVAM_API_KEY');
    return new SarvamProvider(key);
  }
  return new StubProvider();
}
