/**
 * The earlier section: what the system offers, and what it does with what it hears.
 *
 * Runs 47.6s -> 95.5s in the shot cut, ending on the frame the three-doors video
 * begins, so the two play back to back. No flowchart in this one — every point is
 * carried by the animation.
 *
 * Caption text is read off the burned-in captions one second at a time. Three words
 * were spoken during caption gaps and are reconstructed from context: "do" (75s),
 * "profile" (73s) and "improve" (84s). They are marked in the source below.
 */

export const FPS_S2 = 30;
export const S2_START_ABS = 47.6;
export const S2_DURATION_S = 47.88;
export const S2_FRAMES = Math.round(S2_DURATION_S * FPS_S2);

export const at2 = (abs: number) => Math.round((abs - S2_START_ABS) * FPS_S2);

export type Cap = { abs: number; end: number; text: string };

export const CAPTIONS_S2: Cap[] = [
  { abs: 47.6, end: 48.9, text: 'We want them to have a conversation.' },
  { abs: 49.0, end: 51.9, text: 'We are providing them with three major services.' },
  { abs: 52.0, end: 55.4, text: 'The first one, an IVR voice call. The second,' },
  { abs: 56.0, end: 58.4, text: 'a WhatsApp voice note. And the third one,' },
  { abs: 59.0, end: 61.9, text: 'which is a kiosk-based light mobile application.' },
  { abs: 62.0, end: 65.4, text: 'The SC beneficiary tells us about their…' },
  { abs: 66.0, end: 67.9, text: '…their work, their interests, their preferences.' },
  { abs: 68.0, end: 70.9, text: 'And our AI analyzes those information' },
  { abs: 71.0, end: 73.4, text: '…and turns them into their profile.' },       // "profile" reconstructed
  { abs: 74.0, end: 76.4, text: 'Then the system checks what they can actually do.' }, // "do" reconstructed
  { abs: 77.0, end: 78.9, text: 'What skill gaps do they actually have.' },
  { abs: 79.0, end: 81.9, text: 'And which training program they can pursue,' },
  { abs: 82.0, end: 84.4, text: 'so that their livelihoods can improve.' },     // "improve" reconstructed
  { abs: 85.0, end: 87.9, text: 'Finally, the system gives them a clear roadmap to follow.' },
  { abs: 88.0, end: 91.9, text: 'Hence, they speak, system understands, and it guides them.' },
  { abs: 93.0, end: 95.4, text: "Now let's see how the system works with the three doorways." },
];

export type S2Scene = { id: string; fromAbs: number; toAbs: number };

export const S2_SCENES: S2Scene[] = [
  { id: 'hook',     fromAbs: 47.6, toAbs: 52.0 },
  { id: 'svc1',     fromAbs: 52.0, toAbs: 56.0 },
  { id: 'svc2',     fromAbs: 56.0, toAbs: 59.0 },
  { id: 'svc3',     fromAbs: 59.0, toAbs: 62.0 },
  { id: 'tells',    fromAbs: 62.0, toAbs: 68.0 },
  { id: 'ai',       fromAbs: 68.0, toAbs: 74.0 },
  { id: 'checks',   fromAbs: 74.0, toAbs: 79.0 },
  { id: 'training', fromAbs: 79.0, toAbs: 85.0 },
  { id: 'roadmap',  fromAbs: 85.0, toAbs: 88.0 },
  { id: 'close',    fromAbs: 88.0, toAbs: 92.6 },
  { id: 'handoff',  fromAbs: 92.6, toAbs: 95.5 },
];

import type { SceneCue } from './cues';

/**
 * Each cue names the scene and the moment *inside* it that it marks, matching the
 * `show(t, …)` offsets in S2Scenes.tsx. Placement compensation for each file's
 * attack is applied at render time by resolveCues().
 */
export const CUES_S2: SceneCue[] = [
  { scene: 'hook',     rel: 0.30, file: 'drag.wav',      volume: 0.30 },
  { scene: 'hook',     rel: 1.10, file: 'whoosh.wav',    volume: 0.34 },
  { scene: 'hook',     rel: 2.00, file: 'pop.wav',       volume: 0.34 },
  { scene: 'hook',     rel: 2.32, file: 'pop.wav',       volume: 0.34 },
  { scene: 'hook',     rel: 2.64, file: 'pop.wav',       volume: 0.34 },

  { scene: 'svc1',     rel: 0.10, file: 'slide.wav',     volume: 0.34 },
  { scene: 'svc1',     rel: 0.35, file: 'ring.wav',      volume: 0.16 },
  { scene: 'svc1',     rel: 0.60, file: 'tick.wav',      volume: 0.30 },
  { scene: 'svc1',     rel: 0.90, file: 'tick.wav',      volume: 0.30 },
  { scene: 'svc1',     rel: 1.20, file: 'tick.wav',      volume: 0.30 },

  { scene: 'svc2',     rel: 0.10, file: 'slide.wav',     volume: 0.34 },
  { scene: 'svc2',     rel: 0.55, file: 'send.wav',      volume: 0.26 },
  { scene: 'svc2',     rel: 0.60, file: 'tick.wav',      volume: 0.30 },
  { scene: 'svc2',     rel: 0.90, file: 'tick.wav',      volume: 0.30 },
  { scene: 'svc2',     rel: 1.20, file: 'tick.wav',      volume: 0.30 },

  { scene: 'svc3',     rel: 0.10, file: 'slide.wav',     volume: 0.34 },
  { scene: 'svc3',     rel: 0.60, file: 'tick.wav',      volume: 0.30 },
  { scene: 'svc3',     rel: 0.90, file: 'tick.wav',      volume: 0.30 },
  { scene: 'svc3',     rel: 1.20, file: 'tick.wav',      volume: 0.30 },
  { scene: 'svc3',     rel: 1.60, file: 'click.wav',     volume: 0.24 },

  { scene: 'tells',    rel: 0.25, file: 'whoosh.wav',    volume: 0.30 },
  { scene: 'tells',    rel: 1.10, file: 'pop.wav',       volume: 0.34 },
  { scene: 'tells',    rel: 1.60, file: 'pop.wav',       volume: 0.34 },
  { scene: 'tells',    rel: 2.10, file: 'pop.wav',       volume: 0.34 },

  { scene: 'ai',       rel: 0.30, file: 'drag.wav',      volume: 0.30 },
  { scene: 'ai',       rel: 2.40, file: 'chime.wav',     volume: 0.28 },
  { scene: 'ai',       rel: 2.70, file: 'tick.wav',      volume: 0.24 },
  { scene: 'ai',       rel: 2.92, file: 'tick.wav',      volume: 0.24 },
  { scene: 'ai',       rel: 3.14, file: 'tick.wav',      volume: 0.24 },
  { scene: 'ai',       rel: 3.36, file: 'tick.wav',      volume: 0.24 },

  { scene: 'checks',   rel: 0.80, file: 'slide.wav',     volume: 0.32 },
  { scene: 'checks',   rel: 1.10, file: 'click.wav',     volume: 0.26 },
  { scene: 'checks',   rel: 1.38, file: 'click.wav',     volume: 0.26 },
  { scene: 'checks',   rel: 1.50, file: 'slide.wav',     volume: 0.32 },
  { scene: 'checks',   rel: 1.66, file: 'click.wav',     volume: 0.26 },
  { scene: 'checks',   rel: 2.10, file: 'chime.wav',     volume: 0.26 },

  { scene: 'training', rel: 0.15, file: 'slide.wav',     volume: 0.32 },
  { scene: 'training', rel: 0.60, file: 'tick.wav',      volume: 0.28 },
  { scene: 'training', rel: 0.82, file: 'tick.wav',      volume: 0.28 },
  { scene: 'training', rel: 1.04, file: 'tick.wav',      volume: 0.28 },
  { scene: 'training', rel: 1.26, file: 'tick.wav',      volume: 0.28 },
  { scene: 'training', rel: 1.60, file: 'whoosh.wav',    volume: 0.28 },

  { scene: 'roadmap',  rel: 0.15, file: 'whoosh.wav',    volume: 0.30 },
  { scene: 'roadmap',  rel: 0.55, file: 'pop.wav',       volume: 0.32 },
  { scene: 'roadmap',  rel: 0.85, file: 'pop.wav',       volume: 0.32 },
  { scene: 'roadmap',  rel: 1.15, file: 'pop.wav',       volume: 0.32 },
  { scene: 'roadmap',  rel: 1.45, file: 'pop.wav',       volume: 0.32 },

  { scene: 'close',    rel: 0.35, file: 'confirm.wav',   volume: 0.26 },
  { scene: 'close',    rel: 1.40, file: 'confirm.wav',   volume: 0.26 },
  { scene: 'close',    rel: 2.45, file: 'chime.wav',     volume: 0.30 },

  { scene: 'handoff',  rel: 0.10, file: 'whoosh.wav',    volume: 0.30 },
  { scene: 'handoff',  rel: 0.50, file: 'pop.wav',       volume: 0.32 },
  { scene: 'handoff',  rel: 0.78, file: 'pop.wav',       volume: 0.32 },
  { scene: 'handoff',  rel: 1.06, file: 'pop.wav',       volume: 0.32 },
];
