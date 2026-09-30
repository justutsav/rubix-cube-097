/**
 * The opening section: the problem, proved out of the primary sources.
 *
 * Runs 0.0s -> 41.3s in the shot cut — from the first frame to the frame before
 * Speaker 2 starts. (Speaker 2's own section video begins at 47.6s; the 41.3–47.6
 * stretch is his run-up and belongs to neither cut.)
 *
 * Caption text is read off the burned-in captions a second at a time. One word is
 * reconstructed: "lakh" at 13.3s, which the burned-in caption drops between
 * "fifty-six" and "people were certified" — the CAG figure is 56.14 lakh and the
 * script says "fifty-six lakh", so the word is restored here.
 *
 * Every document on screen in this section is a real crop of the real PDF page and
 * every yellow highlight is the real bounding box of the real words — see
 * scripts-build-s1-sources.py and src/s1Sources.ts.
 */
import type { SceneCue } from './cues';

export const FPS_S1 = 30;
export const S1_START_ABS = 0;
export const S1_DURATION_S = 41.28;
export const S1_FRAMES = Math.round(S1_DURATION_S * FPS_S1);

export const at1 = (abs: number) => Math.round((abs - S1_START_ABS) * FPS_S1);

export type Cap1 = { abs: number; end: number; text: string };

export const CAPTIONS_S1: Cap1[] = [
  { abs: 1.6, end: 2.5, text: 'Under the PM-AJAY Yojana,' },
  { abs: 3.2, end: 4.25, text: "it is said that beneficiaries'" },
  { abs: 4.3, end: 5.0, text: 'interests' },
  { abs: 5.05, end: 6.1, text: 'should be understood' },
  { abs: 6.15, end: 7.15, text: 'before choosing a trade for' },
  { abs: 7.2, end: 7.9, text: 'them.' },
  { abs: 7.95, end: 8.5, text: 'Finding the right' },
  { abs: 8.6, end: 10.0, text: 'pathway is still difficult.' },
  { abs: 10.25, end: 11.5, text: 'And here are the results.' },
  { abs: 11.7, end: 13.2, text: 'The CAG found that fifty-six' },
  { abs: 13.3, end: 14.4, text: 'lakh people were certified.' }, // "lakh" reconstructed
  { abs: 14.5, end: 16.4, text: 'But only forty-one percent' },
  { abs: 16.5, end: 17.9, text: 'were placed, over' },
  { abs: 18.0, end: 19.0, text: 'a seventy percent target.' },
  { abs: 19.7, end: 21.0, text: 'Forty percent of the' },
  { abs: 21.05, end: 21.9, text: 'certifications were' },
  { abs: 22.0, end: 23.9, text: 'under just ten job-roles.' },
  { abs: 24.0, end: 25.9, text: 'And under the Green Jobs,' },
  { abs: 26.0, end: 27.9, text: 'ninety percent of the people' },
  { abs: 28.0, end: 28.6, text: 'were in one role.' },
  { abs: 28.7, end: 30.2, text: 'That is Safai Karamchari.' },
  { abs: 30.4, end: 31.5, text: 'So the challenge' },
  { abs: 31.6, end: 33.0, text: 'is not getting people into' },
  { abs: 33.1, end: 33.9, text: 'training.' },
  { abs: 34.0, end: 35.9, text: 'It is to find the right pathway' },
  { abs: 36.0, end: 36.9, text: 'for the right person.' },
  { abs: 37.0, end: 38.3, text: 'We are Team RubixCube.' },
  { abs: 38.9, end: 40.4, text: 'And here is how we built to' },
  { abs: 40.5, end: 41.28, text: 'address the gaps.' },
];

export type Scene1 = { id: string; fromAbs: number; toAbs: number };

export const S1_SCENES: Scene1[] = [
  { id: 'open', fromAbs: 0.0, toAbs: 1.55 },
  { id: 'clause', fromAbs: 1.55, toAbs: 10.2 },
  { id: 'audit', fromAbs: 10.2, toAbs: 11.65 },
  { id: 'certified', fromAbs: 11.65, toAbs: 14.5 },
  { id: 'placed', fromAbs: 14.5, toAbs: 19.6 },
  { id: 'ten', fromAbs: 19.6, toAbs: 23.95 },
  { id: 'green', fromAbs: 23.95, toAbs: 30.3 },
  { id: 'turn', fromAbs: 30.3, toAbs: 33.95 },
  { id: 'match', fromAbs: 33.95, toAbs: 36.95 },
  { id: 'team', fromAbs: 36.95, toAbs: 41.28 },
];

/**
 * Soft set only. This section is cold and factual; a sharp transition sting would
 * editorialise the numbers, which is exactly what the delivery note forbids.
 * Volumes sit under the narration throughout.
 */
export const CUES_S1: SceneCue[] = [
  { scene: 'open', rel: 0.1, file: 'whoosh_lo.wav', volume: 0.3 },
  { scene: 'open', rel: 0.75, file: 'tick.wav', volume: 0.24 },

  { scene: 'clause', rel: 0.1, file: 'slide.wav', volume: 0.3 },
  { scene: 'clause', rel: 1.0, file: 'drag.wav', volume: 0.26 },
  { scene: 'clause', rel: 3.55, file: 'tick.wav', volume: 0.3 }, // highlight 1, line 1
  { scene: 'clause', rel: 4.05, file: 'tick.wav', volume: 0.26 }, // highlight 1, line 2
  { scene: 'clause', rel: 6.45, file: 'whoosh.wav', volume: 0.26 },
  { scene: 'clause', rel: 6.6, file: 'tick.wav', volume: 0.3 }, // highlight 2
  { scene: 'clause', rel: 7.3, file: 'slide.wav', volume: 0.3 }, // the counter-card

  { scene: 'audit', rel: 0.05, file: 'whoosh_lo.wav', volume: 0.34 },
  { scene: 'audit', rel: 0.55, file: 'confirm.wav', volume: 0.26 },

  { scene: 'certified', rel: 0.08, file: 'pop.wav', volume: 0.3 },
  { scene: 'certified', rel: 1.5, file: 'slide.wav', volume: 0.26 },
  { scene: 'certified', rel: 1.95, file: 'tick.wav', volume: 0.3 },

  { scene: 'placed', rel: 0.08, file: 'whoosh.wav', volume: 0.28 },
  { scene: 'placed', rel: 0.6, file: 'drag.wav', volume: 0.3 },
  { scene: 'placed', rel: 2.55, file: 'tick.wav', volume: 0.3 },
  { scene: 'placed', rel: 3.3, file: 'slide.wav', volume: 0.3 },
  { scene: 'placed', rel: 3.85, file: 'tick.wav', volume: 0.3 },

  { scene: 'ten', rel: 0.08, file: 'whoosh.wav', volume: 0.28 },
  { scene: 'ten', rel: 0.7, file: 'drag.wav', volume: 0.3 },
  { scene: 'ten', rel: 2.45, file: 'pop.wav', volume: 0.28 },
  { scene: 'ten', rel: 2.9, file: 'slide.wav', volume: 0.26 },
  { scene: 'ten', rel: 3.35, file: 'tick.wav', volume: 0.3 },

  { scene: 'green', rel: 0.08, file: 'whoosh_lo.wav', volume: 0.3 },
  { scene: 'green', rel: 1.0, file: 'drag.wav', volume: 0.3 },
  { scene: 'green', rel: 2.35, file: 'confirm.wav', volume: 0.28 },
  { scene: 'green', rel: 4.0, file: 'chime.wav', volume: 0.24 }, // "Safai Karmchari" lands
  { scene: 'green', rel: 4.9, file: 'tick.wav', volume: 0.28 },

  { scene: 'turn', rel: 0.08, file: 'click.wav', volume: 0.26 },
  { scene: 'turn', rel: 1.35, file: 'pop.wav', volume: 0.26 },

  { scene: 'match', rel: 0.08, file: 'whoosh.wav', volume: 0.28 },
  { scene: 'match', rel: 1.15, file: 'confirm.wav', volume: 0.3 },

  { scene: 'team', rel: 0.1, file: 'chime.wav', volume: 0.3 },
  { scene: 'team', rel: 1.85, file: 'pop.wav', volume: 0.26 },
  { scene: 'team', rel: 3.35, file: 'whoosh_lo.wav', volume: 0.3 },
];

/** The ten job-roles that took ~40% of every STT/SP certification. CAG Table 2.1(a). */
export const TOP_ROLES = [
  { role: 'Self Employed Tailor', sector: 'Apparel', n: 452690, pct: 8.06 },
  { role: 'Field Technician Computing & Peripherals', sector: 'Electronics', n: 402782, pct: 7.17 },
  { role: 'Retail Sales Associate', sector: 'Retail', n: 238320, pct: 4.25 },
  { role: 'Retail Trainee Associate', sector: 'Retail', n: 218745, pct: 3.9 },
  { role: 'Sewing Machine Operator', sector: 'Apparel', n: 209367, pct: 3.73 },
  { role: 'Domestic Data Entry Operator', sector: 'IT', n: 187431, pct: 3.34 },
  { role: 'Documentation Assistant', sector: 'Logistics', n: 162200, pct: 2.89 },
  { role: 'Assistant Electrician', sector: 'Construction', n: 147069, pct: 2.62 },
  { role: 'General Duty Assistant', sector: 'Healthcare', n: 108250, pct: 1.93 },
  { role: 'Telecom Customer Care Exe', sector: 'Telecom', n: 96464, pct: 1.72 },
] as const;

/** Sector concentration, CAG Table 2.1(b) — Green Jobs first, and it is not close. */
export const SECTOR_CONC = [
  { sector: 'Green Jobs', roles: 10, certified: 427113, role: 'Safai Karmchari', inRole: 385880, pct: 90.35 },
  { sector: 'Management', roles: 20, certified: 416014, role: 'Unarmed Security Guards', inRole: 282610, pct: 67.93 },
  { sector: 'Healthcare', roles: 21, certified: 173687, role: 'General Duty Assistant', inRole: 116468, pct: 67.06 },
  { sector: 'Information Technology', roles: 11, certified: 308341, role: 'Domestic Data Entry Operator', inRole: 195873, pct: 63.52 },
  { sector: 'Domestic Worker', roles: 4, certified: 154065, role: 'General Housekeeper', inRole: 91463, pct: 59.37 },
] as const;
