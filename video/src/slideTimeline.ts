/**
 * The sliding cut.
 *
 * The first cut zoomed the chart out to full frame between every beat, which meant
 * eight zoom-ins and eight zoom-outs. This one zooms **once** at the top, onto the
 * SC Beneficiary, and from then on the camera slides across the chart from section
 * to section, blurring slightly while it travels, the way an eye tracks across a
 * diagram. It pulls back once at the very end.
 *
 * It also adds a beat the narration does not call out: straight after the
 * beneficiary, it rests on the three doorways so the viewer sees the shape of the
 * thing before any of it is explained.
 */
import { CUES, type Cue, type Rect } from './timeline';

/**
 * Camera rects in flowchart.png space (1521x927). Widths are kept deliberately
 * close together from one stop to the next: a slide reads as a slide only if the
 * zoom level barely changes across it.
 */
export const SLIDE_FOCUS: Record<string, Rect> = {
  whole:       { x: 0,    y: 0,   w: 1521, h: 927 },
  beneficiary: { x: 100,  y: 20,  w: 660,  h: 300 },
  doors:       { x: 30,   y: 175, w: 800,  h: 290 },
  speech:      { x: 10,   y: 600, w: 560,  h: 300 },
  interview:   { x: 270,  y: 640, w: 560,  h: 290 },
  eligibility: { x: 270,  y: 690, w: 560,  h: 290 },
  recommend:   { x: 900,  y: 690, w: 560,  h: 250 },
  roadmap:     { x: 1110, y: 690, w: 410,  h: 250 },
  converge:    { x: 20,   y: 140, w: 1050, h: 780 },
};

export type SlideScene = {
  id: string;
  chip: string;
  fromAbs: number;
  toAbs: number;
  /** where the camera parks */
  focus: keyof typeof SLIDE_FOCUS;
  /** the tight node the ring draws around, from the shared FOCUS map */
  node: string | null;
};

/**
 * Same narration, one extra stop. `doors` borrows the 2.4s where the speaker is
 * finishing "…with our solution" — nothing is said over it, so the chart gets to
 * talk instead.
 */
export const SLIDE_SCENES: SlideScene[] = [
  { id: 'intro',     chip: 'SC Beneficiary',          fromAbs: 95.5,  toAbs: 99.6,  focus: 'beneficiary', node: 'beneficiary' },
  { id: 'doors',     chip: 'Three ways in',           fromAbs: 99.6,  toAbs: 102.0, focus: 'doors', node: 'threeDoors' },
  { id: 'voice',     chip: 'Speech Detection',        fromAbs: 102.0, toAbs: 109.0, focus: 'speech', node: 'speech' },
  { id: 'interview', chip: 'Voice Based Interview',   fromAbs: 109.0, toAbs: 118.0, focus: 'interview', node: 'interview' },
  { id: 'engine',    chip: 'Skill Eligibility Check', fromAbs: 118.0, toAbs: 129.0, focus: 'eligibility', node: 'eligibility' },
  { id: 'nsqf',      chip: 'Recommendation Given',    fromAbs: 129.0, toAbs: 133.0, focus: 'recommend', node: 'recommend' },
  { id: 'plan',      chip: 'Roadmap Provided',        fromAbs: 133.0, toAbs: 141.0, focus: 'roadmap', node: 'roadmap' },
  { id: 'channels',  chip: 'Three Doors, One Engine', fromAbs: 141.0, toAbs: 150.0, focus: 'doors', node: 'threeDoors' },
  { id: 'close',     chip: 'One System. One Record.', fromAbs: 150.0, toAbs: 152.9, focus: 'converge', node: null },
];

/** seconds of travel between one stop and the next */
export const SLIDE_DUR = 0.85;
/** the opening zoom, whole chart -> the beneficiary */
export const OPEN_ZOOM = 1.15;

/** Chart card and panel both stay put for the whole cut; only the camera moves. */
export const SLIDE_CHART = { x: 48, y: 170, w: 880, h: 620 };
export const SLIDE_PANEL = { x: 968, y: 148, w: 904, h: 784 };


import type { SceneCue } from './cues';

/** Anchored to the panel animations and to the travel windows, not to guesses. */
export const SLIDE_CUES: SceneCue[] = [
  { scene: 'intro',     rel: 0.25, file: 'whoosh.wav',    volume: 0.30 },
  { scene: 'intro',     rel: 1.38, file: 'pop.wav',       volume: 0.32 },
  { scene: 'intro',     rel: 1.73, file: 'tick.wav',      volume: 0.26 },
  { scene: 'intro',     rel: 2.23, file: 'tick.wav',      volume: 0.26 },
  { scene: 'intro',     rel: 2.51, file: 'tick.wav',      volume: 0.26 },
  { scene: 'intro',     rel: 2.79, file: 'tick.wav',      volume: 0.26 },
  { scene: 'intro',     rel: 3.25, file: 'slide.wav',     volume: 0.32 },

  { scene: 'doors',     rel: 0.28, file: 'pop.wav',       volume: 0.32 },
  { scene: 'doors',     rel: 0.50, file: 'pop.wav',       volume: 0.32 },
  { scene: 'doors',     rel: 0.72, file: 'pop.wav',       volume: 0.32 },
  { scene: 'doors',     rel: 1.18, file: 'chime.wav',     volume: 0.24 },
  { scene: 'doors',     rel: 1.55, file: 'slide.wav',     volume: 0.32 },

  { scene: 'voice',     rel: 0.68, file: 'drag.wav',      volume: 0.28 },
  { scene: 'voice',     rel: 1.68, file: 'whoosh.wav',    volume: 0.28 },
  { scene: 'voice',     rel: 6.15, file: 'slide.wav',     volume: 0.32 },

  { scene: 'interview', rel: 0.58, file: 'tick.wav',      volume: 0.28 },
  { scene: 'interview', rel: 1.83, file: 'chime.wav',     volume: 0.22 },
  { scene: 'interview', rel: 2.33, file: 'tick.wav',      volume: 0.28 },
  { scene: 'interview', rel: 4.08, file: 'tick.wav',      volume: 0.28 },
  { scene: 'interview', rel: 5.83, file: 'tick.wav',      volume: 0.28 },
  { scene: 'interview', rel: 8.15, file: 'slide.wav',     volume: 0.32 },

  { scene: 'engine',    rel: 0.68, file: 'click.wav',     volume: 0.26 },
  { scene: 'engine',    rel: 1.98, file: 'click.wav',     volume: 0.26 },
  { scene: 'engine',    rel: 3.18, file: 'click.wav',     volume: 0.26 },
  { scene: 'engine',    rel: 4.48, file: 'click.wav',     volume: 0.26 },
  { scene: 'engine',    rel: 6.08, file: 'chime.wav',     volume: 0.28 },
  { scene: 'engine',    rel: 10.15, file: 'slide.wav',    volume: 0.32 },

  { scene: 'nsqf',      rel: 0.43, file: 'pop.wav',       volume: 0.32 },
  { scene: 'nsqf',      rel: 0.88, file: 'pop.wav',       volume: 0.32 },
  { scene: 'nsqf',      rel: 1.33, file: 'pop.wav',       volume: 0.32 },
  { scene: 'nsqf',      rel: 3.15, file: 'slide.wav',     volume: 0.32 },

  { scene: 'plan',      rel: 0.48, file: 'pop.wav',       volume: 0.32 },
  { scene: 'plan',      rel: 1.28, file: 'pop.wav',       volume: 0.32 },
  { scene: 'plan',      rel: 2.08, file: 'pop.wav',       volume: 0.32 },
  { scene: 'plan',      rel: 2.88, file: 'pop.wav',       volume: 0.32 },
  { scene: 'plan',      rel: 7.15, file: 'slide.wav',     volume: 0.32 },

  { scene: 'channels',  rel: 0.38, file: 'slide.wav',     volume: 0.30 },
  { scene: 'channels',  rel: 1.48, file: 'slide.wav',     volume: 0.30 },
  { scene: 'channels',  rel: 2.58, file: 'slide.wav',     volume: 0.30 },
  { scene: 'channels',  rel: 2.68, file: 'keypad.wav',    volume: 0.22 },
  { scene: 'channels',  rel: 8.15, file: 'whoosh_lo.wav', volume: 0.32 },

  { scene: 'close',     rel: 0.20, file: 'whoosh_lo.wav', volume: 0.30 },
  { scene: 'close',     rel: 1.10, file: 'confirm.wav',   volume: 0.30 },
];
