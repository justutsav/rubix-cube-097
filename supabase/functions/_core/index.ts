// GENERATED FILE — DO NOT EDIT.
// Copied from packages/core/src/index.ts by scripts/vendor_core.py.
// Edit the original; this copy is re-synced on every deploy.

/**
 * @rc097/core — the interview engine.
 *
 * "The single most important sentence in this spec: the FSM, the extractor and the recommender
 * do not know which channel they are serving." (spec §0)
 *
 * Nothing in this package imports a browser API, a Node API, a database driver or an HTTP
 * client. It runs unchanged in:
 *   · the React PWA, in a Capacitor WebView, with the aeroplane mode on
 *   · a Supabase edge function (Deno)
 *   · the Node service holding an Exotel AgentStream WebSocket
 *
 * If it ever needs `fetch`, the dependency is passed in. That is the rule that keeps the seven
 * questions from existing in four slightly different versions by day three.
 */

export * from './types.ts';
export * from './phonetic.ts';
export * from './lexicon.ts';
export * from './extract.ts';
export * from './nsqf.ts';
export * from './gate.ts';
export * from './recommend.ts';
export * from './prompts.ts';
export * from './fsm.ts';
export { QUALIFICATIONS, NQR_SNAPSHOT_SHA, catalogueStats } from './data/qualifications.ts';
export { DISTRICTS, OPPORTUNITIES, isSourced, provenanceReport, haversineKm, type DistrictSeed } from './data/districts.ts';

export const CORE_VERSION = '0.1.0';

/**
 * Requirement coverage, computed rather than asserted, so the claim cannot rot.
 *
 * R1-R9 come from docs/PROBLEM-STATEMENT.md §"What the wording binds us to". The point of
 * computing it here is that the officer console can render it and nobody has to trust a README.
 */
export function requirementCoverage() {
  return [
    { id: 'R1', requirement: 'Voice conversation replaces the form', status: 'COVERED', where: 'fsm.ts — every field is spoken; the form never exists' },
    { id: 'R2', requirement: 'Regional languages AND dialects', status: 'PARTIAL', where: 'prompts.ts authors hi/bho/mag/cgh/ta · extract.ts absorbs dialect error in the lexicon. PARTIAL until the 30-utterance measurement exists — decisions.md says we publish the measurement, and until then R2 is a claim' },
    { id: 'R3', requirement: 'Seven named interview fields, verbatim and in order', status: 'COVERED', where: 'types.ts FieldNo 1-7 · fsm.ts FIELD_STATES. Q0 is registration metadata, not an eighth field' },
    { id: 'R4', requirement: 'Four named outputs incl. skill gaps', status: 'COVERED', where: 'recommend.ts — top[] (training), concepts (trades), gate.gap (skill gaps), opportunities (region-specific)' },
    { id: 'R5', requirement: 'Three deployment channels named', status: 'COVERED', where: 'services/telephony (IVR + WhatsApp) · web/app (kiosk/app + assisted). One core, four transports' },
    { id: 'R6', requirement: 'Low-connectivity and low-tech operation', status: 'COVERED', where: 'core has zero IO · app ships an offline store and an outbox · ladder degrades without the LLM' },
    { id: 'R7', requirement: 'Empathetic and conversational, not administrative', status: 'PARTIAL', where: 'prompts.ts register is domestic, and DEFER/re-ask never scolds. PARTIAL until a native speaker signs off — see promptCoverage()' },
    { id: 'R8', requirement: 'An application / the app', status: 'COVERED', where: 'web/app via Capacitor — one of four surfaces, not the product' },
    { id: 'R9', requirement: 'The five Basic Issues under GIA', status: 'PARTIAL', where: 'BI-1 perspective_plan · BI-2 needsFinancialLiteracy + assetGrantEligible · BI-3 outcome table · BI-4 pmDakshRoute + convergence export · BI-5 assisted mode. PARTIAL: the Perspective Plan must match the real portal format, which nobody has opened by hand yet' },
  ] as const;
}
