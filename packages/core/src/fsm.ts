/**
 * The interview FSM (panel 7). Seven mandated fields, in the PS's order, as an explicit state
 * machine — not an agent.
 *
 * Why this is not an LLM conducting the interview (decisions.md 2026-09-25): every turn is
 * replayable, every extraction is a logged `(transcript → value, confidence)` pair, and the
 * model can never invent an eighth question in front of a jury. When CAG audits this in 2029,
 * the answer to "why was this person asked that" is a row, not a prompt.
 *
 * The core performs no IO. `turn()` is a pure-ish function of (session, utterance) → (next
 * session, what to say, what to expect, a list of DomainEvents to persist). The app applies
 * those events to IndexedDB/SQLite offline; the edge function applies the identical list to
 * Postgres. One implementation, two backends, and they cannot drift.
 */

import {
  CONF_HIGH,
  CONF_LOW,
  extractEducation,
  extractRadiusKm,
  extractYears,
  extractYesNo,
  matchConcepts,
  type LlmClassifier,
} from './extract.js';
import { conceptLabel, LEXICON } from './lexicon.js';
import { CONSENT_SCRIPT_VERSION, say } from './prompts.js';
import { recommend, type RecommendOptions } from './recommend.js';
import type { Profile } from './gate.js';
import type {
  Answer,
  AnswerValue,
  Channel,
  DistrictOpportunity,
  DomainEvent,
  Education,
  Expect,
  ExpectOption,
  ExtractMethod,
  FieldNo,
  FsmState,
  Locale,
  Qualification,
  SayRef,
  SessionState,
  TurnRequest,
  TurnResult,
  Utterance,
} from './types.js';

export const TURN_BUDGET_MS = 1800;

export interface TurnDeps {
  catalogue: Qualification[];
  opportunities?: DistrictOpportunity[];
  /** Rung 3. Absent on the offline kiosk, and the ladder degrades to a re-ask instead of failing. */
  llm?: LlmClassifier;
  districtHistogram?: Map<string, number>;
  nearestCentreKm?: RecommendOptions['nearestCentreKm'];
  nqrSnapshotSha?: string | null;
  now?: () => Date;
  uuid?: () => string;
  /** Resolve a spoken village/block against the LGD list. Names are a closed set per state. */
  resolvePlace?: (text: string, hypotheses: string[]) =>
    | { villageName: string; blockName: string | null; districtName: string | null; blockLgd: number | null; districtLgd: number | null; confidence: number }
    | null;
}

const uuidFallback = (): string =>
  globalThis.crypto?.randomUUID?.() ?? `id_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;

// ---------------------------------------------------------------------------- order of states

/** The one place the interview order is written down. Everything else derives from it. */
const FIELD_STATES: Record<FieldNo, FsmState> = {
  1: 'Q1_EDUCATION',
  2: 'Q2_FAMILY_OCCUPATION',
  3: 'Q3_CURRENT_LIVELIHOOD',
  4: 'Q4_SKILLS_INTERESTS',
  5: 'Q5_MOBILITY_CONSTRAINT',
  6: 'Q6_EMPLOYMENT_PREF',
  7: 'Q7_LOCAL_ECONOMY',
};

const STATE_FIELD: Partial<Record<FsmState, FieldNo>> = {
  Q1_EDUCATION: 1,
  Q2_FAMILY_OCCUPATION: 2,
  Q2_YEARS: 2,
  Q3_CURRENT_LIVELIHOOD: 3,
  Q4_SKILLS_INTERESTS: 4,
  Q5_MOBILITY_CONSTRAINT: 5,
  Q6_EMPLOYMENT_PREF: 6,
  Q7_LOCAL_ECONOMY: 7,
};

const PROMPT_PREFIX: Partial<Record<FsmState, string>> = {
  Q0_VILLAGE_BLOCK: 'q0',
  Q1_EDUCATION: 'q1',
  Q2_FAMILY_OCCUPATION: 'q2',
  Q3_CURRENT_LIVELIHOOD: 'q3',
  Q4_SKILLS_INTERESTS: 'q4',
  Q5_MOBILITY_CONSTRAINT: 'q5',
  Q6_EMPLOYMENT_PREF: 'q6',
  Q7_LOCAL_ECONOMY: 'q7',
};

export function startSession(args: {
  beneficiaryId?: string;
  sessionId?: string;
  channel: Channel;
  channelRef?: string | null;
  locale?: Locale;
  now?: () => Date;
  uuid?: () => string;
}): SessionState {
  const now = (args.now ?? (() => new Date()))().toISOString();
  const uuid = args.uuid ?? uuidFallback;
  return {
    sessionId: args.sessionId ?? uuid(),
    beneficiaryId: args.beneficiaryId ?? uuid(),
    channel: args.channel,
    channelRef: args.channelRef ?? null,
    locale: args.locale ?? 'hi',
    state: 'ENTRY',
    phase: 'ASK',
    reAskCount: 0,
    deferred: [],
    consentState: 'NONE',
    resumePin: null,
    pinAttempts: 0,
    noticedChannels: [],
    registration: { districtName: null, districtLgd: null, blockName: null, blockLgd: null, villageName: null },
    answers: {},
    resumedFrom: null,
    status: 'ACTIVE',
    readbackCursor: null,
    startedAt: now,
    lastTurnAt: now,
  };
}

/**
 * Where to pick a returning beneficiary up. Confirmed answers are immutable within a profile
 * version; only unconfirmed fields are ever re-asked (spec §1.2). This is the mechanism that
 * lets a dropped IVR call finish on a kiosk three days later.
 */
export function planResume(answers: Partial<Record<FieldNo, Answer>>): FsmState | null {
  for (const n of [1, 2, 3, 4, 5, 6, 7] as FieldNo[]) {
    const a = answers[n];
    if (!a || !a.confirmedAt) return FIELD_STATES[n];
  }
  return null; // all seven confirmed — offer the saved recommendation instead
}

// ---------------------------------------------------------------------------- option sets

const EDU_OPTIONS: ExpectOption[] = [
  { id: 'none', label: 'Never went to school', labelLocal: 'स्कूल नहीं गए', dtmf: '1', icon: '🚫' },
  { id: 'primary', label: 'Up to class 5', labelLocal: 'पाँचवीं तक', dtmf: '2', icon: '5️⃣' },
  { id: 'middle', label: 'Up to class 8', labelLocal: 'आठवीं तक', dtmf: '3', icon: '8️⃣' },
  { id: 'secondary', label: 'Class 10', labelLocal: 'दसवीं', dtmf: '4', icon: '🔟' },
  { id: 'higher_sec', label: 'Class 12', labelLocal: 'बारहवीं', dtmf: '5', icon: '📘' },
  { id: 'iti_diploma', label: 'ITI or diploma', labelLocal: 'आईटीआई / डिप्लोमा', dtmf: '6', icon: '🎓' },
  { id: 'read_write', label: 'Can read and write only', labelLocal: 'सिर्फ़ पढ़-लिख सकते हैं', dtmf: '7', icon: '✍️' },
];

const LIVELIHOOD_OPTIONS: ExpectOption[] = [
  { id: 'wage', label: 'Work for someone else', labelLocal: 'किसी और के यहाँ काम', dtmf: '1', icon: '👥' },
  { id: 'self', label: 'My own work', labelLocal: 'अपना काम', dtmf: '2', icon: '🏠' },
  { id: 'casual', label: 'Daily wage', labelLocal: 'दिहाड़ी', dtmf: '3', icon: '📅' },
  { id: 'none', label: 'Nothing right now', labelLocal: 'अभी कुछ नहीं', dtmf: '4', icon: '➖' },
];

const MOBILITY_OPTIONS: ExpectOption[] = [
  { id: 'none:3', label: 'Inside the village', labelLocal: 'गाँव के अंदर', dtmf: '1', icon: '🏡' },
  { id: 'distance:5', label: 'Up to 5 km', labelLocal: '5 किलोमीटर तक', dtmf: '2', icon: '🚶' },
  { id: 'distance:10', label: 'Up to 10 km', labelLocal: '10 किलोमीटर तक', dtmf: '3', icon: '🚲' },
  { id: 'distance:30', label: 'Further is fine', labelLocal: 'दूर भी चलेगा', dtmf: '4', icon: '🚌' },
  { id: 'care_duty:5', label: 'Responsibilities at home', labelLocal: 'घर की ज़िम्मेदारी', dtmf: '5', icon: '👶' },
  { id: 'physical:5', label: 'A health limitation', labelLocal: 'सेहत की दिक्कत', dtmf: '6', icon: '🩹' },
];

const PREF_OPTIONS: ExpectOption[] = [
  { id: 'self', label: 'My own work', labelLocal: 'अपना काम', dtmf: '1', icon: '🏪' },
  { id: 'wage', label: 'A job', labelLocal: 'नौकरी', dtmf: '2', icon: '🧑‍🏭' },
  { id: 'either', label: 'Either is fine', labelLocal: 'दोनों चलेगा', dtmf: '3', icon: '🤝' },
];

const YES_NO: ExpectOption[] = [
  { id: 'yes', label: 'Yes', labelLocal: 'हाँ', dtmf: '1', icon: '✅' },
  { id: 'no', label: 'No', labelLocal: 'नहीं', dtmf: '2', icon: '↩️' },
];

const TRADE_OPTIONS: ExpectOption[] = LEXICON.slice(0, 12).map((e, i) => ({
  id: e.conceptId,
  label: e.canonical.en ?? e.conceptId,
  labelLocal: e.canonical.hi,
  dtmf: String(i + 1),
  icon: e.icon,
}));

// ---------------------------------------------------------------------------- helpers

function hypothesesOf(u: Utterance): string[] {
  if (u.kind === 'audio') return u.transcripts.filter(Boolean);
  if (u.kind === 'text') return [u.value];
  return [];
}

function asrOf(u: Utterance): { engine: string | null; version: string | null } {
  return u.kind === 'audio' ? { engine: u.asrEngine, version: u.asrVersion } : { engine: null, version: null };
}

/** One human sentence per answer, for the readback and for the officer's screen. */
export function describeAnswer(value: AnswerValue, locale: Locale = 'hi'): string {
  switch (value.kind) {
    case 'education': {
      const opt = EDU_OPTIONS.find((o) => o.id === value.education);
      return (locale === 'en' ? opt?.label : opt?.labelLocal) ?? value.education;
    }
    case 'occupation':
      return locale === 'en'
        ? `${conceptLabel(value.conceptId, 'en')}, ${value.years} years`
        : `${conceptLabel(value.conceptId, 'hi')} — ${value.years} साल`;
    case 'livelihood': {
      const opt = LIVELIHOOD_OPTIONS.find((o) => o.id === value.status);
      const label = (locale === 'en' ? opt?.label : opt?.labelLocal) ?? value.status;
      return value.conceptId ? `${conceptLabel(value.conceptId, locale)} (${label})` : label;
    }
    case 'concepts':
      return value.conceptIds.map((c) => conceptLabel(c, locale)).join(', ') || '—';
    case 'mobility': {
      const opt = MOBILITY_OPTIONS.find((o) => o.id === `${value.constraint}:${value.radiusKm}`);
      if (opt) return (locale === 'en' ? opt.label : opt.labelLocal) ?? opt.label;
      return locale === 'en' ? `${value.radiusKm} km, ${value.constraint}` : `${value.radiusKm} किलोमीटर तक`;
    }
    case 'pref': {
      const opt = PREF_OPTIONS.find((o) => o.id === value.pref);
      return (locale === 'en' ? opt?.label : opt?.labelLocal) ?? value.pref;
    }
    case 'local':
      return value.conceptIds.map((c) => conceptLabel(c, locale)).join(', ') || value.note || '—';
  }
}

function progressOf(s: SessionState) {
  const confirmed = ([1, 2, 3, 4, 5, 6, 7] as FieldNo[]).filter((n) => s.answers[n]?.confirmedAt);
  return { confirmed, deferred: s.deferred, total: 7 as const };
}

function prompt(id: string, s: SessionState, vars: Record<string, string | number> = {}): SayRef {
  const p = say(id, s.locale, vars);
  return { kind: 'prerendered', id: p.id, text: p.text };
}

const NO_EXPECT: Expect = { kind: 'none', timeoutMs: 0 };
const OPEN_EXPECT: Expect = { kind: 'open', timeoutMs: 6000 };

function enumExpect(options: ExpectOption[], layout: 'stack' | 'grid' = 'stack'): Expect {
  return {
    kind: 'enum',
    options,
    dtmfMap: Object.fromEntries(options.filter((o) => o.dtmf).map((o) => [o.dtmf!, o.id])),
    timeoutMs: 8000,
    layout,
  };
}

// ---------------------------------------------------------------------------- extraction per field

interface Extracted {
  value: AnswerValue;
  confidence: number;
  method: ExtractMethod;
  matchedOn: string;
  /** Q2 only: the trade landed but the years are still missing. */
  needsYears?: boolean;
}

async function extractForState(
  state: FsmState,
  u: Utterance,
  s: SessionState,
  deps: TurnDeps,
): Promise<Extracted | null> {
  const hyps = hypothesesOf(u);
  const field = STATE_FIELD[state];

  // Rung 0 — DTMF / on-screen tap. ₹0, 0 ms, 0 WER. Always trusted.
  if (u.kind === 'dtmf' || u.kind === 'choice') {
    const id = u.kind === 'choice' ? u.optionId : resolveDtmf(state, u.digits);
    if (id) {
      const v = valueFromOptionId(state, id, s);
      if (v) return { value: v.value, confidence: 1, method: u.kind === 'choice' ? 'TAP' : 'DTMF', matchedOn: id, needsYears: v.needsYears };
    }
    return null;
  }

  if (hyps.length === 0) return null;

  switch (state) {
    case 'Q1_EDUCATION': {
      const edu = extractEducation(hyps); // rung 2, regex over ordinals
      if (edu) return { value: { kind: 'education', education: edu.education }, confidence: edu.confidence, method: 'REGEX', matchedOn: edu.matchedOn };
      break;
    }
    case 'Q2_FAMILY_OCCUPATION': {
      const m = matchConcepts(hyps)[0]; // rung 1, lexicon
      if (m) {
        const y = extractYears(hyps[0]); // the years often arrive in the same breath
        return {
          value: { kind: 'occupation', conceptId: m.conceptId, years: y?.years ?? 0 },
          confidence: y ? Math.min(m.confidence, 0.95) : m.confidence,
          method: 'LEXICON',
          matchedOn: y ? `${m.matchedOn} + ${y.matchedOn}` : m.matchedOn,
          needsYears: !y,
        };
      }
      break;
    }
    case 'Q2_YEARS': {
      const y = extractYears(hyps.join(' '));
      const prev = s.answers[2];
      if (y && prev && prev.value.kind === 'occupation') {
        return {
          value: { kind: 'occupation', conceptId: prev.value.conceptId, years: y.years },
          confidence: 0.9,
          method: 'REGEX',
          matchedOn: y.matchedOn,
        };
      }
      break;
    }
    case 'Q3_CURRENT_LIVELIHOOD': {
      const m = matchConcepts(hyps)[0];
      const r = hyps.join(' ');
      const status = /apna|khud|self|अपना|खुद/i.test(r)
        ? 'self'
        : /dihadi|dihaadi|daily|दिहाड़ी/i.test(r)
          ? 'casual'
          : /kuch nahi|kuchh nahi|बेकार|कुछ नहीं|nothing/i.test(r)
            ? 'none'
            : m
              ? 'wage'
              : null;
      if (m || status) {
        return {
          value: { kind: 'livelihood', conceptId: m?.conceptId ?? null, status: (status ?? 'wage') as never },
          confidence: m ? m.confidence : 0.7,
          method: m ? 'LEXICON' : 'REGEX',
          matchedOn: m?.matchedOn ?? String(status),
        };
      }
      break;
    }
    case 'Q4_SKILLS_INTERESTS': {
      const ms = matchConcepts(hyps, LEXICON, { maxResults: 3 }).filter((m) => m.confidence >= CONF_LOW);
      if (ms.length > 0) {
        return {
          value: { kind: 'concepts', conceptIds: ms.map((m) => m.conceptId) },
          confidence: ms[0].confidence,
          method: 'LEXICON',
          matchedOn: ms.map((m) => m.matchedOn).join(' | '),
        };
      }
      break;
    }
    case 'Q5_MOBILITY_CONSTRAINT': {
      const r = hyps.join(' ');
      const km = extractRadiusKm(r);
      const constraint = /bimar|बीमार|takleef|तकलीफ़|chal nahi|चल नहीं|health|सेहत|viklang|दिव्यांग/i.test(r)
        ? 'physical'
        : /bachcha|बच्चा|bachche|घर की|saas|बुज़ुर्ग|dekhbhal|देखभाल/i.test(r)
          ? 'care_duty'
          : km !== null
            ? 'distance'
            : /gaon ke andar|गाँव के अंदर|kahin nahi|कहीं नहीं/i.test(r)
              ? 'none'
              : null;
      if (constraint) {
        return {
          value: { kind: 'mobility', constraint, radiusKm: km ?? (constraint === 'none' ? 3 : 5) },
          confidence: km !== null ? 0.88 : 0.72,
          method: km !== null ? 'REGEX' : 'LEXICON',
          matchedOn: `${constraint}${km !== null ? `:${km}km` : ''}`,
        };
      }
      break;
    }
    case 'Q6_EMPLOYMENT_PREF': {
      const r = hyps.join(' ');
      const pref = /apna|khud ka|अपना|खुद का|dukaan|दुकान|business|self/i.test(r)
        ? 'self'
        : /naukri|नौकरी|job|salary|tankha|तनख़ा/i.test(r)
          ? 'wage'
          : /dono|दोनों|either|koi bhi|कोई भी/i.test(r)
            ? 'either'
            : null;
      if (pref) return { value: { kind: 'pref', pref }, confidence: 0.85, method: 'REGEX', matchedOn: pref };
      break;
    }
    case 'Q7_LOCAL_ECONOMY': {
      const ms = matchConcepts(hyps, LEXICON, { maxResults: 3 }).filter((m) => m.confidence >= CONF_LOW);
      return {
        value: { kind: 'local', conceptIds: ms.map((m) => m.conceptId), note: hyps[0] ?? null },
        // A free-text answer we could not map is still a recorded answer; it just scores low and
        // gets confirmed by readback rather than trusted silently.
        confidence: ms.length > 0 ? ms[0].confidence : 0.6,
        method: ms.length > 0 ? 'LEXICON' : 'OPERATOR',
        matchedOn: ms.map((m) => m.matchedOn).join(' | ') || 'free text retained',
      };
    }
  }

  // Rung 3 — small LLM, constrained to the closed set. Uncommon path by design: it costs
  // 400-1200 ms and would blow the 1800 ms budget if it ran on every turn.
  if (deps.llm && field) {
    const options = optionsForState(state);
    if (options.length > 0) {
      const res = await deps.llm({
        transcripts: hyps,
        fieldNo: field,
        question: say(`${PROMPT_PREFIX[state]}.ask.v1`, s.locale).text,
        options: options.map((o) => ({ id: o.id, label: o.label })),
        locale: s.locale,
      });
      if (res?.optionId) {
        const v = valueFromOptionId(state, res.optionId, s);
        if (v) return { value: v.value, confidence: Math.min(res.confidence, 0.84), method: 'LLM', matchedOn: res.optionId, needsYears: v.needsYears };
      }
    }
  }

  return null;
}

function optionsForState(state: FsmState): ExpectOption[] {
  switch (state) {
    case 'Q1_EDUCATION': return EDU_OPTIONS;
    case 'Q2_FAMILY_OCCUPATION': return TRADE_OPTIONS;
    case 'Q3_CURRENT_LIVELIHOOD': return LIVELIHOOD_OPTIONS;
    case 'Q4_SKILLS_INTERESTS': return TRADE_OPTIONS;
    case 'Q5_MOBILITY_CONSTRAINT': return MOBILITY_OPTIONS;
    case 'Q6_EMPLOYMENT_PREF': return PREF_OPTIONS;
    case 'Q7_LOCAL_ECONOMY': return TRADE_OPTIONS;
    default: return [];
  }
}

function resolveDtmf(state: FsmState, digits: string): string | null {
  const opts = optionsForState(state);
  return opts.find((o) => o.dtmf === digits)?.id ?? null;
}

function valueFromOptionId(state: FsmState, id: string, s: SessionState): { value: AnswerValue; needsYears?: boolean } | null {
  // The id must belong to THIS state's option set.
  //
  // Without this check a desynchronised channel could post any id and it would be coerced into
  // an answer: a stray "yes" arriving at Q5 split on ':' and produced
  // `{constraint: "yes", radiusKm: 5}` — a nonsense constraint, stored at confidence 1.0 with
  // method TAP, which then fed the eligibility gate. Closed sets have to be closed at the door.
  if (state !== 'Q2_YEARS') {
    const allowed = optionsForState(state);
    if (allowed.length > 0 && !allowed.some((o) => o.id === id)) return null;
  }
  switch (state) {
    case 'Q1_EDUCATION': return { value: { kind: 'education', education: id as Education } };
    case 'Q2_FAMILY_OCCUPATION': return { value: { kind: 'occupation', conceptId: id, years: 0 }, needsYears: true };
    case 'Q3_CURRENT_LIVELIHOOD': return { value: { kind: 'livelihood', conceptId: null, status: id as never } };
    case 'Q4_SKILLS_INTERESTS': return { value: { kind: 'concepts', conceptIds: [id] } };
    case 'Q5_MOBILITY_CONSTRAINT': {
      const [constraint, km] = id.split(':');
      return { value: { kind: 'mobility', constraint: constraint as never, radiusKm: Number(km) || 5 } };
    }
    case 'Q6_EMPLOYMENT_PREF': return { value: { kind: 'pref', pref: id as never } };
    case 'Q7_LOCAL_ECONOMY': return { value: { kind: 'local', conceptIds: [id], note: null } };
    case 'Q2_YEARS': {
      const prev = s.answers[2];
      if (prev?.value.kind === 'occupation') return { value: { kind: 'occupation', conceptId: prev.value.conceptId, years: Number(id) || 0 } };
      return null;
    }
    default: return null;
  }
}

function nextStateAfter(state: FsmState, s: SessionState): FsmState {
  // A readback correction returns to the readback, not onward through the interview.
  if (s.readbackCursor !== null) return 'READBACK';
  switch (state) {
    case 'Q1_EDUCATION': return 'Q2_FAMILY_OCCUPATION';
    case 'Q2_FAMILY_OCCUPATION': return 'Q2_YEARS';
    case 'Q2_YEARS': return 'Q3_CURRENT_LIVELIHOOD';
    case 'Q3_CURRENT_LIVELIHOOD': return 'Q4_SKILLS_INTERESTS';
    case 'Q4_SKILLS_INTERESTS': return 'Q5_MOBILITY_CONSTRAINT';
    case 'Q5_MOBILITY_CONSTRAINT': {
      // DPDP Rule 11 branches on DECISIONAL CAPACITY, not on disability. It fires only when a
      // physical constraint was actually disclosed, and even then the question asked is about a
      // court/authority/local-level-committee appointment — never "are you disabled".
      const a = s.answers[5];
      if (a?.value.kind === 'mobility' && a.value.constraint === 'physical') return 'GUARDIAN_CHECK';
      return 'Q6_EMPLOYMENT_PREF';
    }
    case 'Q6_EMPLOYMENT_PREF': return 'Q7_LOCAL_ECONOMY';
    case 'Q7_LOCAL_ECONOMY': return 'READBACK';
    default: return 'READBACK';
  }
}

// ---------------------------------------------------------------------------- the turn

export async function turn(session: SessionState, req: TurnRequest, deps: TurnDeps): Promise<TurnResult> {
  const now = (deps.now ?? (() => new Date()))();
  const nowIso = now.toISOString();
  const events: DomainEvent[] = [];
  let s: SessionState = { ...session, lastTurnAt: nowIso, channel: req.channel, channelRef: req.channelRef ?? session.channelRef };
  const u = req.utterance;

  // `s` is reassigned throughout this function, so read it at call time, not at definition time.
  const finish = (say: SayRef[], expect: Expect, terminal = false, recommendation?: TurnResult['recommendation']): TurnResult =>
    result(s, events, say, expect, terminal, recommendation);

  // ---- the call dropped. This is the normal path in rural India, not the error path.
  if (u.kind === 'hangup') {
    s = { ...s, status: s.state === 'CLOSE' ? 'COMPLETED' : 'RESUMABLE' };
    return finish([], NO_EXPECT, true);
  }

  // ---- purpose restatement on a channel the consent notice has not yet covered (§9 MINOR 1).
  const preamble: SayRef[] = [];
  if (s.consentState === 'GIVEN' && !s.noticedChannels.includes(req.channel)) {
    preamble.push(prompt('consent.newchannel.v1', s));
    s = { ...s, noticedChannels: [...s.noticedChannels, req.channel] };
  }

  switch (s.state) {
    // ------------------------------------------------------------------ entry
    case 'ENTRY': {
      s = { ...s, state: 'LANG_SELECT', phase: 'LISTEN' };
      return finish([prompt('lang.select.v1', s)], enumExpect(
        [
          { id: 'hi', label: 'हिंदी', dtmf: '1', icon: '🇮🇳' },
          { id: 'bho', label: 'भोजपुरी', dtmf: '2', icon: '🗣️' },
          { id: 'mag', label: 'मगही', dtmf: '3', icon: '🗣️' },
          { id: 'cgh', label: 'छत्तीसगढ़ी', dtmf: '4', icon: '🗣️' },
          { id: 'ta', label: 'தமிழ்', dtmf: '5', icon: '🗣️' },
        ],
        'grid',
      ));
    }

    case 'LANG_SELECT': {
      const id = u.kind === 'choice' ? u.optionId : u.kind === 'dtmf' ? ['hi', 'bho', 'mag', 'cgh', 'ta'][Number(u.digits) - 1] : null;
      if (id) s = { ...s, locale: id as Locale };
      s = { ...s, state: 'Q0_VILLAGE_BLOCK', phase: 'LISTEN', reAskCount: 0 };
      return finish([prompt('q0.ask.v1', s)], OPEN_EXPECT);
    }

    // ------------------------------------------------------------------ Q0 (registration metadata)
    case 'Q0_VILLAGE_BLOCK': {
      if (s.phase === 'CONFIRM') {
        const yn = u.kind === 'choice' ? { yes: u.optionId === 'yes', confidence: 1 } : u.kind === 'dtmf' ? { yes: u.digits === '1', confidence: 1 } : extractYesNo(hypothesesOf(u));
        if (yn?.yes) {
          events.push({ type: 'registration.upsert', beneficiaryId: s.beneficiaryId, registration: s.registration });
          s = { ...s, state: 'CONSENT', phase: 'LISTEN', reAskCount: 0 };
          return finish([prompt('consent.ask.v1', s)], enumExpect(YES_NO));
        }
        s = { ...s, phase: 'LISTEN', registration: { ...s.registration, villageName: null } };
        return finish([prompt('q0.reask.v1', s)], OPEN_EXPECT);
      }
      const hyps = hypothesesOf(u);
      const place = hyps.length > 0 ? deps.resolvePlace?.(hyps[0], hyps) ?? null : null;
      const typed = u.kind === 'text' ? u.value : null;
      if (place) {
        s = {
          ...s,
          registration: {
            villageName: place.villageName,
            blockName: place.blockName,
            blockLgd: place.blockLgd,
            districtName: place.districtName,
            districtLgd: place.districtLgd,
          },
          phase: 'CONFIRM',
        };
        const label = [place.villageName, place.blockName].filter(Boolean).join(', ');
        return finish([prompt('q0.confirm.v1', s, { value: label })], enumExpect(YES_NO));
      }
      // Take the name as stated, whether it was typed or spoken.
      //
      // This used to accept typed input only, so a village that was not one of the handful in the
      // pilot block list was never read back at all — the spoken path fell straight through to
      // re-ask, re-ask, DEFER, and the caller never saw the yes/no. It looked like the confirmation
      // was broken; in fact Q0 was never offering it. Most of India's 6 lakh villages are not in
      // any list we ship, so "not recognised" has to be the normal case, not the failure case.
      //
      // The LGD codes stay null, which is the honest state: decisions.md forbids fabricating an
      // identifier the source did not give us. A village name with a null code is a usable record;
      // an invented code is a defect.
      const spoken = typed ?? hyps[0]?.trim() ?? null;
      if (spoken) {
        s = { ...s, registration: { ...s.registration, villageName: spoken }, phase: 'CONFIRM' };
        return finish([prompt('q0.confirm.v1', s, { value: spoken })], enumExpect(YES_NO));
      }
      if (s.reAskCount >= 2) {
        s = { ...s, state: 'CONSENT', phase: 'LISTEN', reAskCount: 0 };
        return finish([prompt('defer.v1', s), prompt('consent.ask.v1', s)], enumExpect(YES_NO));
      }
      s = { ...s, reAskCount: s.reAskCount + 1 };
      return finish([prompt('q0.reask.v1', s)], OPEN_EXPECT);
    }

    // ------------------------------------------------------------------ consent
    case 'CONSENT': {
      const yn = u.kind === 'choice' ? { yes: u.optionId === 'yes' } : u.kind === 'dtmf' ? { yes: u.digits === '1' } : extractYesNo(hypothesesOf(u));
      if (yn?.yes) {
        events.push({
          type: 'consent.record',
          beneficiaryId: s.beneficiaryId,
          kind: u.kind === 'dtmf' ? 'DTMF_YES' : 'SPOKEN_YES',
          scriptVersion: CONSENT_SCRIPT_VERSION,
          channel: req.channel,
          evidence: { channelRef: req.channelRef, locale: s.locale, utteranceKind: u.kind },
          at: nowIso,
        });
        s = { ...s, consentState: 'GIVEN', noticedChannels: ['ivr', 'whatsapp', 'app'], state: 'IDENTIFY', phase: 'LISTEN' };
        return finish([prompt('pin.set.v1', s)], { kind: 'pin', timeoutMs: 15000 });
      }
      if (yn && !yn.yes) {
        s = { ...s, state: 'CLOSE_POLITE', status: 'ABANDONED' };
        return finish([prompt('consent.declined.v1', s)], NO_EXPECT, true);
      }
      return finish([prompt('consent.ask.v1', s)], enumExpect(YES_NO));
    }

    // ------------------------------------------------------------------ PIN capture
    case 'IDENTIFY': {
      const pin = u.kind === 'dtmf' ? u.digits : u.kind === 'text' ? u.value.replace(/\D/g, '') : null;
      if (pin && pin.length === 4) {
        // Stored hashed by the persistence layer; never spoken, never read back.
        s = { ...s, resumePin: pin, state: 'Q1_EDUCATION', phase: 'LISTEN', reAskCount: 0 };
        return finish([...preamble, prompt('ack.got.v1', s), prompt('q1.ask.v1', s)], OPEN_EXPECT);
      }
      // A welfare line never blocks on a PIN. Skip it rather than lock anyone out.
      s = { ...s, state: 'Q1_EDUCATION', phase: 'LISTEN', reAskCount: 0 };
      return finish([prompt('q1.ask.v1', s)], OPEN_EXPECT);
    }

    // ------------------------------------------------------------------ resume gate (panel 6)
    case 'RESUME_GATE': {
      const entered = u.kind === 'dtmf' ? u.digits : u.kind === 'text' ? u.value.replace(/\D/g, '') : null;
      if (entered === '1') {
        // Start fresh: a NEW beneficiary row on the same phone_hash, next ordinal. Never an
        // overwrite of whoever owns the existing record.
        s = { ...startSession({ channel: req.channel, channelRef: req.channelRef, locale: s.locale, now: deps.now, uuid: deps.uuid }), state: 'Q0_VILLAGE_BLOCK', phase: 'LISTEN' };
        return finish([prompt('q0.ask.v1', s)], OPEN_EXPECT);
      }
      if (entered && entered === s.resumePin) {
        const resumeAt = planResume(s.answers) ?? 'READBACK';
        s = { ...s, state: resumeAt, phase: 'LISTEN', resumedFrom: resumeAt, pinAttempts: 0, reAskCount: 0 };
        const ask = PROMPT_PREFIX[resumeAt] ? prompt(`${PROMPT_PREFIX[resumeAt]}.ask.v1`, s) : prompt('readback.intro.v1', s);
        return finish([prompt('resume.ack.v1', s), ask], OPEN_EXPECT);
      }
      if (s.pinAttempts >= 1) {
        // Two failures → a new record. Never a lockout: this is a welfare line, and the person
        // on the other end may simply be somebody else holding the same handset.
        s = { ...startSession({ channel: req.channel, channelRef: req.channelRef, locale: s.locale, now: deps.now, uuid: deps.uuid }), state: 'Q0_VILLAGE_BLOCK', phase: 'LISTEN' };
        return finish([prompt('q0.ask.v1', s)], OPEN_EXPECT);
      }
      s = { ...s, pinAttempts: s.pinAttempts + 1 };
      // Reveal nothing. No name, no prior answer, no field count, until the PIN clears.
      return finish([prompt('pin.wrong.v1', s)], { kind: 'pin', timeoutMs: 15000 });
    }

    // ------------------------------------------------------------------ guardian check (DPDP Rule 11)
    case 'GUARDIAN_CHECK': {
      const yn = u.kind === 'choice' ? { yes: u.optionId === 'yes' } : u.kind === 'dtmf' ? { yes: u.digits === '1' } : extractYesNo(hypothesesOf(u));
      if (yn?.yes) {
        s = { ...s, consentState: 'GUARDIAN_PENDING', status: 'RESUMABLE', state: 'CLOSE_POLITE' };
        return finish([prompt('guardian.defer.v1', s)], NO_EXPECT, true);
      }
      if (yn) {
        s = { ...s, state: 'Q6_EMPLOYMENT_PREF', phase: 'LISTEN', reAskCount: 0 };
        return finish([prompt('q6.ask.v1', s)], OPEN_EXPECT);
      }
      return finish([prompt('guardian.check.v1', s)], enumExpect(YES_NO));
    }

    // ------------------------------------------------------------------ readback
    case 'READBACK': {
      if (s.phase === 'DTMF_FALLBACK') {
        const n = Number(u.kind === 'dtmf' ? u.digits : u.kind === 'choice' ? u.optionId : 0) as FieldNo;
        if (n >= 1 && n <= 7) {
          const target = FIELD_STATES[n];
          s = { ...s, readbackCursor: n, state: target, phase: 'LISTEN', reAskCount: 0 };
          return finish([prompt(`${PROMPT_PREFIX[target]}.ask.v1`, s)], OPEN_EXPECT);
        }
        s = { ...s, phase: 'CONFIRM' };
        return finish([prompt('readback.which.v1', s)], { kind: 'enum', timeoutMs: 8000, options: readbackOptions(s) });
      }
      if (s.phase === 'CONFIRM') {
        const yn = u.kind === 'choice' ? { yes: u.optionId === 'yes' } : u.kind === 'dtmf' ? { yes: u.digits === '1' } : extractYesNo(hypothesesOf(u));
        if (yn?.yes) {
          s = { ...s, state: 'RECOMMEND', phase: 'ASK', readbackCursor: null };
          return runRecommend(s, deps, events, now);
        }
        if (yn) {
          s = { ...s, phase: 'DTMF_FALLBACK' };
          return finish([prompt('readback.which.v1', s)], { kind: 'enum', timeoutMs: 8000, options: readbackOptions(s) });
        }
      }
      // First entry into readback: speak every confirmed answer, one short sentence each.
      const lines: SayRef[] = [prompt('readback.intro.v1', s)];
      for (const n of [1, 2, 3, 4, 5, 6, 7] as FieldNo[]) {
        const a = s.answers[n];
        if (!a) continue;
        lines.push({ kind: 'tts', text: `${n}. ${describeAnswer(a.value, s.locale)}` });
      }
      lines.push(prompt('readback.confirm.v1', s));
      s = { ...s, phase: 'CONFIRM', readbackCursor: null };
      return finish(lines, enumExpect(YES_NO));
    }

    case 'RECOMMEND':
      return runRecommend(s, deps, events, now);

    case 'NEXT_STEP': {
      s = { ...s, state: 'CLOSE', status: 'COMPLETED' };
      return finish([prompt('close.v1', s)], NO_EXPECT, true);
    }

    case 'CLOSE':
    case 'CLOSE_POLITE':
      return finish([prompt('close.v1', s)], NO_EXPECT, true);

    // ------------------------------------------------------------------ the seven questions
    default: {
      const field = STATE_FIELD[s.state];
      if (!field) {
        s = { ...s, state: 'READBACK', phase: 'ASK' };
        return finish([prompt('readback.intro.v1', s)], NO_EXPECT);
      }
      return handleQuestion(s, req, deps, events, nowIso, preamble);
    }
  }
}

/**
 * Build a TurnResult around a specific session value.
 *
 * This is a free function rather than a closure on purpose. It used to be a closure over
 * `turn`'s own `s`, which meant the sub-machine below — which keeps its own updated copy — had
 * its work silently thrown away on the way out: the confirmation prompt came back correctly, but
 * `session.answers` was still empty and the phase never advanced past LISTEN. Passing the
 * session explicitly makes that mistake unrepresentable.
 */
function result(
  s: SessionState,
  events: DomainEvent[],
  say: SayRef[],
  expect: Expect,
  terminal = false,
  recommendation?: TurnResult['recommendation'],
): TurnResult {
  events.push({ type: 'session.upsert', session: s });
  return { session: s, say, expect, events, turnBudgetMs: TURN_BUDGET_MS, terminal, recommendation, progress: progressOf(s) };
}

function readbackOptions(s: SessionState): ExpectOption[] {
  return ([1, 2, 3, 4, 5, 6, 7] as FieldNo[])
    .filter((n) => s.answers[n])
    .map((n) => ({ id: String(n), label: describeAnswer(s.answers[n]!.value, 'en'), labelLocal: describeAnswer(s.answers[n]!.value, s.locale), dtmf: String(n) }));
}

/** The five-state sub-machine, once, for all seven fields. */
async function handleQuestion(
  sIn: SessionState,
  req: TurnRequest,
  deps: TurnDeps,
  events: DomainEvent[],
  nowIso: string,
  preamble: SayRef[],
): Promise<TurnResult> {
  let s = sIn;
  const finish = (say: SayRef[], expect: Expect, terminal = false) => result(s, events, say, expect, terminal);
  const state = s.state;
  const field = STATE_FIELD[state]!;
  const pfx = PROMPT_PREFIX[state] ?? PROMPT_PREFIX.Q2_FAMILY_OCCUPATION!;
  const u = req.utterance;

  // ---- CONFIRM: a spoken yes makes the answer immutable and erases the words that produced it.
  if (s.phase === 'CONFIRM') {
    const yn = u.kind === 'choice' ? { yes: u.optionId === 'yes' } : u.kind === 'dtmf' ? { yes: u.digits === '1' } : extractYesNo(hypothesesOf(u));
    if (yn?.yes) {
      const a = s.answers[field];
      if (a) {
        const confirmed: Answer = { ...a, confirmedAt: nowIso, rawTranscript: null, nbest: null, updatedAt: nowIso };
        s = { ...s, answers: { ...s.answers, [field]: confirmed }, deferred: s.deferred.filter((d) => d !== field) };
        events.push({ type: 'answer.upsert', answer: confirmed });
        events.push({ type: 'answer.confirmed', beneficiaryId: s.beneficiaryId, fieldNo: field, at: nowIso });
        // decisions.md: audio is gone already; the transcript's purpose is discharged here too.
        events.push({ type: 'transcript.erase', beneficiaryId: s.beneficiaryId, fieldNo: field, reason: 'CONFIRMED' });
      }
      // Q2's second half: the trade is confirmed, now the years that unlock NSQF 2.5+.
      if (state === 'Q2_FAMILY_OCCUPATION' && s.answers[2]?.value.kind === 'occupation' && s.answers[2].value.years === 0) {
        s = { ...s, state: 'Q2_YEARS', phase: 'LISTEN', reAskCount: 0 };
        return finish([prompt('q2.years.ask.v1', s)], { kind: 'number', timeoutMs: 8000 });
      }
      const extra: SayRef[] = [];
      // The one sentence in the whole interview that tells a person with no schooling that the
      // framework already has a door for them.
      if (field === 2 && s.answers[2]?.value.kind === 'occupation' && s.answers[2].value.years >= 4) {
        extra.push(prompt('q2.eligibility.good.v1', s, { years: s.answers[2].value.years }));
      }
      const next = nextStateAfter(state === 'Q2_YEARS' ? 'Q2_YEARS' : state, s);
      const cursorCleared = s.readbackCursor !== null ? { ...s, readbackCursor: null } : s;
      s = { ...cursorCleared, state: next, phase: next === 'READBACK' ? 'ASK' : 'LISTEN', reAskCount: 0 };
      if (next === 'READBACK') return finish([...extra, prompt('readback.intro.v1', s)], NO_EXPECT);
      if (next === 'GUARDIAN_CHECK') return finish([...extra, prompt('guardian.check.v1', s)], enumExpect(YES_NO));
      return finish([...extra, prompt(`${PROMPT_PREFIX[next]}.ask.v1`, s)], next === 'Q2_YEARS' ? { kind: 'number', timeoutMs: 8000 } : OPEN_EXPECT);
    }
    // "No, that's wrong" → re-ask this field only. Nothing else is touched.
    s = { ...s, phase: 'LISTEN', reAskCount: s.reAskCount + 1 };
    return finish([prompt(`${pfx}.reask1.v1`, s)], OPEN_EXPECT);
  }

  // ---- LISTEN / EXTRACT
  const extracted = await extractForState(state, u, s, deps);

  if (extracted && extracted.confidence >= CONF_LOW) {
    const asr = asrOf(u);
    const answer: Answer = {
      beneficiaryId: s.beneficiaryId,
      fieldNo: field,
      // Held only until CONFIRM. The DB CHECK constraint enforces the erasure.
      rawTranscript: hypothesesOf(u)[0] ?? null,
      nbest: hypothesesOf(u).length > 1 ? hypothesesOf(u) : null,
      value: extracted.value,
      confidence: extracted.confidence,
      method: extracted.method,
      asrEngine: asr.engine,
      asrVersion: asr.version,
      confirmedAt: null,
      sessionId: s.sessionId,
      updatedAt: nowIso,
    };
    s = { ...s, answers: { ...s.answers, [field]: answer }, phase: 'CONFIRM' };
    events.push({ type: 'answer.upsert', answer });
    events.push({
      type: 'telemetry.turn',
      sessionId: s.sessionId,
      state,
      method: extracted.method,
      latencyMs: null,
    });

    // High confidence still gets a confirmation. A mis-heard "12th pass" silently changes the
    // whole eligible qualification set, and that is not a risk worth one saved turn.
    const vars: Record<string, string | number> = { value: describeAnswer(extracted.value, s.locale) };
    if (extracted.value.kind === 'occupation') vars.years = extracted.value.years;
    const confirmId = state === 'Q2_YEARS' ? 'q2.confirm.v1' : `${pfx}.confirm.v1`;
    const lead: SayRef[] = extracted.confidence >= CONF_HIGH ? [] : [prompt('ack.hmm.v1', s)];
    return finish([...preamble, ...lead, prompt(confirmId, s, vars)], enumExpect(YES_NO));
  }

  // ---- RE_ASK, then DTMF, then DEFER. The system never hangs up on someone it cannot follow.
  if (s.reAskCount === 0) {
    s = { ...s, reAskCount: 1 };
    return finish([...preamble, prompt(`${pfx}.reask1.v1`, s)], OPEN_EXPECT);
  }
  if (s.reAskCount === 1) {
    s = { ...s, reAskCount: 2 };
    const hasReask2 = pfx !== 'q7' && pfx !== 'q0';
    return finish([prompt(hasReask2 ? `${pfx}.reask2.v1` : `${pfx}.reask1.v1`, s)], enumExpect(optionsForState(state), 'grid'));
  }
  if (s.reAskCount === 2) {
    s = { ...s, reAskCount: 3, phase: 'DTMF_FALLBACK' };
    return finish([prompt(`${pfx}.reask1.v1`, s)], enumExpect(optionsForState(state), 'grid'));
  }

  // DEFER — leave it unconfirmed and carry on. An unconfirmed field is a resumable field, and a
  // profile missing Q7 still produces a NEAR-MISS-aware recommendation; it just says so.
  const next = nextStateAfter(state, s);
  s = {
    ...s,
    deferred: s.deferred.includes(field) ? s.deferred : [...s.deferred, field],
    state: next,
    phase: next === 'READBACK' ? 'ASK' : 'LISTEN',
    reAskCount: 0,
    readbackCursor: null,
  };
  const onward: SayRef = next === 'READBACK'
    ? prompt('readback.intro.v1', s)
    : next === 'GUARDIAN_CHECK'
      ? prompt('guardian.check.v1', s)
      : prompt(`${PROMPT_PREFIX[next]}.ask.v1`, s);
  return finish([prompt('defer.v1', s), onward], next === 'READBACK' ? NO_EXPECT : OPEN_EXPECT);
}

/** Build the Profile the gate and ranker consume, from whatever is confirmed so far. */
export function profileFrom(s: SessionState, extras: { isWoman?: boolean; ageBand?: Profile['ageBand'] } = {}): Profile {
  const a = s.answers;
  const edu = a[1]?.value.kind === 'education' ? a[1].value.education : 'none';
  const occ = a[2]?.value.kind === 'occupation' ? { conceptId: a[2].value.conceptId, years: a[2].value.years } : null;
  const liv = a[3]?.value.kind === 'livelihood' ? { conceptId: a[3].value.conceptId, status: a[3].value.status } : null;
  const skills = a[4]?.value.kind === 'concepts' ? a[4].value.conceptIds : [];
  const mob = a[5]?.value.kind === 'mobility' ? { constraint: a[5].value.constraint, radiusKm: a[5].value.radiusKm } : { constraint: 'none' as const, radiusKm: 10 };
  const pref = a[6]?.value.kind === 'pref' ? a[6].value.pref : 'either';
  const local = a[7]?.value.kind === 'local' ? a[7].value.conceptIds : [];
  return {
    education: edu,
    occupation: occ,
    livelihood: liv,
    skills,
    mobility: mob,
    pref,
    localDemand: local,
    districtName: s.registration.districtName,
    blockName: s.registration.blockName,
    ageBand: extras.ageBand ?? null,
  };
}

async function runRecommend(
  sIn: SessionState,
  deps: TurnDeps,
  events: DomainEvent[],
  now: Date,
): Promise<TurnResult> {
  let s = sIn;
  const finish = (say: SayRef[], expect: Expect, terminal = false, r?: TurnResult['recommendation']) =>
    result(s, events, say, expect, terminal, r);
  const profile = profileFrom(s);
  const reco = recommend(profile, {
    catalogue: deps.catalogue,
    opportunities: deps.opportunities,
    districtHistogram: deps.districtHistogram,
    nearestCentreKm: deps.nearestCentreKm,
    nqrSnapshotSha: deps.nqrSnapshotSha ?? null,
    now: () => now,
  });

  events.push({ type: 'recommendation.create', beneficiaryId: s.beneficiaryId, result: reco, at: now.toISOString() });
  if (reco.top[0]) {
    events.push({
      type: 'outcome.upsert',
      beneficiaryId: s.beneficiaryId,
      qualificationRef: reco.top[0].qualification.qpCode ?? reco.top[0].qualification.localId,
      status: 'RECOMMENDED',
      at: now.toISOString(),
    });
  }

  const lines: SayRef[] = [];
  if (reco.top.length === 0) {
    lines.push(prompt('recommend.none.v1', s));
  } else {
    lines.push(prompt('recommend.intro.v1', s));
    for (const r of reco.top) lines.push({ kind: 'tts', text: r.explain.beneficiary });
  }
  if (reco.nearMiss.length > 0) {
    lines.push(prompt('recommend.nearmiss.intro.v1', s));
    lines.push({ kind: 'tts', text: reco.nearMiss[0].explain.beneficiary });
  }
  if (reco.routeToPmDaksh?.route) lines.push(prompt('recommend.pmdaksh.v1', s));
  if (reco.needsFinancialLiteracy) lines.push(prompt('recommend.financial.v1', s));
  if (reco.assetGrantEligible) lines.push(prompt('recommend.assetgrant.v1', s));

  const action = reco.top[0]
    ? `${reco.top[0].qualification.title} — ${s.registration.blockName ?? 'your block'}`
    : 'wait for the village worker to visit';
  lines.push(prompt('nextstep.v1', s, { action }));

  s = { ...s, state: 'NEXT_STEP', phase: 'ASK' };
  return finish(lines, { kind: 'enum', timeoutMs: 8000, options: [
    { id: 'yes', label: 'Send it to me', labelLocal: 'मैसेज भेज दीजिए', dtmf: '1', icon: '📩' },
    { id: 'no', label: 'No need', labelLocal: 'ज़रूरत नहीं', dtmf: '2', icon: '🙏' },
  ] }, false, reco);
}
