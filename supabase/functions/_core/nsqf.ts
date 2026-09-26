// GENERATED FILE — DO NOT EDIT.
// Copied from packages/core/src/nsqf.ts by scripts/vendor_core.py.
// Edit the original; this copy is re-synced on every deploy.

/**
 * The NSQF entry-requirement table, typed by hand from the gazette Annexure.
 *
 * This file *is* the eligibility engine (02-tech-landscape.md §4.2). It is under 100 rows and
 * it is already written down by the Government of India, which is the entire reason eligibility
 * can be a hard gate instead of a score.
 *
 * Two facts fall straight out of it, and they are the product:
 *   1. Levels 1 and 2 require NO formal education at all. The low-literacy beneficiary the PS
 *      describes is not excluded from NSQF — she is excluded from knowing that.
 *   2. Years of relevant experience substitute for schooling at every level from 2.5 up. So
 *      "I have done my father's weaving for twelve years" is an ELIGIBILITY CLAIM, not
 *      biography. It is the highest-value inference in the interview.
 *
 * Source: NSQF Gazette Notification, NCVET, 6 June 2023 — via 01-the-customer.md §7.
 * Levels above 4 are `entryRoutes: null` on purpose: those rows were not typed from the gazette,
 * and decisions.md forbids guessing what the source does not state. The gate returns
 * ENTRY_REQUIREMENT_NOT_IN_SOURCE for them rather than inventing a rule.
 */

import type { Education } from './types.ts';

/** Grade-equivalent ordinal for each Q1 value. `read_write` is the gazette's own category. */
export const GRADE: Record<Education, number> = {
  none: 0,
  read_write: 0.5,
  primary: 5,
  middle: 8,
  secondary: 10,
  higher_sec: 12,
  iti_diploma: 13,
  graduate_plus: 14,
};

export const EDUCATION_ORDER: Education[] = [
  'none', 'read_write', 'primary', 'middle', 'secondary', 'higher_sec', 'iti_diploma', 'graduate_plus',
];

export interface EntryRoute {
  /** Minimum grade-equivalent. 0 = no formal education required. */
  minGrade: number;
  /** Years of *relevant* experience that substitute for the schooling gap. */
  minYears: number;
  /** Verbatim-ish wording, for the officer's eligibility proof. */
  label: string;
}

export interface NsqfLevel {
  level: number;
  levelLabel: string;
  /** `null` = the gazette row was not typed. NOT "no requirement". */
  entryRoutes: EntryRoute[] | null;
  notionalHours: [number, number] | null;
}

export const NSQF_LEVELS: NsqfLevel[] = [
  {
    level: 1,
    levelLabel: 'Level 1',
    entryRoutes: [{ minGrade: 0, minYears: 0, label: 'No formal education required' }],
    notionalHours: [150, 210],
  },
  {
    level: 2,
    levelLabel: 'Level 2',
    entryRoutes: [{ minGrade: 0, minYears: 0, label: 'No formal education required' }],
    notionalHours: [210, 270],
  },
  {
    level: 2.5,
    levelLabel: 'Level 2.5',
    entryRoutes: [
      { minGrade: 9, minYears: 0, label: '9th pass' },
      { minGrade: 8, minYears: 1, label: '8th pass + 1 year relevant experience' },
      { minGrade: 5, minYears: 4, label: '5th pass + 4 years relevant experience' },
      { minGrade: 0.5, minYears: 5, label: 'Able to read and write + 5 years relevant experience' },
    ],
    notionalHours: [240, 300],
  },
  {
    level: 3,
    levelLabel: 'Level 3',
    entryRoutes: [
      { minGrade: 10, minYears: 0, label: '10th pass' },
      { minGrade: 9, minYears: 1, label: '9th pass + 1 year relevant experience' },
      { minGrade: 8, minYears: 2, label: '8th pass + 2 years relevant experience' },
      { minGrade: 5, minYears: 5, label: '5th pass + 5 years relevant experience' },
    ],
    notionalHours: [270, 390],
  },
  {
    level: 3.5,
    levelLabel: 'Level 3.5',
    entryRoutes: [
      { minGrade: 11, minYears: 0, label: '11th pass' },
      { minGrade: 10, minYears: 1, label: '10th pass + 1 year relevant experience' },
      { minGrade: 8, minYears: 3, label: '8th pass + 3 years relevant experience' },
    ],
    notionalHours: [360, 420],
  },
  {
    level: 4,
    levelLabel: 'Level 4',
    entryRoutes: [
      { minGrade: 12, minYears: 0, label: '12th pass' },
      { minGrade: 11, minYears: 1, label: '11th pass + 1 year relevant experience' },
      { minGrade: 10, minYears: 2, label: '10th pass + 2 years relevant experience' },
    ],
    notionalHours: [390, 480],
  },
  // Levels 4.5 and up exist in the framework (13 levels, half-levels are real) but their entry
  // rows are not in the extract we typed. NULL, not guessed.
  { level: 4.5, levelLabel: 'Level 4.5', entryRoutes: null, notionalHours: null },
  { level: 5, levelLabel: 'Level 5', entryRoutes: null, notionalHours: null },
  { level: 5.5, levelLabel: 'Level 5.5', entryRoutes: null, notionalHours: null },
  { level: 6, levelLabel: 'Level 6', entryRoutes: null, notionalHours: null },
  { level: 6.5, levelLabel: 'Level 6.5', entryRoutes: null, notionalHours: null },
  { level: 7, levelLabel: 'Level 7', entryRoutes: null, notionalHours: null },
  { level: 8, levelLabel: 'Level 8', entryRoutes: null, notionalHours: null },
];

export const LEVEL_BY_NUMBER = new Map(NSQF_LEVELS.map((l) => [l.level, l] as const));

/** The four PM-AJAY GIA training categories, with the durations the guidelines fix (Ch.3 ¶7A.a.ii). */
export const GIA_TRAINING_CATEGORIES = [
  { id: 'RPL', label: 'Up-skilling / RPL', hours: [32, 80] as const, note: 'spaced over up to one month' },
  { id: 'STT', label: 'Short Term Course', hours: [200, 600] as const, note: 'up to 5 months; focus on women and self-employment' },
  { id: 'EDP', label: 'Entrepreneurial Development Programme', hours: [80, 80] as const, note: 'normally 80 hours / 10 days' },
  { id: 'LTT', label: 'Long Term Course', hours: [960, 1920] as const, note: '6 months to 1 year; for those educated to 10th class or more' },
] as const;

export type GiaCategoryId = (typeof GIA_TRAINING_CATEGORIES)[number]['id'];

/**
 * Which GIA category a qualification falls in, by notional hours and the beneficiary's schooling.
 * LTT carries an explicit education floor in the guidelines, so it is not purely a duration call.
 */
export function giaCategory(notionalHours: number | null, education: Education): GiaCategoryId {
  if (notionalHours === null) return 'STT';
  if (notionalHours <= 80) return GRADE[education] >= 10 ? 'EDP' : 'RPL';
  if (notionalHours <= 600) return 'STT';
  return GRADE[education] >= 10 ? 'LTT' : 'STT';
}

/** Grade-equivalent → the phrase a human would use, for the spoken gap sentence. */
export function gradeLabel(grade: number): string {
  if (grade <= 0) return 'no formal schooling';
  if (grade <= 0.5) return 'able to read and write';
  return `class ${grade} pass`;
}
