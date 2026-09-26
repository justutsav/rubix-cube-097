// GENERATED FILE — DO NOT EDIT.
// Copied from packages/core/src/gate.ts by scripts/vendor_core.py.
// Edit the original; this copy is re-synced on every deploy.

/**
 * STAGE 0 — the eligibility gate. Rules only. No model, no score, no ranking (panel 9).
 *
 * "Gate, then rank. Never rank, then gate." A recommendation the person cannot enrol in is
 * worse than silence: they travel to a centre, get turned away, and that is the CAG's 41%
 * placement figure being manufactured one call at a time.
 *
 * The gate returns THREE buckets, always. NEAR_MISS carrying the exact gap is not a softened
 * rejection — it is literally R4's fourth mandated output, "skill gaps requiring intervention"
 * (spec §9 MAJOR 2).
 */

import { CONCEPT_BY_ID } from './lexicon.ts';
import { GRADE, LEVEL_BY_NUMBER, gradeLabel } from './nsqf.ts';
import type { Education, EmploymentPref, GateVerdict, MobilityConstraint, Qualification } from './types.ts';

export interface Profile {
  education: Education;
  /** Q2. The years here are the ones that substitute for schooling — if they are *relevant*. */
  occupation: { conceptId: string; years: number } | null;
  livelihood: { conceptId: string | null; status: string } | null;
  skills: string[];
  mobility: { constraint: MobilityConstraint; radiusKm: number };
  pref: EmploymentPref;
  localDemand: string[];
  districtName: string | null;
  blockName: string | null;
  /**
   * NOT one of the seven PS fields, and not captured by the interview.
   *
   * FINDING (2026-09-26, same class as spec §9 BLOCKER 3): PM-DAKSH routing in spec §2.4 keys on
   * "age 18-45", but no PS field asks age and nothing else in the profile implies it. So either
   * age joins Q0 as registration metadata, or the router must return `age_unknown` and never
   * assume. It does the latter when this is null. Do not quietly default it to 18-45.
   */
  ageBand?: '18_45' | 'under_18' | 'over_45' | null;
}

export interface GateContext {
  /** Distance to the nearest centre offering this qualification, if the centre table knows. */
  nearestCentreKm?: (q: Qualification) => number | null;
  /** Levels the person IS eligible for, used to phrase "do the Level 2 course first". */
  eligibleLevels?: number[];
}

/**
 * Experience only substitutes when it is experience *in the thing being trained for*. The NSQF
 * wording is "relevant experience", and dropping the word "relevant" would make every
 * twelve-year weaver eligible for every Level 3 qualification in the register.
 *
 * Relevance is graded: same concept is full credit, same family (both textile, both livestock)
 * is half, unrelated is zero. The family fallback exists because a weaver moving into
 * embroidery is genuinely closer than a weaver moving into welding.
 */
export function relevantYears(profile: Profile, q: Qualification): { years: number; basis: string } {
  const occ = profile.occupation;
  if (!occ || occ.years <= 0) return { years: 0, basis: 'no stated experience' };
  if (q.concepts.includes(occ.conceptId)) {
    return { years: occ.years, basis: `${occ.years} years in the same trade` };
  }
  const occFamily = CONCEPT_BY_ID.get(occ.conceptId)?.family;
  const qFamilies = new Set(q.concepts.map((c) => CONCEPT_BY_ID.get(c)?.family).filter(Boolean));
  if (occFamily && qFamilies.has(occFamily)) {
    return { years: Math.floor(occ.years / 2), basis: `${occ.years} years in a related trade, counted at half` };
  }
  return { years: 0, basis: `${occ.years} years, but in an unrelated trade` };
}

export function gate(q: Qualification, profile: Profile, ctx: GateContext = {}): GateVerdict {
  const reasons: string[] = [];
  const grade = GRADE[profile.education];
  const { years, basis } = relevantYears(profile, q);
  const level = LEVEL_BY_NUMBER.get(q.level);

  // --- expired qualifications are never ranked. 880 of the NQR's 2,814 rows are dead.
  if (q.validTill) {
    const till = Date.parse(q.validTill);
    if (!Number.isNaN(till) && till < Date.now()) {
      return { bucket: 'INELIGIBLE', route: null, gap: null, reasons: [`qualification expired on ${q.validTill}`] };
    }
  }

  // --- the source does not state an entry requirement for this level, so we do not invent one.
  if (!level || level.entryRoutes === null) {
    return {
      bucket: 'INELIGIBLE',
      route: null,
      gap: null,
      reasons: [`ENTRY_REQUIREMENT_NOT_IN_SOURCE for ${q.levelLabel} — not typed from the NSQF gazette, so not guessed`],
    };
  }

  // --- physical demand against Q5. A hard stop only where the mismatch is total.
  if (profile.mobility.constraint === 'physical' && q.physicalDemand === 'high') {
    return {
      bucket: 'INELIGIBLE',
      route: null,
      gap: null,
      reasons: ['stated physical constraint against a high physical-demand job role'],
    };
  }
  if (profile.mobility.constraint === 'physical' && q.physicalDemand === 'moderate') {
    reasons.push('moderate physical demand — confirm with the training provider');
  }

  // --- entry routes: the first satisfied route admits them, and its wording is the proof.
  let admitted: string | null = null;
  for (const route of level.entryRoutes) {
    if (grade >= route.minGrade && years >= route.minYears) {
      admitted = route.minYears > 0 ? `${route.label} (${basis})` : route.label;
      break;
    }
  }

  // --- distance. A qualification nobody can reach is not a recommendation.
  const centreKm = ctx.nearestCentreKm?.(q) ?? null;
  const tooFar = centreKm !== null && centreKm > profile.mobility.radiusKm;

  if (admitted && !tooFar) {
    if (centreKm !== null) reasons.push(`nearest centre ${centreKm} km, within the stated ${profile.mobility.radiusKm} km`);
    return { bucket: 'ELIGIBLE', route: admitted, gap: null, reasons };
  }

  if (admitted && tooFar) {
    return {
      bucket: 'NEAR_MISS',
      route: admitted,
      gap: {
        kind: 'distance',
        need: `nearest centre is ${centreKm} km away, ${centreKm! - profile.mobility.radiusKm} km beyond what you said you can travel`,
      },
      reasons: [...reasons, 'eligible on entry requirement, blocked on reach'],
    };
  }

  // --- not admitted: find the cheapest gap across all routes and state it exactly.
  let best: { years: number; grade: number; route: (typeof level.entryRoutes)[number] } | null = null;
  for (const route of level.entryRoutes) {
    const gradeGap = Math.max(0, route.minGrade - grade);
    const yearGap = Math.max(0, route.minYears - years);
    const cand = { years: yearGap, grade: gradeGap, route };
    if (!best) best = cand;
    // Years are closable by waiting or by RPL; grades are not. Prefer a years-only gap.
    else if (
      cand.grade < best.grade ||
      (cand.grade === best.grade && cand.years < best.years)
    ) best = cand;
  }

  if (best && best.grade === 0 && best.years > 0 && best.years <= 2) {
    const plural = best.years === 1 ? 'year' : 'years';
    return {
      bucket: 'NEAR_MISS',
      route: null,
      gap: {
        kind: 'years',
        need: `${best.years} more ${plural} of experience in this trade — or an RPL assessment, which certifies experience you already have`,
        needLocal: `इस काम में ${best.years} साल और का तजुर्बा — या RPL से आपका मौजूदा तजुर्बा ही गिन लिया जाए`,
      },
      reasons: [...reasons, `closest route: ${best.route.label}`, basis],
    };
  }

  if (best && best.grade > 0) {
    const lower = (ctx.eligibleLevels ?? []).filter((l) => l < q.level).sort((a, b) => b - a)[0];
    if (lower !== undefined) {
      return {
        bucket: 'NEAR_MISS',
        route: null,
        gap: {
          kind: 'level_step',
          need: `do the Level ${lower} course in this trade first — it needs ${gradeLabel(
            LEVEL_BY_NUMBER.get(lower)?.entryRoutes?.[0]?.minGrade ?? 0,
          )}, and it opens this one`,
          needLocal: `पहले इसी काम का लेवल ${lower} कोर्स कर लीजिए — उससे ये रास्ता खुल जाता है`,
        },
        reasons: [...reasons, `short by ${best.grade} grade levels on every route to ${q.levelLabel}`],
      };
    }
    return {
      bucket: 'INELIGIBLE',
      route: null,
      gap: null,
      reasons: [...reasons, `${gradeLabel(best.route.minGrade)} required, ${gradeLabel(grade)} stated, and no lower level available in this trade`],
    };
  }

  return { bucket: 'INELIGIBLE', route: null, gap: null, reasons: [...reasons, 'no entry route satisfied'] };
}

/** Which NSQF levels this person clears on schooling+experience alone, ignoring trade fit. */
export function eligibleLevels(profile: Profile): number[] {
  const grade = GRADE[profile.education];
  const years = profile.occupation?.years ?? 0;
  const out: number[] = [];
  for (const level of LEVEL_BY_NUMBER.values()) {
    if (!level.entryRoutes) continue;
    if (level.entryRoutes.some((r) => grade >= r.minGrade && years >= r.minYears)) out.push(level.level);
  }
  return out.sort((a, b) => a - b);
}

/**
 * STAGE 0.5 — PM-DAKSH routing. The PM-AJAY guidelines are not expressing a preference:
 * "only those components or the beneficiaries which are **not** covered under the Scheme of
 * PM-DAKSH should be considered." Recommending GIA-funded training to someone PM-DAKSH covers
 * is recommending money PM-AJAY is forbidden to spend (spec §9 MAJOR 3).
 */
export function pmDakshRoute(
  profile: Profile,
  topLevel: number | null,
): { route: boolean; reason: string; stipendPerMonth: number } {
  const STIPEND_SC = 1500; // ₹/month for SC and Safai Karamchari candidates, per DoSJE.
  if (profile.ageBand == null) {
    return {
      route: false,
      reason: 'age_unknown — PM-DAKSH eligibility is 18-45 and no PS field captures age. Not assumed. Confirm at enrolment.',
      stipendPerMonth: STIPEND_SC,
    };
  }
  if (profile.ageBand !== '18_45') {
    return { route: false, reason: `outside PM-DAKSH's 18-45 band (${profile.ageBand})`, stipendPerMonth: STIPEND_SC };
  }
  if (topLevel === null) {
    return { route: false, reason: 'no eligible NSQF-standard short-term course to route', stipendPerMonth: STIPEND_SC };
  }
  return {
    route: true,
    reason: 'aged 18-45, SC category, and the match is a standard NSQF short-term course — PM-DAKSH covers this and pays a stipend, so PM-AJAY GIA must not fund it',
    stipendPerMonth: STIPEND_SC,
  };
}
