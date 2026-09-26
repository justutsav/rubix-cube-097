/**
 * The shapes every channel and both persistence layers agree on.
 *
 * Nothing in here knows whether it is running in a browser on a ₹6,000 Android phone with no
 * network, in a Supabase edge function, or in the Node process holding an Exotel WebSocket
 * open. That is the point (spec §0).
 */

export type Channel = 'ivr' | 'whatsapp' | 'app';

/** Locales we author prompts for. `bho`/`mag`/`raj`/`cgh` have NO ASR model — see decisions.md. */
export type Locale = 'hi' | 'mai' | 'bho' | 'mag' | 'raj' | 'cgh' | 'ta' | 'en';

export const SPOKEN_LOCALES: Locale[] = ['hi', 'mai', 'bho', 'mag', 'raj', 'cgh', 'ta', 'en'];

/**
 * Locales with a real ASR model behind them. The rest ride on the Hindi model plus the lexicon.
 *
 * Maithili sits in the first group and the other four do not, and the reason is constitutional
 * rather than technical: Maithili is in the Eighth Schedule, so Sarvam and Bhashini both carry it
 * (`mai-IN`). Bhojpuri (5.05 crore speakers), Rajasthani (2.58 cr), Chhattisgarhi (1.62 cr) and
 * Magahi (1.27 cr) are non-scheduled, and there is no commercial or open model for any of them —
 * about 11 crore speakers with zero coverage. That gap is the whole reason the extraction ladder
 * exists, and it is measured rather than papered over.
 */
export const ASR_BACKED_LOCALES: Locale[] = ['hi', 'mai', 'ta', 'en'];

// ---------------------------------------------------------------------------- FSM

/**
 * Panel 7. Q0 is registration metadata, not an eighth PS field, so "seven fields, verbatim,
 * in order" stays literally true (spec §9 BLOCKER 3).
 */
export type FsmState =
  | 'ENTRY'
  | 'LANG_SELECT'
  | 'Q0_VILLAGE_BLOCK'
  | 'CONSENT'
  | 'IDENTIFY'
  | 'RESUME_GATE'
  | 'Q1_EDUCATION'
  | 'Q2_FAMILY_OCCUPATION'
  /** Internal second half of field 2 — the trade, then the years. Still one PS field. */
  | 'Q2_YEARS'
  | 'Q3_CURRENT_LIVELIHOOD'
  | 'Q4_SKILLS_INTERESTS'
  | 'Q5_MOBILITY_CONSTRAINT'
  | 'GUARDIAN_CHECK'
  | 'Q6_EMPLOYMENT_PREF'
  | 'Q7_LOCAL_ECONOMY'
  | 'READBACK'
  | 'RECOMMEND'
  | 'NEXT_STEP'
  | 'CLOSE'
  | 'CLOSE_POLITE';

/** The five-state sub-machine every Qn runs (panel 7, right half). */
export type Phase = 'ASK' | 'LISTEN' | 'CONFIRM' | 'RE_ASK' | 'DTMF_FALLBACK';

export type ConsentState =
  | 'NONE'
  | 'GIVEN'
  | 'GUARDIAN_PENDING'
  | 'GUARDIAN_GIVEN'
  | 'WITHDRAWN';

export type SessionStatus = 'ACTIVE' | 'RESUMABLE' | 'COMPLETED' | 'ABANDONED';

// ---------------------------------------------------------------------------- answers

/** Q1. Ordinal grade equivalents live in nsqf.ts — this is the closed set the PS implies. */
export type Education =
  | 'none'
  | 'read_write'
  | 'primary'      // 1-5
  | 'middle'       // 6-8
  | 'secondary'    // 10
  | 'higher_sec'   // 12
  | 'iti_diploma'
  | 'graduate_plus';

export type LivelihoodStatus = 'wage' | 'self' | 'casual' | 'none';
export type EmploymentPref = 'self' | 'wage' | 'either';
export type MobilityConstraint = 'none' | 'distance' | 'physical' | 'care_duty';

export type FieldNo = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type AnswerValue =
  | { kind: 'education'; education: Education }
  | { kind: 'occupation'; conceptId: string; years: number }
  | { kind: 'livelihood'; conceptId: string | null; status: LivelihoodStatus }
  | { kind: 'concepts'; conceptIds: string[] }
  | { kind: 'mobility'; constraint: MobilityConstraint; radiusKm: number }
  | { kind: 'pref'; pref: EmploymentPref }
  | { kind: 'local'; conceptIds: string[]; note: string | null };

/** How the value was obtained. Ladder rung, logged on every row (panel 8). */
export type ExtractMethod = 'DTMF' | 'LEXICON' | 'REGEX' | 'LLM' | 'OPERATOR' | 'TAP';

export interface Answer {
  beneficiaryId: string;
  fieldNo: FieldNo;
  /**
   * Kept only until CONFIRM, then erased (spec §9 MAJOR 5). `null` here on a confirmed row is
   * the correct, compliant state — not missing data.
   */
  rawTranscript: string | null;
  /** ASR alternates, for post-hoc error analysis. Erased with the transcript. */
  nbest: string[] | null;
  value: AnswerValue;
  confidence: number;
  method: ExtractMethod;
  asrEngine: string | null;
  asrVersion: string | null;
  confirmedAt: string | null;
  sessionId: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------- session

export interface Registration {
  /** Q0. The officer half has no GROUP BY without this. */
  districtName: string | null;
  districtLgd: number | null;
  blockName: string | null;
  blockLgd: number | null;
  villageName: string | null;
}

export interface SessionState {
  sessionId: string;
  beneficiaryId: string;
  channel: Channel;
  channelRef: string | null;
  locale: Locale;
  state: FsmState;
  phase: Phase;
  /** Re-asks used on the current field. Two, then DTMF, then DEFER (panel 7). */
  reAskCount: number;
  /** Fields left unconfirmed by DEFER. A deferred field is a resumable field. */
  deferred: FieldNo[];
  consentState: ConsentState;
  /** Set at CONSENT by DTMF. Never revealed, never read back before it clears (panel 6). */
  resumePin: string | null;
  pinAttempts: number;
  /** Which channels the beneficiary has been told about. Drives the §9 MINOR 1 restatement. */
  noticedChannels: Channel[];
  registration: Registration;
  answers: Partial<Record<FieldNo, Answer>>;
  /** Set when a prior profile was picked up rather than started fresh. */
  resumedFrom: FsmState | null;
  status: SessionStatus;
  /** Field the readback is currently correcting, if any. */
  readbackCursor: FieldNo | null;
  startedAt: string;
  lastTurnAt: string;
}

// ---------------------------------------------------------------------------- turn contract

/** spec §1.1 — one endpoint, called identically by all three adapters. */
export type Utterance =
  | { kind: 'opened' }
  | { kind: 'audio'; transcripts: string[]; asrEngine: string; asrVersion: string; format?: string; rate?: number }
  | { kind: 'text'; value: string }
  | { kind: 'dtmf'; digits: string }
  /** On-screen choice. Confidence 1.0, method TAP — the app channel's DTMF equivalent. */
  | { kind: 'choice'; optionId: string }
  | { kind: 'timeout' }
  | { kind: 'hangup'; reason?: string };

export interface TurnRequest {
  channel: Channel;
  channelRef: string | null;
  identity: { kind: 'msisdn_hash' | 'device'; value: string };
  utterance: Utterance;
  localeHint?: Locale;
  /** app channel only — the interview may have happened days before the sync. */
  offlineCapturedAt?: string;
}

export type SayRef =
  /** Resolves to a WAV on the IVR box, a Meta media id on WhatsApp, an APK asset in the app. */
  | { kind: 'prerendered'; id: string; text: string; durationMs?: number }
  /** Only the personalised tail. Everything fixed is pre-rendered (decisions.md). */
  | { kind: 'tts'; text: string };

export interface ExpectOption {
  id: string;
  label: string;
  /** Devanagari/Tamil label for the same option, when authored. */
  labelLocal?: string;
  dtmf?: string;
  icon?: string;
}

export interface Expect {
  kind: 'enum' | 'open' | 'number' | 'pin' | 'none';
  options?: ExpectOption[];
  dtmfMap?: Record<string, string>;
  timeoutMs: number;
  /** Renderer hint for register A: one big column, or a 2-up grid of icons. */
  layout?: 'stack' | 'grid';
}

/**
 * What the core wants persisted. The core performs no IO; the caller applies these against
 * IndexedDB (app, offline) or Postgres (server). Same list, two backends, no drift.
 */
export type DomainEvent =
  | { type: 'session.upsert'; session: SessionState }
  | { type: 'answer.upsert'; answer: Answer }
  | { type: 'answer.confirmed'; beneficiaryId: string; fieldNo: FieldNo; at: string }
  | { type: 'transcript.erase'; beneficiaryId: string; fieldNo: FieldNo; reason: 'CONFIRMED' }
  | { type: 'registration.upsert'; beneficiaryId: string; registration: Registration }
  | {
      type: 'consent.record';
      beneficiaryId: string;
      kind: 'SPOKEN_YES' | 'DTMF_YES' | 'GUARDIAN_YES' | 'WITHDRAWN';
      scriptVersion: string;
      channel: Channel;
      evidence: Record<string, unknown>;
      at: string;
    }
  | { type: 'recommendation.create'; beneficiaryId: string; result: RecommendationResult; at: string }
  | { type: 'outcome.upsert'; beneficiaryId: string; qualificationRef: string; status: OutcomeStatus; at: string }
  | { type: 'telemetry.turn'; sessionId: string; state: FsmState; method: ExtractMethod | null; latencyMs: number | null };

export interface TurnResult {
  session: SessionState;
  say: SayRef[];
  expect: Expect;
  events: DomainEvent[];
  turnBudgetMs: number;
  terminal: boolean;
  /** Populated on the RECOMMEND turn so the channel can render cards, not just speak. */
  recommendation?: RecommendationResult;
  /** Beads for the progress indicator: which of the 7 are confirmed. */
  progress: { confirmed: FieldNo[]; deferred: FieldNo[]; total: 7 };
}

// ---------------------------------------------------------------------------- lexicon

export interface LexiconEntry {
  conceptId: string;
  canonical: Record<string, string>;
  surface: string[];
  /** Dialect-specific surface forms. The dialect answer lives here, not in a model. */
  dialect?: Partial<Record<Locale, string[]>>;
  /** NCO-2015 is a SIGNAL ONLY — NCVET found 156/2157 mis-mapped, 256 unmappable. */
  nco2015?: string[];
  /** Imported from the official NQR, never invented. Empty until the import runs. */
  nqrCodes?: string[];
  /** Annexure I domain of the PM-AJAY guidelines, where the trade is fundable at all. */
  annexureDomain?: string;
  /** Broad grouping used by the recommender's spread metric. */
  family?: string;
  icon?: string;
}

// ---------------------------------------------------------------------------- qualifications

export type ProvenanceTag =
  /** Row came from the official NQR export, sha-stamped. */
  | 'NQR_OFFICIAL'
  /** Row was typed to make the prototype runnable. qpCode is NULL. Never shown as official. */
  | 'PROTOTYPE_PENDING_NQR_IMPORT';

export interface Qualification {
  /** Local key. NOT a QP code, and never rendered as one. */
  localId: string;
  /**
   * The official code. `null` until the NQR import has run — decisions.md 2026-09-25:
   * fields the source does not provide are NULL, not guessed. No invented QP codes, ever.
   */
  qpCode: string | null;
  title: string;
  sector: string;
  /** Official string form, e.g. "Level 4.5". Half-levels are real. */
  levelLabel: string;
  level: number;
  notionalHours: number | null;
  delivery: { theory: number; practical: number; employability: number; ojtMandatory: number } | null;
  validTill: string | null;
  awardingBody: string | null;
  concepts: string[];
  /** Only 25 of 1,199 valid ≤L4 rows are entrepreneurship-shaped (research/03-nqr-import.md). */
  selfEmployable: boolean;
  /** Physical demand floor, for the Q5 gate. */
  physicalDemand: 'low' | 'moderate' | 'high';
  source: ProvenanceTag;
  sourceDate: string;
}

// ---------------------------------------------------------------------------- recommender

export type GateBucket = 'ELIGIBLE' | 'NEAR_MISS' | 'INELIGIBLE';

export interface GateVerdict {
  bucket: GateBucket;
  /** The entry route that admitted them, in words, for the officer explanation. */
  route: string | null;
  /** NEAR_MISS only: the exact gap. This IS R4's fourth output. */
  gap: { kind: 'years' | 'grade' | 'level_step' | 'distance'; need: string; needLocal?: string } | null;
  reasons: string[];
}

export interface ScoredQualification {
  qualification: Qualification;
  gate: GateVerdict;
  score: number;
  /** Per-component contributions, so the auditor explanation is arithmetic, not vibes. */
  components: Record<string, number>;
  explain: {
    beneficiary: string;
    beneficiaryLocal?: string;
    officer: string;
    auditor: Record<string, unknown>;
  };
}

export type OutcomeStatus = 'RECOMMENDED' | 'ENROLLED' | 'CERTIFIED' | 'PLACED' | 'DROPPED';

export interface RecommendationResult {
  top: ScoredQualification[];
  /** Exactly what "skill gaps requiring intervention" means (R4, output 4). */
  nearMiss: ScoredQualification[];
  /** Stage 0.5 — the guidelines forbid PM-AJAY/PM-DAKSH overlap by name. */
  routeToPmDaksh: { route: boolean; reason: string; stipendPerMonth: number } | null;
  /** Ch.3 ¶7A.a.iv — every course must carry it. §9 MINOR 4. */
  needsFinancialLiteracy: boolean;
  /** ₹50,000 or 50% of project cost, conditional on a bank loan. §9 MINOR 4. */
  assetGrantEligible: boolean;
  opportunities: DistrictOpportunity[];
  weightsVersion: string;
  engineVersion: string;
  nqrSnapshotSha: string | null;
  /** True when any input row is a prototype row. The UI must say so out loud. */
  containsPrototypeData: boolean;
  createdAt: string;
}

export interface DistrictOpportunity {
  districtName: string;
  blockName: string | null;
  conceptId: string;
  kind: 'employer' | 'enterprise' | 'centre' | 'scheme';
  title: string;
  detail: string | null;
  distanceKm: number | null;
  /** Every row carries these two or it does not ship (decisions.md 2026-09-25). */
  source: string;
  sourceDate: string | null;
}

export interface Weights {
  version: string;
  aspirationFit: number;
  skillTransfer: number;
  localOpportunity: number;
  prefMatch: number;
  durationVsMobility: number;
  assetGrant: number;
  womenNudge: number;
  /** Penalty applied per unit of concentration, so output spread is a first-class objective. */
  spreadPenalty: number;
}
