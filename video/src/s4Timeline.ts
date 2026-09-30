/**
 * The government half: what the officers get out of the same conversations.
 *
 * Runs 152.9s -> 200.0s in the shot cut — from the frame after the three-doors
 * section ends to the frame before the evidence section starts. No flowchart:
 * the real district and state consoles carry it.
 */
import type { SceneCue } from './cues';

export const FPS_S4 = 30;
export const S4_START_ABS = 152.9;
export const S4_DURATION_S = 47.1;
export const S4_FRAMES = Math.round(S4_DURATION_S * FPS_S4);

export const at4 = (abs: number) => Math.round((abs - S4_START_ABS) * FPS_S4);

export type Cap4 = { abs: number; end: number; text: string };

/** Read off the burned-in captions a second at a time. */
export const CAPTIONS_S4: Cap4[] = [
  { abs: 153.0, end: 156.4, text: 'The problem statement also highlights planning,' },
  { abs: 157.0, end: 159.4, text: 'and placement issues under…' },
  { abs: 160.0, end: 162.9, text: 'So the information collected from the beneficiaries' },
  { abs: 163.0, end: 164.6, text: '…the implementation side.' },
  { abs: 165.0, end: 168.4, text: 'If many beneficiary in a district are interested,' },
  { abs: 169.0, end: 171.4, text: 'the demand become visible to' },
  { abs: 172.0, end: 173.9, text: 'the district team can use it for planning project.' },
  { abs: 174.0, end: 176.9, text: 'And state can use it for preparing perspective plan.' },
  { abs: 177.0, end: 179.9, text: "System also follows the scheme's planning timeline." },
  { abs: 180.0, end: 183.4, text: 'District in the first week, the state by the fifteenth,' },
  { abs: 184.0, end: 185.9, text: 'and the ministry by the twenty-first.' },
  { abs: 186.0, end: 189.6, text: 'After training, we want to ask one simple question: did you get the work?' },
  { abs: 190.0, end: 193.4, text: 'That outcome can help us improve our future recommendations.' },
  { abs: 194.0, end: 195.6, text: 'The beneficiary side is built.' },
  { abs: 196.0, end: 197.9, text: 'The state and district consoles are built.' },
  { abs: 198.0, end: 200.0, text: 'The follow-up call is what we built next.' },
];

export type S4Scene = { id: string; fromAbs: number; toAbs: number };

export const S4_SCENES: S4Scene[] = [
  { id: 'problem',  fromAbs: 152.9, toAbs: 160.0 },
  { id: 'collect',  fromAbs: 160.0, toAbs: 165.0 },
  { id: 'demand',   fromAbs: 165.0, toAbs: 172.0 },
  { id: 'district', fromAbs: 172.0, toAbs: 174.0 },
  { id: 'state',    fromAbs: 174.0, toAbs: 177.0 },
  { id: 'timeline', fromAbs: 177.0, toAbs: 186.0 },
  { id: 'outcome',  fromAbs: 186.0, toAbs: 194.0 },
  { id: 'built',    fromAbs: 194.0, toAbs: 200.0 },
];

/** Anchored to the `show(t, …)` offsets in S4Scenes.tsx. */
export const CUES_S4: SceneCue[] = [
  { scene: 'problem',  rel: 0.20, file: 'whoosh.wav',    volume: 0.30 },
  { scene: 'problem',  rel: 1.60, file: 'pop.wav',       volume: 0.32 },
  { scene: 'problem',  rel: 2.10, file: 'pop.wav',       volume: 0.32 },
  { scene: 'problem',  rel: 4.20, file: 'drag.wav',      volume: 0.26 },

  { scene: 'collect',  rel: 0.20, file: 'slide.wav',     volume: 0.32 },
  { scene: 'collect',  rel: 0.90, file: 'tick.wav',      volume: 0.28 },
  { scene: 'collect',  rel: 1.20, file: 'tick.wav',      volume: 0.28 },
  { scene: 'collect',  rel: 1.50, file: 'tick.wav',      volume: 0.28 },
  { scene: 'collect',  rel: 2.30, file: 'chime.wav',     volume: 0.24 },

  { scene: 'demand',   rel: 0.20, file: 'whoosh.wav',    volume: 0.28 },
  { scene: 'demand',   rel: 1.30, file: 'drag.wav',      volume: 0.26 },
  { scene: 'demand',   rel: 2.60, file: 'confirm.wav',   volume: 0.24 },

  { scene: 'district', rel: 0.15, file: 'slide.wav',     volume: 0.34 },
  { scene: 'state',    rel: 0.15, file: 'slide.wav',     volume: 0.34 },

  { scene: 'timeline', rel: 0.20, file: 'whoosh.wav',    volume: 0.28 },
  { scene: 'timeline', rel: 2.90, file: 'pop.wav',       volume: 0.32 },
  { scene: 'timeline', rel: 4.30, file: 'pop.wav',       volume: 0.32 },
  { scene: 'timeline', rel: 5.70, file: 'pop.wav',       volume: 0.32 },
  { scene: 'timeline', rel: 6.60, file: 'chime.wav',     volume: 0.24 },

  { scene: 'outcome',  rel: 0.20, file: 'ring.wav',      volume: 0.16 },
  { scene: 'outcome',  rel: 1.60, file: 'click.wav',     volume: 0.26 },
  { scene: 'outcome',  rel: 3.30, file: 'slide.wav',     volume: 0.30 },
  { scene: 'outcome',  rel: 5.20, file: 'whoosh_lo.wav', volume: 0.28 },

  { scene: 'built',    rel: 0.30, file: 'confirm.wav',   volume: 0.26 },
  { scene: 'built',    rel: 1.70, file: 'confirm.wav',   volume: 0.26 },
  { scene: 'built',    rel: 3.10, file: 'chime.wav',     volume: 0.30 },
];
