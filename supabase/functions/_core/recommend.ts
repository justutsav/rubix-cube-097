// GENERATED FILE — DO NOT EDIT.
// Copied from packages/core/src/recommend.ts by scripts/vendor_core.py.
// Edit the original; this copy is re-synced on every deploy.

/**
 * STAGES 1-3 — retrieval, ranking, and the three explanations (panel 9).
 *
 * Ranking is a weighted linear score with the weights written down and versioned, not TOPSIS.
 * The weights are judgement calls either way; writing them down is more honest than deriving
 * them through a technique whose main function is to make judgement calls look derived
 * (02-tech-landscape.md §5.1).
 *
 * The unusual component is `spreadPenalty`. CAG found 40% of national certifications in 10
 * job-roles and 90.35% of "Green Jobs" in Safai Karmchari alone. Charting our own concentration
 * after the fact would be a slide; penalising it inside the ranker is a countermeasure. Pass the
 * district's running recommendation histogram and an over-recommended trade loses ground.
 */

import { CONCEPT_BY_ID, conceptLabel } from './lexicon.ts';
import { gate, eligibleLevels, pmDakshRoute, type GateContext, type Profile } from './gate.ts';
import { giaCategory } from './nsqf.ts';
import type {
  DistrictOpportunity,
  Qualification,
  RecommendationResult,
  ScoredQualification,
  Weights,
} from './types.ts';

export const ENGINE_VERSION = 'reco-0.1.0';

export const WEIGHTS: Weights = {
  version: 'w-2026-09-26.1',
  aspirationFit: 0.26,
  skillTransfer: 0.20,
  localOpportunity: 0.18,
  prefMatch: 0.12,
  durationVsMobility: 0.10,
  assetGrant: 0.06,
  womenNudge: 0.04,
  spreadPenalty: 0.14,
};

export interface RecommendOptions {
  catalogue: Qualification[];
  opportunities?: DistrictOpportunity[];
  weights?: Weights;
  /** Concept → how many times this district has already recommended it. Drives spread. */
  districtHistogram?: Map<string, number>;
  /** True when the beneficiary is a woman, for the 15%/30% guideline nudge. */
  isWoman?: boolean;
  nqrSnapshotSha?: string | null;
  nearestCentreKm?: GateContext['nearestCentreKm'];
  now?: () => Date;
  topN?: number;
}

function overlap(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const set = new Set(b);
  let hits = 0;
  for (const x of a) if (set.has(x)) hits++;
  return hits / Math.max(1, Math.min(a.length, b.length));
}

function familyOverlap(a: string[], b: string[]): number {
  const fa = new Set(a.map((c) => CONCEPT_BY_ID.get(c)?.family).filter(Boolean));
  const fb = new Set(b.map((c) => CONCEPT_BY_ID.get(c)?.family).filter(Boolean));
  if (fa.size === 0 || fb.size === 0) return 0;
  let hits = 0;
  for (const f of fa) if (fb.has(f)) hits++;
  return hits / Math.max(1, Math.min(fa.size, fb.size));
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function score(
  q: Qualification,
  profile: Profile,
  opts: Required<Pick<RecommendOptions, 'weights'>> & RecommendOptions,
): { total: number; components: Record<string, number> } {
  const w = opts.weights;

  // Aspiration: what she said she wants to learn (Q4). The whole point of asking.
  const aspirationFit = clamp01(overlap(profile.skills, q.concepts) + 0.4 * familyOverlap(profile.skills, q.concepts));

  // Skill transfer: what she can already do (Q2 family trade + Q3 current work). This is the
  // RPL shortcut — the reason a twelve-year weaver should not be started from zero.
  const have = [profile.occupation?.conceptId, profile.livelihood?.conceptId].filter(Boolean) as string[];
  const skillTransfer = clamp01(overlap(have, q.concepts) + 0.5 * familyOverlap(have, q.concepts));

  // Local opportunity: Q7 plus the district table. Zero when we have no sourced data, which is
  // honest — it must not silently behave like 1.
  const oppConcepts = (opts.opportunities ?? []).map((o) => o.conceptId);
  const localOpportunity = clamp01(
    0.6 * overlap(profile.localDemand, q.concepts) + 0.4 * overlap(oppConcepts, q.concepts),
  );

  // Preference: self-employment vs wage. Only 25 of 1,199 valid ≤L4 NQR rows are
  // entrepreneurship-shaped, so this component is what stops us recommending wage training to
  // someone who said "my own work" and calling it a match.
  const prefMatch =
    profile.pref === 'either' ? 0.6 : profile.pref === 'self' ? (q.selfEmployable ? 1 : 0.1) : q.selfEmployable ? 0.5 : 1;

  // Duration against her actual life. care_duty and a 600-hour course is a dropout, not a match.
  const hours = q.notionalHours ?? 400;
  const durationVsMobility =
    profile.mobility.constraint === 'care_duty' || profile.mobility.constraint === 'physical'
      ? clamp01(1 - (hours - 80) / 700)
      : clamp01(1 - (hours - 200) / 1200);

  // ₹50,000 / 50% of project cost, conditional on a bank loan (Ch.3 ¶2a.ii).
  const assetGrant = profile.pref !== 'wage' && q.selfEmployable ? 1 : 0;

  // At least 30% women in every skill programme, 15% of grants ring-fenced (Ch.3 ¶4a, ¶4d).
  const womenNudge = opts.isWoman ? 1 : 0;

  // Spread. Concentration is the failure mode, so it is priced in, not merely measured.
  const hist = opts.districtHistogram;
  let concentration = 0;
  if (hist && hist.size > 0) {
    const total = [...hist.values()].reduce((a, b) => a + b, 0) || 1;
    const mine = q.concepts.reduce((acc, c) => acc + (hist.get(c) ?? 0), 0);
    concentration = clamp01(mine / total);
  }

  const components = {
    aspirationFit: Number((w.aspirationFit * aspirationFit).toFixed(4)),
    skillTransfer: Number((w.skillTransfer * skillTransfer).toFixed(4)),
    localOpportunity: Number((w.localOpportunity * localOpportunity).toFixed(4)),
    prefMatch: Number((w.prefMatch * prefMatch).toFixed(4)),
    durationVsMobility: Number((w.durationVsMobility * durationVsMobility).toFixed(4)),
    assetGrant: Number((w.assetGrant * assetGrant).toFixed(4)),
    womenNudge: Number((w.womenNudge * womenNudge).toFixed(4)),
    spreadPenalty: Number((-w.spreadPenalty * concentration).toFixed(4)),
  };
  const total = Number(Object.values(components).reduce((a, b) => a + b, 0).toFixed(4));
  return { total, components };
}

/** One spoken sentence per recommendation. No scheme jargon, no QP codes, no acronyms. */
function explainForBeneficiary(q: Qualification, profile: Profile, route: string | null, centreKm: number | null): string {
  const trade = q.concepts[0] ? conceptLabel(q.concepts[0], 'hi') : q.title;
  const bits: string[] = [];
  const years = profile.occupation?.years ?? 0;
  if (years > 0 && route && /experience/i.test(route)) {
    bits.push(`आपने ${years} साल ${conceptLabel(profile.occupation!.conceptId, 'hi')} का काम किया है — इसके लिए स्कूल की डिग्री नहीं चाहिए`);
  } else if (profile.skills.some((s) => q.concepts.includes(s))) {
    bits.push(`आपने ${trade} सीखने की बात कही थी`);
  }
  const months = q.notionalHours ? Math.max(1, Math.round(q.notionalHours / 150)) : null;
  const where = centreKm !== null ? `${centreKm} किलोमीटर दूर` : 'आपके ब्लॉक में';
  bits.push(`${q.title} — ${months ? `${months} महीने, ` : ''}${where}`);
  bits.push('आप इसके लिए योग्य हैं');
  return bits.join('। ') + '।';
}

export function recommend(profile: Profile, opts: RecommendOptions): RecommendationResult {
  const now = (opts.now ?? (() => new Date()))();
  const weights = opts.weights ?? WEIGHTS;
  const levels = eligibleLevels(profile);
  const ctx: GateContext = { nearestCentreKm: opts.nearestCentreKm, eligibleLevels: levels };

  // ---- STAGE 0: gate every row. Buckets, never a filter that silently drops NEAR_MISS.
  const gated = opts.catalogue.map((q) => ({ q, verdict: gate(q, profile, ctx) }));

  // ---- STAGE 1: retrieval over the ELIGIBLE set only, then STAGE 2 rank.
  const build = (q: Qualification, verdict: ReturnType<typeof gate>): ScoredQualification => {
    const { total, components } = score(q, profile, { ...opts, weights });
    const centreKm = opts.nearestCentreKm?.(q) ?? null;
    const category = giaCategory(q.notionalHours, profile.education);
    return {
      qualification: q,
      gate: verdict,
      score: total,
      components,
      explain: {
        beneficiary:
          verdict.bucket === 'NEAR_MISS' && verdict.gap
            ? `${q.title} — ${verdict.gap.needLocal ?? verdict.gap.need}`
            : explainForBeneficiary(q, profile, verdict.route, centreKm),
        officer: [
          `${q.title} (${q.levelLabel}, ${q.sector})`,
          `GIA category ${category}`,
          verdict.route ? `entry route: ${verdict.route}` : `bucket: ${verdict.bucket}`,
          ...verdict.reasons,
        ].join(' · '),
        auditor: {
          localId: q.localId,
          qpCode: q.qpCode,
          qualificationSource: q.source,
          qualificationSourceDate: q.sourceDate,
          bucket: verdict.bucket,
          entryRoute: verdict.route,
          gap: verdict.gap,
          inputs: {
            education: profile.education,
            occupation: profile.occupation,
            skills: profile.skills,
            mobility: profile.mobility,
            pref: profile.pref,
            localDemand: profile.localDemand,
            district: profile.districtName,
            block: profile.blockName,
          },
          components,
          score: total,
          weightsVersion: weights.version,
          engineVersion: ENGINE_VERSION,
          nqrSnapshotSha: opts.nqrSnapshotSha ?? null,
          scoredAt: now.toISOString(),
        },
      },
    };
  };

  const eligible = gated
    .filter((g) => g.verdict.bucket === 'ELIGIBLE')
    .map(({ q, verdict }) => build(q, verdict))
    .sort((a, b) => b.score - a.score);

  const nearMiss = gated
    .filter((g) => g.verdict.bucket === 'NEAR_MISS')
    .map(({ q, verdict }) => build(q, verdict))
    .sort((a, b) => b.score - a.score);

  const top = eligible.slice(0, opts.topN ?? 3);

  // ---- STAGE 0.5: PM-DAKSH routing, evaluated against the match we would otherwise fund.
  const routeToPmDaksh = pmDakshRoute(profile, top[0]?.qualification.level ?? null);

  // ---- scheme hooks the guidelines make compulsory (spec §9 MINOR 4).
  const needsFinancialLiteracy = top.length > 0; // Ch.3 ¶7A.a.iv — EVERY course must carry it.
  const assetGrantEligible =
    profile.pref !== 'wage' && top.some((t) => t.qualification.selfEmployable);

  const relevantOpportunities = (opts.opportunities ?? []).filter((o) =>
    top.some((t) => t.qualification.concepts.includes(o.conceptId)) ||
    nearMiss.slice(0, 1).some((t) => t.qualification.concepts.includes(o.conceptId)),
  );

  return {
    top,
    nearMiss: nearMiss.slice(0, 1),
    routeToPmDaksh,
    needsFinancialLiteracy,
    assetGrantEligible,
    opportunities: relevantOpportunities,
    weightsVersion: weights.version,
    engineVersion: ENGINE_VERSION,
    nqrSnapshotSha: opts.nqrSnapshotSha ?? null,
    containsPrototypeData: [...top, ...nearMiss.slice(0, 1)].some(
      (t) => t.qualification.source === 'PROTOTYPE_PENDING_NQR_IMPORT',
    ),
    createdAt: now.toISOString(),
  };
}

/**
 * The spread measurement, for the officer console and for the slide.
 *
 * Returns the share held by the top N concepts, which is the exact statistic CAG used
 * ("40% of all certifications in 10 job-roles"). If our own number looks like theirs, we
 * automated the failure with better UX.
 */
export function spreadReport(
  histogram: Map<string, number>,
  topN = 10,
): { total: number; distinct: number; topShare: number; rows: { conceptId: string; label: string; count: number; share: number }[] } {
  const total = [...histogram.values()].reduce((a, b) => a + b, 0);
  const rows = [...histogram.entries()]
    .map(([conceptId, count]) => ({
      conceptId,
      label: conceptLabel(conceptId, 'en'),
      count,
      share: total > 0 ? count / total : 0,
    }))
    .sort((a, b) => b.count - a.count);
  const topShare = rows.slice(0, topN).reduce((a, r) => a + r.share, 0);
  return { total, distinct: rows.length, topShare, rows };
}
