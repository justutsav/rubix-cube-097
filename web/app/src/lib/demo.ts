/**
 * A district's worth of plausible rows, for showing the officer console with something in it.
 *
 * This does **not** fabricate recommendations. It builds profiles and runs them through the real
 * `recommend()` with the real catalogue, so every row on the dashboard is the engine's actual
 * output for that profile — including the near-misses, which are the interesting ones. A demo
 * that hand-writes its own results proves nothing and would be the exact dishonesty the rest of
 * this repo spends its time avoiding.
 *
 * Every seeded beneficiary carries `demo: true` on the row, and the console says so on screen.
 */

import {
  OPPORTUNITIES,
  QUALIFICATIONS,
  NQR_SNAPSHOT_SHA,
  recommend,
  type Education,
  type EmploymentPref,
  type MobilityConstraint,
  type Answer,
  type AnswerValue,
  type Profile,
} from '@rc097/core';
import { openStore, type BeneficiaryRow } from './db';

export const DEMO_KEY = 'app.demoSeeded';

const DISTRICT = 'Sitapur';

interface Seed {
  village: string;
  block: string;
  woman: boolean;
  education: Education;
  trade: string;
  years: number;
  skills: string[];
  pref: EmploymentPref;
  mobility: MobilityConstraint;
  radiusKm: number;
}

/**
 * Deliberately uneven. Two thirds women (the 30% mandate should be met, not just reported), a
 * spread of schooling from none to higher secondary, and several people whose years of work are
 * the only thing that opens a level — those are the rows that make the eligibility gate visible.
 *
 * These are shapes, not people: the trade a Sitapur block actually turns up, with the profile it
 * usually arrives with. `expand()` below puts them in villages.
 */
type Shape = Omit<Seed, 'village' | 'block'> & { n: number };

const SHAPES: Shape[] = [
  { woman: true,  education: 'none',        trade: 'TRADE.TAILORING',          years: 12, skills: ['TRADE.TAILORING'],          pref: 'self',   mobility: 'care_duty', radiusKm: 5, n: 10 },
  { woman: true,  education: 'primary',     trade: 'TRADE.HANDLOOM_WEAVING',   years: 6,  skills: ['TRADE.HANDLOOM_WEAVING'],   pref: 'self',   mobility: 'none',      radiusKm: 15, n: 7 },
  { woman: false, education: 'middle',      trade: 'TRADE.MASONRY',            years: 8,  skills: ['TRADE.MASONRY'],            pref: 'wage',   mobility: 'none',      radiusKm: 30, n: 4 },
  { woman: true,  education: 'read_write',  trade: 'TRADE.DAIRY',              years: 10, skills: ['TRADE.DAIRY'],              pref: 'self',   mobility: 'distance',  radiusKm: 8, n: 5 },
  { woman: true,  education: 'secondary',   trade: 'TRADE.BEAUTY_PARLOUR',     years: 2,  skills: ['TRADE.BEAUTY_PARLOUR'],     pref: 'self',   mobility: 'none',      radiusKm: 20, n: 4 },
  { woman: false, education: 'higher_sec',  trade: 'TRADE.ELECTRICIAN',        years: 1,  skills: ['TRADE.ELECTRICIAN'],        pref: 'wage',   mobility: 'none',      radiusKm: 40, n: 3 },
  { woman: true,  education: 'none',        trade: 'TRADE.FARMING',            years: 15, skills: ['TRADE.FARMING'],            pref: 'self',   mobility: 'care_duty', radiusKm: 5, n: 6 },
  { woman: true,  education: 'primary',     trade: 'TRADE.EMBROIDERY',         years: 4,  skills: ['TRADE.EMBROIDERY'],         pref: 'either', mobility: 'none',      radiusKm: 12, n: 4 },
  { woman: false, education: 'middle',      trade: 'TRADE.CARPENTRY',          years: 9,  skills: ['TRADE.CARPENTRY'],          pref: 'self',   mobility: 'none',      radiusKm: 25, n: 3 },
  { woman: true,  education: 'read_write',  trade: 'TRADE.LEATHER_FOOTWEAR',   years: 7,  skills: ['TRADE.LEATHER_FOOTWEAR'],   pref: 'wage',   mobility: 'distance',  radiusKm: 10, n: 3 },
  { woman: true,  education: 'secondary',   trade: 'TRADE.FOOD_PROCESSING',    years: 3,  skills: ['TRADE.FOOD_PROCESSING'],    pref: 'self',   mobility: 'none',      radiusKm: 18, n: 3 },
  { woman: false, education: 'primary',     trade: 'TRADE.PLUMBING',           years: 5,  skills: ['TRADE.PLUMBING'],           pref: 'wage',   mobility: 'none',      radiusKm: 35, n: 2 },
  { woman: true,  education: 'none',        trade: 'TRADE.GOAT_REARING',       years: 11, skills: ['TRADE.GOAT_REARING'],       pref: 'self',   mobility: 'care_duty', radiusKm: 4, n: 4 },
  { woman: true,  education: 'primary',     trade: 'TRADE.POULTRY',            years: 5,  skills: ['TRADE.POULTRY'],            pref: 'self',   mobility: 'none',      radiusKm: 9, n: 3 },
  { woman: false, education: 'higher_sec',  trade: 'TRADE.TWO_WHEELER_MECHANIC', years: 2, skills: ['TRADE.TWO_WHEELER_MECHANIC'], pref: 'wage', mobility: 'none',   radiusKm: 30, n: 2 },
  { woman: true,  education: 'secondary',   trade: 'TRADE.HEALTHCARE_GDA',     years: 0,  skills: [],                           pref: 'wage',   mobility: 'distance',  radiusKm: 25, n: 2 },
  { woman: false, education: 'middle',      trade: 'TRADE.WELDING',            years: 6,  skills: ['TRADE.WELDING'],            pref: 'wage',   mobility: 'none',      radiusKm: 28, n: 2 },
  { woman: true,  education: 'read_write',  trade: 'TRADE.MUSHROOM',           years: 2,  skills: ['TRADE.MUSHROOM'],           pref: 'self',   mobility: 'care_duty', radiusKm: 6, n: 2 },
  { woman: false, education: 'higher_sec',  trade: 'TRADE.SOLAR_TECHNICIAN',   years: 1,  skills: ['TRADE.SOLAR_TECHNICIAN'],   pref: 'wage',   mobility: 'none',      radiusKm: 45, n: 1 },
  { woman: true,  education: 'primary',     trade: 'TRADE.BAMBOO_CANE',        years: 9,  skills: ['TRADE.BAMBOO_CANE'],        pref: 'self',   mobility: 'none',      radiusKm: 11, n: 2 },
  { woman: false, education: 'secondary',   trade: 'TRADE.DRIVING',            years: 4,  skills: ['TRADE.DRIVING'],            pref: 'wage',   mobility: 'none',      radiusKm: 50, n: 2 },
  { woman: true,  education: 'none',        trade: 'TRADE.POTTERY',            years: 14, skills: ['TRADE.POTTERY'],            pref: 'self',   mobility: 'care_duty', radiusKm: 5, n: 2 },
  { woman: true,  education: 'middle',      trade: 'TRADE.COMPUTER_DATA_ENTRY', years: 0, skills: [],                           pref: 'wage',   mobility: 'none',      radiusKm: 22, n: 2 },
  { woman: false, education: 'read_write',  trade: 'TRADE.CONSTRUCTION_LABOUR', years: 13, skills: ['TRADE.CONSTRUCTION_LABOUR'], pref: 'wage', mobility: 'none',      radiusKm: 20, n: 2 },
];

/** Six of Sitapur's blocks, three villages each. Block is the unit a GIA project is costed at. */
const BLOCKS: { block: string; villages: string[] }[] = [
  { block: 'Biswan',     villages: ['Biswan', 'Kamlapur', 'Atariya'] },
  { block: 'Sidhauli',   villages: ['Mahmudabad', 'Pisawan', 'Khairabad'] },
  { block: 'Laharpur',   villages: ['Laharpur', 'Reusa', 'Behta'] },
  { block: 'Misrikh',    villages: ['Misrikh', 'Naimisharanya', 'Aurangabad'] },
  { block: 'Machhrehta', villages: ['Machhrehta', 'Rampur Kalan', 'Tambaur'] },
  { block: 'Sakran',     villages: ['Sakran', 'Hargaon', 'Parsendi'] },
];

/**
 * 80 people across six blocks — roughly what one district's mobilisation fortnight produces, and
 * enough that the spread chart and the block split mean something. A 12-row register made every
 * bar the same height and every percentage a multiple of eight.
 *
 * The `n` on each shape is the point: demand is a long tail. Ten women want tailoring and one man
 * wants to fit solar panels, which is exactly the shape the ranker's concentration penalty and the
 * CAG's "40% of certifications in 10 job-roles" finding are both about. An even 3-per-trade
 * register would have made the spread KPI look healthy for a reason that has nothing to do with
 * the engine.
 *
 * Deterministic, not random: the same demo has to produce the same console twice, or a screenshot
 * and the thing it claims to be a screenshot of drift apart.
 */
function expand(): Seed[] {
  const places = BLOCKS.flatMap(({ block, villages }) => villages.map((village) => ({ block, village })));
  const out: Seed[] = [];
  let i = 0;
  for (const shape of SHAPES) {
    for (let k = 0; k < shape.n; k++) {
      // Walk the villages with a stride coprime to their count, so a trade is not concentrated in
      // the village that happens to sit at its index.
      const place = places[(i * 5) % places.length];
      out.push({
        ...shape,
        ...place,
        years: Math.max(0, shape.years + ((i * 3) % 7) - 3),
      });
      i++;
    }
  }
  return out;
}

const SEEDS: Seed[] = expand();

/** Where each person got to. Not everyone finishes, and not everyone who joins gets work. */
const JOURNEY = [
  'PLACED', 'PLACED', 'ENROLLED', 'CERTIFIED', 'PLACED', 'ENROLLED',
  'RECOMMENDED', 'DROPPED', 'CERTIFIED', 'RECOMMENDED', 'PLACED', 'ENROLLED',
] as const;

function profileOf(s: Seed): Profile {
  return {
    education: s.education,
    occupation: { conceptId: s.trade, years: s.years },
    livelihood: { conceptId: s.trade, status: s.pref === 'wage' ? 'casual' : 'self' },
    skills: s.skills,
    mobility: { constraint: s.mobility, radiusKm: s.radiusKm },
    pref: s.pref,
    localDemand: [s.trade],
    districtName: DISTRICT,
    blockName: s.block,
    age: s.woman ? 29 : 34,
  } as Profile;
}

/**
 * Guard against double-seeding. React StrictMode invokes effects twice in dev, and
 * `recommendation.create` mints a fresh row id each time — so an unguarded seed silently
 * doubled every derived count on the console (22 near-misses out of 12 people).
 */
let inFlight: Promise<number> | null = null;

export function seedDemo(): Promise<number> {
  inFlight ??= seedOnce().finally(() => { inFlight = null; });
  return inFlight;
}

async function seedOnce(): Promise<number> {
  const store = await openStore();
  const now = new Date();
  if ((await store.get<boolean>(DEMO_KEY)) === true) return SEEDS.length;

  for (const [i, s] of SEEDS.entries()) {
    const id = `demo-${i + 1}`;
    // Spread the interviews over the last few weeks so the register does not look like a script.
    const at = new Date(now.getTime() - (SEEDS.length - i) * 6 * 3_600_000);

    await store.putBeneficiary({
      id,
      phoneHash: null,
      ordinal: i + 1,
      firstName: null,
      resumePinHash: null,
      districtName: DISTRICT,
      blockName: s.block,
      villageName: s.village,
      ageBand: '18_45',
      isWoman: s.woman,
      consentState: 'GIVEN',
      updatedAt: at.toISOString(),
    } satisfies BeneficiaryRow);

    // The seven PS fields, all confirmed. Without these the district demand views are empty,
    // because every one of them filters on `confirmedAt is not null` — an unconfirmed answer is
    // a resumable field, not a data point to put in front of another department.
    const answer = (fieldNo: number, value: AnswerValue): Answer => ({
      beneficiaryId: id,
      fieldNo: fieldNo as Answer['fieldNo'],
      rawTranscript: null,
      nbest: null,
      value,
      confidence: 0.92,
      method: 'LEXICON',
      asrEngine: 'demo',
      asrVersion: null,
      confirmedAt: at.toISOString(),
      sessionId: `demo-s-${i + 1}`,
      updatedAt: at.toISOString(),
    });

    await store.applyEvents(
      [
        { type: 'answer.upsert', answer: answer(1, { kind: 'education', education: s.education }) },
        { type: 'answer.upsert', answer: answer(2, { kind: 'occupation', conceptId: s.trade, years: s.years }) },
        { type: 'answer.upsert', answer: answer(3, { kind: 'livelihood', conceptId: s.trade, status: s.pref === 'wage' ? 'casual' : 'self' }) },
        { type: 'answer.upsert', answer: answer(4, { kind: 'concepts', conceptIds: s.skills }) },
        { type: 'answer.upsert', answer: answer(5, { kind: 'mobility', constraint: s.mobility, radiusKm: s.radiusKm }) },
        { type: 'answer.upsert', answer: answer(6, { kind: 'pref', pref: s.pref }) },
        { type: 'answer.upsert', answer: answer(7, { kind: 'local', conceptIds: [s.trade], note: null }) },
      ],
      { queue: false },
    );

    // The real engine, the real catalogue. Whatever it says is what the dashboard shows.
    const reco = recommend(profileOf(s), {
      catalogue: QUALIFICATIONS,
      opportunities: OPPORTUNITIES,
      nqrSnapshotSha: NQR_SNAPSHOT_SHA,
      now: () => at,
    });

    await store.applyEvents(
      [{ type: 'recommendation.create', beneficiaryId: id, result: reco, at: at.toISOString() }],
      { queue: false },
    );

    const top = reco.top[0]?.qualification;
    if (top) {
      const ref = top.qpCode ?? top.localId;
      const reached = JOURNEY[i % JOURNEY.length];
      // Write every stage up to the one reached, so the funnel is a funnel and not a single dot.
      const ladder = ['RECOMMENDED', 'ENROLLED', 'CERTIFIED', 'PLACED'] as const;
      const upto = reached === 'DROPPED' ? ['RECOMMENDED', 'ENROLLED'] : ladder.slice(0, ladder.indexOf(reached as never) + 1);
      for (const st of [...upto, ...(reached === 'DROPPED' ? ['DROPPED'] : [])]) {
        await store.applyEvents(
          [{ type: 'outcome.upsert', beneficiaryId: id, qualificationRef: ref, status: st as never, at: at.toISOString() }],
          { queue: false },
        );
      }
    }
  }

  await store.set(DEMO_KEY, true);
  return SEEDS.length;
}

export async function demoSeeded(): Promise<boolean> {
  const store = await openStore();
  return (await store.get<boolean>(DEMO_KEY)) === true;
}

export async function clearDemo(): Promise<void> {
  const store = await openStore();
  await store.set(DEMO_KEY, false);
}
