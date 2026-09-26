/**
 * Capture the microphone as 16 kHz mono PCM, wrapped in a WAV.
 *
 * Why not `MediaRecorder`: it emits WebM/Opus on Android with no control over sample rate, and
 * while Sarvam accepts WebM, the container adds a decode step at the vendor's end and hides the
 * one parameter that actually matters. Sarvam's docs are explicit that 16 kHz is optimal and that
 * raw PCM is *restricted* to 16 kHz. Recording at exactly that removes a whole class of "it works
 * on my phone" problems.
 *
 * Why this exists at all, rather than the on-device recogniser: Android's `SpeechRecognizer`
 * returns one transcript, for one language chosen in advance, from a general-purpose model. The
 * extraction ladder in @rc097/core is built to run over **alternates**, and the entire dialect
 * argument depends on choosing the recogniser per call rather than accepting whatever Google put
 * on the handset. Capturing audio and sending it to a provider we select is what the spec always
 * described (panels 2 and 8); the on-device path is the offline fallback.
 */

export interface Capture {
  /** 16-bit PCM mono at 16 kHz, with a 44-byte RIFF header. */
  wav: Blob;
  sampleRate: number;
  durationMs: number;
  /** Peak level seen, 0..1. Near-zero means the mic produced silence — worth saying out loud. */
  peak: number;
}

export interface RecorderHandle {
  /** Finish and return the audio. */
  stop(): Promise<Capture>;
  /** Throw the audio away and release the microphone. */
  cancel(): void;
  /** Live level, 0..1, for the UI. */
  level(): number;
}

const TARGET_RATE = 16_000;

function encodeWav(samples: Int16Array, rate: number): Blob {
  const header = new ArrayBuffer(44);
  const v = new DataView(header);
  const write = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i));
  };
  const bytes = samples.length * 2;
  write(0, 'RIFF');
  v.setUint32(4, 36 + bytes, true);
  write(8, 'WAVE');
  write(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  write(36, 'data');
  v.setUint32(40, bytes, true);
  return new Blob([header, samples.buffer as ArrayBuffer], { type: 'audio/wav' });
}

/**
 * Average-and-pick downsample to 16 kHz.
 *
 * Averaging across the source window rather than taking every Nth sample: plain decimation aliases
 * high-frequency content down into the speech band, and on a noisy village recording that is
 * audible as a metallic hiss the recogniser then has to work through.
 */
function downsample(input: Float32Array, from: number, to: number): Float32Array {
  if (from === to) return input;
  const ratio = from / to;
  const out = new Float32Array(Math.floor(input.length / ratio));
  for (let i = 0; i < out.length; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(input.length, Math.floor((i + 1) * ratio));
    let sum = 0;
    for (let j = start; j < end; j++) sum += input[j];
    out[i] = end > start ? sum / (end - start) : 0;
  }
  return out;
}

export async function startRecording(): Promise<RecorderHandle> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      channelCount: 1,
      // Leave the platform's own cleanup on. On a ₹6,000 handset in a courtyard these do more good
      // than any processing we could add, and Sarvam is not expecting a studio signal.
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });

  const ctx = new (window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  const source = ctx.createMediaStreamSource(stream);

  // ponytail: ScriptProcessorNode is deprecated in favour of AudioWorklet, but it needs no separate
  // module file, works in every Android WebView we care about, and this is a 4-second capture on
  // the main thread's slack. Upgrade if capture ever moves to continuous streaming.
  const node = ctx.createScriptProcessor(4096, 1, 1);
  const chunks: Float32Array[] = [];
  let peak = 0;
  let live = 0;
  let stopped = false;

  node.onaudioprocess = (e) => {
    if (stopped) return;
    const buf = e.inputBuffer.getChannelData(0);
    const copy = new Float32Array(buf.length);
    copy.set(buf);
    chunks.push(copy);
    let localPeak = 0;
    for (let i = 0; i < copy.length; i++) {
      const a = Math.abs(copy[i]);
      if (a > localPeak) localPeak = a;
    }
    live = localPeak;
    if (localPeak > peak) peak = localPeak;
  };

  source.connect(node);
  // Destination at zero gain: ScriptProcessor only fires while connected to one, but routing the
  // microphone to the speaker mid-interview would howl.
  const mute = ctx.createGain();
  mute.gain.value = 0;
  node.connect(mute);
  mute.connect(ctx.destination);

  const release = () => {
    stopped = true;
    try {
      node.disconnect();
      source.disconnect();
      mute.disconnect();
    } catch {
      /* already torn down */
    }
    for (const track of stream.getTracks()) track.stop();
    void ctx.close().catch(() => undefined);
  };

  return {
    level: () => live,
    cancel: release,
    async stop(): Promise<Capture> {
      const rate = ctx.sampleRate;
      release();

      let total = 0;
      for (const c of chunks) total += c.length;
      const merged = new Float32Array(total);
      let at = 0;
      for (const c of chunks) {
        merged.set(c, at);
        at += c.length;
      }

      const resampled = downsample(merged, rate, TARGET_RATE);
      const pcm = new Int16Array(resampled.length);
      for (let i = 0; i < resampled.length; i++) {
        const s = Math.max(-1, Math.min(1, resampled[i]));
        pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }

      return {
        wav: encodeWav(pcm, TARGET_RATE),
        sampleRate: TARGET_RATE,
        durationMs: Math.round((resampled.length / TARGET_RATE) * 1000),
        peak,
      };
    },
  };
}

export async function blobToBase64(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  const CHUNK = 0x8000; // btoa chokes on very large apply() spreads
  for (let i = 0; i < buf.length; i += CHUNK) {
    binary += String.fromCharCode(...buf.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

export const recordingSupported = (): boolean =>
  typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia);
