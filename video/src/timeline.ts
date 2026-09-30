/**
 * Speaker 3's section, transcribed off the burned-in captions of the cut we shot
 * (WhatsApp Video 2026-09-29 at 5.51.14 AM.mp4) and timed against it.
 *
 * Section 3 runs 95.5s -> 152.9s in that file. Everything here is relative to
 * 95.5s, which is frame 0 of this video, so `abs` below is only a paper trail
 * back to the source. Caption text is what the frame actually said: where the
 * speaker deviated from the written script, the frame wins.
 */

export const FPS = 30;
export const NARRATION_START_ABS = 95.5;
export const DURATION_S = 57.377;
export const DURATION_FRAMES = Math.round(DURATION_S * FPS); // 1721

/** absolute second in the source cut -> frame in this composition */
export const at = (abs: number) => Math.round((abs - NARRATION_START_ABS) * FPS);

export type Caption = { abs: number; end: number; text: string };

/** Read off the frames one second at a time; phrase breaks are where captions cleared. */
export const CAPTIONS: Caption[] = [
  { abs: 96.0, end: 97.9, text: 'To understand our solution better.' },
  { abs: 98.0, end: 100.2, text: "Let's take an example of an SC beneficiary, Sunita." },
  { abs: 100.6, end: 101.9, text: 'With our solution.' },
  { abs: 102.0, end: 106.9, text: 'Sunita does not have to fill forms, as she can simply answer through voice.' },
  { abs: 107.0, end: 108.9, text: 'In her regional language.' },
  { abs: 109.0, end: 114.4, text: 'Our system asks her a list of questions regarding her education, preferences, skills…' },
  { abs: 115.0, end: 117.9, text: '…to which she can answer in her regional language, naturally.' },
  { abs: 118.0, end: 119.9, text: 'Now comes the important part.' },
  { abs: 120.0, end: 122.9, text: 'Our system does not only suggest her course.' },
  { abs: 123.0, end: 125.9, text: 'It also checks the requirement analysis.' },
  { abs: 126.0, end: 128.6, text: 'And tells her whether she is eligible or not.' },
  { abs: 129.0, end: 132.9, text: 'It then maps her to NSQF-aligned livelihood opportunities and pathways.' },
  { abs: 133.0, end: 136.9, text: 'And finally, in the clear next steps, she receives training details.' },
  { abs: 137.0, end: 138.9, text: 'Identifies the skill gaps and suitable trades.' },
  { abs: 139.0, end: 140.9, text: 'And livelihood opportunities.' },
  { abs: 141.0, end: 145.9, text: 'And she can access our system through three channels — that is, IVR calls,' },
  { abs: 146.0, end: 149.4, text: 'WhatsApp voice notes, or a kiosk and a mobile-based solution.' },
  { abs: 150.0, end: 151.9, text: 'Three channels, one system.' },
  { abs: 152.0, end: 152.9, text: 'And no complicated forms.' },
];

/**
 * Focus rectangles in flowchart.png pixel space (the image is 1521x927).
 * Measured off the chart Utsav drew; the rail pans between these.
 */
export type Rect = { x: number; y: number; w: number; h: number };
export const FOCUS: Record<string, Rect> = {
  whole:        { x: 0,    y: 0,   w: 1521, h: 927 },
  beneficiary:  { x: 325,  y: 50,  w: 200,  h: 128 },
  threeDoors:   { x: 55,   y: 190, w: 730,  h: 92  },
  bridges:      { x: 18,   y: 405, w: 810,  h: 115 },
  speech:       { x: 18,   y: 636, w: 264,  h: 116 },
  server:       { x: 280,  y: 585, w: 240,  h: 50  },
  engine:       { x: 280,  y: 638, w: 442,  h: 250 },
  interview:    { x: 288,  y: 678, w: 432,  h: 74  },
  eligibility:  { x: 288,  y: 748, w: 432,  h: 60  },
  recommend:    { x: 968,  y: 772, w: 388,  h: 112 },
  roadmap:      { x: 1378, y: 768, w: 104,  h: 104 },
  database:     { x: 895,  y: 648, w: 92,   h: 72  },
  converge:     { x: 15,   y: 190, w: 960,  h: 700 },
};

/** One scene per beat. `focus` is what the flowchart rail holds during it. */
export type Scene = {
  id: string;
  /** flowchart label shown big when we cut back to the chart */
  chip: string;
  fromAbs: number;
  toAbs: number;
  focus: keyof typeof FOCUS;
  /** seconds of full-frame flowchart before the detail panel takes over */
  chartBeat: number;
};

export const SCENES: Scene[] = [
  { id: 'intro',    chip: 'SC Beneficiary',              fromAbs: 95.5,  toAbs: 102.0, focus: 'beneficiary', chartBeat: 1.4 },
  { id: 'voice',    chip: 'No forms — voice only',       fromAbs: 102.0, toAbs: 109.0, focus: 'speech',      chartBeat: 0.9 },
  { id: 'interview',chip: 'Voice Based Interview',       fromAbs: 109.0, toAbs: 118.0, focus: 'interview',   chartBeat: 1.0 },
  { id: 'engine',   chip: 'Skill Eligibility Check',     fromAbs: 118.0, toAbs: 129.0, focus: 'eligibility', chartBeat: 1.1 },
  { id: 'nsqf',     chip: 'Recommendation Given',        fromAbs: 129.0, toAbs: 133.0, focus: 'recommend',   chartBeat: 0.35 },
  { id: 'plan',     chip: 'Roadmap Provided',            fromAbs: 133.0, toAbs: 141.0, focus: 'roadmap',     chartBeat: 0.9 },
  { id: 'channels', chip: 'Three Doors, One Engine',     fromAbs: 141.0, toAbs: 150.0, focus: 'threeDoors',  chartBeat: 1.0 },
  { id: 'close',    chip: 'One System. One Record.',     fromAbs: 150.0, toAbs: 152.9, focus: 'converge',    chartBeat: 0.0 },
];

/** Sound effects, placed on absolute source seconds so they land with the voice. */
export type Cue = { abs: number; file: string; volume?: number };
export const CUES: Cue[] = [
  { abs: 96.0,  file: 'transition.wav', volume: 0.35 },
  { abs: 99.2,  file: 'pop.wav',        volume: 0.5 },
  { abs: 102.2, file: 'whoosh_big.wav', volume: 0.4 },
  { abs: 104.6, file: 'swipe.wav',      volume: 0.35 },
  { abs: 106.2, file: 'pop.wav',        volume: 0.45 },
  { abs: 109.2, file: 'ring.wav',       volume: 0.3 },
  { abs: 110.6, file: 'tap.wav',        volume: 0.45 },
  { abs: 112.4, file: 'tap.wav',        volume: 0.45 },
  { abs: 114.2, file: 'tap.wav',        volume: 0.45 },
  { abs: 116.0, file: 'ding_soft.wav',  volume: 0.4 },
  { abs: 119.4, file: 'swipe.wav',      volume: 0.35 },
  { abs: 121.2, file: 'click.wav',      volume: 0.45 },
  { abs: 123.4, file: 'click.wav',      volume: 0.45 },
  { abs: 125.6, file: 'click.wav',      volume: 0.45 },
  { abs: 127.6, file: 'ding.wav',       volume: 0.45 },
  { abs: 130.2, file: 'swipe.wav',      volume: 0.35 },
  { abs: 131.4, file: 'pop.wav',        volume: 0.4 },
  { abs: 134.2, file: 'swipe.wav',      volume: 0.4 },
  { abs: 135.6, file: 'pop.wav',        volume: 0.4 },
  { abs: 137.2, file: 'pop.wav',        volume: 0.4 },
  { abs: 139.2, file: 'pop.wav',        volume: 0.4 },
  { abs: 142.2, file: 'swipe.wav',      volume: 0.4 },
  { abs: 143.6, file: 'keypad.wav',     volume: 0.35 },
  { abs: 145.0, file: 'swipe.wav',      volume: 0.4 },
  { abs: 146.4, file: 'voice_note.wav', volume: 0.45 },
  { abs: 147.4, file: 'notify.wav',     volume: 0.4 },
  { abs: 148.0, file: 'swipe.wav',      volume: 0.4 },
  { abs: 148.8, file: 'tap.wav',        volume: 0.45 },
  { abs: 100.73, file: 'transition.wav', volume: 0.32 },
  { abs: 107.73, file: 'transition.wav', volume: 0.32 },
  { abs: 116.73, file: 'transition.wav', volume: 0.32 },
  { abs: 127.73, file: 'transition.wav', volume: 0.32 },
  { abs: 132.08, file: 'transition.wav', volume: 0.32 },
  { abs: 139.73, file: 'transition.wav', volume: 0.32 },
  { abs: 148.73, file: 'transition.wav', volume: 0.32 },
  { abs: 150.1, file: 'whoosh_big.wav', volume: 0.45 },
  { abs: 151.6, file: 'success.wav',    volume: 0.5 },
];

/**
 * Seconds from the start of each sfx file to its loudest point, measured off the
 * rendered wavs. A cue is placed on the frame where the *hit* should be heard, so
 * the file has to start this much earlier — otherwise the swooshes (0.2-0.3s of
 * attack) read as late against the animation they belong to.
 */
export const LEAD: Record<string, number> = {
  'click.wav': 0.002,
  'ding.wav': 0.005,
  'ding_soft.wav': 0.004,
  'keypad.wav': 0.006,
  'notify.wav': 0.005,
  'paper_slide.wav': 0.221,
  'pop.wav': 0.002,
  'ring.wav': 0.008,
  'success.wav': 0.322,
  'swipe.wav': 0.104,
  'tap.wav': 0.003,
  'transition.wav': 0.288,
  'type.wav': 0.002,
  'voice_note.wav': 0.177,
  'whoosh_big.wav': 0.274,
};

/** Frame a cue's file must start on for its hit to land on `c.abs`. */
export const cueStart = (c: Cue) => at(c.abs) - Math.round((LEAD[c.file] ?? 0) * FPS);
