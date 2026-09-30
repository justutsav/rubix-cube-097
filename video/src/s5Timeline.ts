/**
 * The evidence: where every claim in this video came from, and what we will not claim.
 *
 * Runs 200.0s -> 253.2s in the shot cut — from the frame after the government-half
 * section ends to the end of the tape. No flowchart and no app screens: the primary
 * sources carry it, which is the whole point of the section.
 */
import type { SceneCue } from './cues';

export const FPS_S5 = 30;
export const S5_START_ABS = 200.0;
export const S5_DURATION_S = 53.2;
export const S5_FRAMES = Math.round(S5_DURATION_S * FPS_S5);

export const at5 = (abs: number) => Math.round((abs - S5_START_ABS) * FPS_S5);

export type Cap5 = { abs: number; end: number; text: string };

/**
 * Read off the burned-in captions, at 4 fps wherever the 1 fps pass showed a gap —
 * which is how "always be correct", "wrong." and "Thank you." were recovered.
 *
 * One word is restored against the burned-in caption: the auto-caption hears
 * **"the NSQF gadget"**. The word is **gazette** — the June 2023 NSQF notification,
 * which is on screen at that moment. Nothing else is changed; the delivered grammar
 * stands as delivered.
 */
export const CAPTIONS_S5: Cap5[] = [
  { abs: 200.0, end: 201.9, text: "We didn't invented this." },
  { abs: 202.0, end: 203.9, text: 'We found it from different' },
  { abs: 204.0, end: 205.8, text: 'sources like the CAG audit,' },
  { abs: 206.0, end: 207.3, text: 'the NSQF gazette,' },
  { abs: 207.5, end: 208.8, text: 'the PM-AJAY guidelines,' },
  { abs: 209.0, end: 210.9, text: 'and the National Qualification Report.' },
  { abs: 211.0, end: 212.9, text: 'Even the best deployed' },
  { abs: 212.9, end: 215.9, text: 'model for Bhojpuri can get three out of ten' },
  { abs: 215.9, end: 216.8, text: 'words wrong.' },
  { abs: 216.9, end: 218.9, text: 'And for Rajasthani, it can get four out of ten words wrong.' },
  { abs: 219.0, end: 221.7, text: 'So instead of assuming that our transcript will' },
  { abs: 221.7, end: 222.6, text: 'always be correct,' },
  { abs: 222.7, end: 224.2, text: 'we have designed a system' },
  { abs: 224.2, end: 224.9, text: 'that will accept the' },
  { abs: 225.0, end: 226.7, text: 'transcript even it is inputted' },
  { abs: 226.7, end: 227.0, text: 'wrong.' },
  { abs: 227.2, end: 228.9, text: 'So here, we are just not' },
  { abs: 228.9, end: 229.9, text: 'showing our accuracy.' },
  { abs: 229.9, end: 230.9, text: 'We are showing also our' },
  { abs: 230.9, end: 231.6, text: 'error rate.' },
  { abs: 231.7, end: 234.6, text: 'The PM-AJAY scheme wants us' },
  { abs: 234.6, end: 236.3, text: 'to understand the skill' },
  { abs: 236.3, end: 237.6, text: 'and the interest of the SC beneficiaries.' },
  { abs: 237.6, end: 239.3, text: 'For the last few years,' },
  { abs: 239.3, end: 240.6, text: 'it was being handled with the traditional' },
  { abs: 240.6, end: 242.3, text: 'ways like advertisement' },
  { abs: 242.3, end: 243.4, text: 'and other manual processes.' },
  { abs: 243.4, end: 246.3, text: 'We turn that requirement into a working process.' },
  { abs: 246.3, end: 248.3, text: 'She speaks, we understand,' },
  { abs: 248.3, end: 249.3, text: 'we analyze,' },
  { abs: 249.3, end: 250.3, text: 'and we guide the people.' },
  { abs: 250.7, end: 251.5, text: 'This is our approach.' },
  { abs: 251.7, end: 252.2, text: 'Thank you.' },
  { abs: 252.2, end: 253.0, text: 'Team Rubix Cube.' },
];

export type S5Scene = { id: string; fromAbs: number; toAbs: number };

export const S5_SCENES: S5Scene[] = [
  { id: 'sources',   fromAbs: 200.0, toAbs: 211.0 },
  { id: 'dialects',  fromAbs: 211.0, toAbs: 219.0 },
  { id: 'design',    fromAbs: 219.0, toAbs: 227.0 },
  { id: 'errorrate', fromAbs: 227.0, toAbs: 231.6 },
  { id: 'scheme',    fromAbs: 231.6, toAbs: 237.6 },
  { id: 'advert',    fromAbs: 237.6, toAbs: 243.4 },
  { id: 'process',   fromAbs: 243.4, toAbs: 250.5 },
  { id: 'close',     fromAbs: 250.5, toAbs: 253.2 },
];

/** ARTPARK-IISc SraVaani-1.0 model card — avg WER. Speaker counts: Census 2011, non-scheduled. */
export const DIALECTS = [
  { name: 'Bhojpuri', wer: 27.8, speakers: '5.05 crore', spoken: true },
  { name: 'Magahi', wer: 30.4, speakers: '1.27 crore', spoken: false },
  { name: 'Chhattisgarhi', wer: 27.4, speakers: '1.62 crore', spoken: false },
  { name: 'Rajasthani', wer: 41.8, speakers: '2.58 crore', spoken: true },
];

/** docs/Prashant/ivr/05-measurements.md — Vosk small Hindi, 38 synthetic answers, 2026-09-26. */
export const LINE_RUNS = [
  { line: 'clean', wer: 2, ok: 100 },
  { line: 'phone', wer: 3, ok: 97 },
  { line: 'phone + noise 10 dB', wer: 25, ok: 82 },
  { line: 'phone + noise + packet loss', wer: 36, ok: 68 },
];

/** Anchored to the `show(t, …)` offsets in S5Scenes.tsx. */
export const CUES_S5: SceneCue[] = [
  { scene: 'sources',   rel: 0.20, file: 'whoosh.wav',    volume: 0.26 },
  { scene: 'sources',   rel: 4.05, file: 'slide.wav',     volume: 0.30 },
  { scene: 'sources',   rel: 6.05, file: 'slide.wav',     volume: 0.30 },
  { scene: 'sources',   rel: 7.55, file: 'slide.wav',     volume: 0.30 },
  { scene: 'sources',   rel: 9.05, file: 'slide.wav',     volume: 0.30 },

  { scene: 'dialects',  rel: 0.20, file: 'whoosh_lo.wav', volume: 0.26 },
  { scene: 'dialects',  rel: 1.30, file: 'tick.wav',      volume: 0.24 },
  { scene: 'dialects',  rel: 1.60, file: 'tick.wav',      volume: 0.24 },
  { scene: 'dialects',  rel: 1.90, file: 'tick.wav',      volume: 0.24 },
  { scene: 'dialects',  rel: 2.20, file: 'tick.wav',      volume: 0.24 },
  { scene: 'dialects',  rel: 5.90, file: 'pop.wav',       volume: 0.28 },

  { scene: 'design',    rel: 0.20, file: 'whoosh.wav',    volume: 0.26 },
  { scene: 'design',    rel: 2.90, file: 'click.wav',     volume: 0.24 },
  { scene: 'design',    rel: 3.90, file: 'drag.wav',      volume: 0.24 },
  { scene: 'design',    rel: 5.20, file: 'confirm.wav',   volume: 0.24 },

  { scene: 'errorrate', rel: 0.20, file: 'slide.wav',     volume: 0.30 },
  { scene: 'errorrate', rel: 1.60, file: 'tick.wav',      volume: 0.24 },
  { scene: 'errorrate', rel: 2.90, file: 'chime.wav',     volume: 0.22 },

  { scene: 'scheme',    rel: 0.20, file: 'whoosh.wav',    volume: 0.26 },
  { scene: 'scheme',    rel: 2.30, file: 'drag.wav',      volume: 0.24 },

  { scene: 'advert',    rel: 0.20, file: 'drag.wav',      volume: 0.24 },
  { scene: 'advert',    rel: 3.10, file: 'pop.wav',       volume: 0.26 },

  { scene: 'process',   rel: 0.20, file: 'whoosh.wav',    volume: 0.26 },
  { scene: 'process',   rel: 2.90, file: 'pop.wav',       volume: 0.26 },
  { scene: 'process',   rel: 3.70, file: 'pop.wav',       volume: 0.26 },
  { scene: 'process',   rel: 4.50, file: 'pop.wav',       volume: 0.26 },
  { scene: 'process',   rel: 5.30, file: 'confirm.wav',   volume: 0.26 },

  { scene: 'close',     rel: 0.25, file: 'chime.wav',     volume: 0.30 },
];
