/**
 * The extraction ladder (panel 8). Cheapest rung first, stop on the first that fires.
 *
 * The whole design assumes the transcript is wrong. The unit of the system is therefore a
 * **field classified over a closed set**, not a transcription (decisions.md 2026-09-25). Low
 * confidence is a re-ask, not an error.
 *
 *   0  DTMF / on-screen tap          ₹0      0 ms       0 WER
 *   1  lexicon, phonetic + fuzzy     ~₹0     ~5 ms      ~70% of turns
 *   2  numeric / level regex         ~₹0     ~2 ms      Q1 and Q2-years
 *   3  small LLM, constrained enum   1 call  400-1200ms uncommon path only
 *   4  spoken confirmation           1 turn  ~4 s       everything the rest got wrong
 *
 * Rung 3 is injected, never imported. The offline kiosk has no LLM and must still work, so the
 * ladder degrades to 0-2 plus a re-ask rather than failing.
 *
 * The confidence numbers below are hand-tuned starting points, not measurements. They are the
 * subject of research/ experiment 2 and they belong in the published table beside the WER.
 */

import { CONCEPT_BY_ID, LEXICON } from './lexicon.js';
import { levenshtein, ngrams, phoneticKey, romanize, tokens } from './phonetic.js';
import type { Education, ExtractMethod, LexiconEntry, Locale } from './types.js';

export const CONF_HIGH = 0.85;
export const CONF_LOW = 0.55;

export interface ConceptMatch {
  conceptId: string;
  confidence: number;
  method: ExtractMethod;
  /** Which surface form fired, for the audit row and for debugging a bad match. */
  matchedOn: string;
  /** Which ASR hypothesis it came from. 0 = the top one. */
  hypothesisIndex: number;
}

export interface LlmEnumRequest {
  transcripts: string[];
  fieldNo: number;
  question: string;
  /** Closed set. Constrained decoding, not free generation. */
  options: { id: string; label: string }[];
  locale: Locale;
}

export interface LlmEnumResult {
  optionId: string | null;
  confidence: number;
}

export type LlmClassifier = (req: LlmEnumRequest) => Promise<LlmEnumResult | null>;

// -------------------------------------------------------------------- rung 1: lexicon

interface Prepared {
  entry: LexiconEntry;
  exact: Set<string>;
  phonetic: Map<string, string>;
}

let prepared: Prepared[] | null = null;
let preparedFor: LexiconEntry[] | null = null;

function prepare(lex: LexiconEntry[]): Prepared[] {
  if (prepared && preparedFor === lex) return prepared;
  prepared = lex.map((entry) => {
    const exact = new Set<string>();
    const phonetic = new Map<string, string>();
    const forms = [
      ...entry.surface,
      ...Object.values(entry.canonical),
      ...Object.values(entry.dialect ?? {}).flat(),
    ];
    for (const form of forms) {
      const r = romanize(form);
      // Two-character forms exact-match far too much once a noisy transcript is tokenised.
      if (r.length < 3) continue;
      exact.add(r);
      const key = phoneticKey(form);
      // Two-letter skeletons ("SL") collide too easily to be trusted on their own.
      if (key.length >= 3 && !phonetic.has(key)) phonetic.set(key, form);
    }
    return { entry, exact, phonetic };
  });
  preparedFor = lex;
  return prepared;
}

/**
 * Match every ASR hypothesis against the lexicon and return concepts best-first.
 *
 * Agreement across hypotheses is the strongest signal available without a second model: if
 * n-best[0] and n-best[2] both land on TRADE.DAIRY by different routes, that is worth more than
 * either hit alone.
 */
export function matchConcepts(
  hypotheses: string[],
  lex: LexiconEntry[] = LEXICON,
  opts: { maxResults?: number } = {},
): ConceptMatch[] {
  const table = prepare(lex);
  const best = new Map<string, ConceptMatch>();
  const agreement = new Map<string, Set<number>>();

  const keep = (m: ConceptMatch) => {
    const prev = best.get(m.conceptId);
    if (!prev || m.confidence > prev.confidence) best.set(m.conceptId, m);
    const set = agreement.get(m.conceptId) ?? new Set<number>();
    set.add(m.hypothesisIndex);
    agreement.set(m.conceptId, set);
  };

  hypotheses.forEach((hyp, hi) => {
    if (!hyp) return;
    // Later hypotheses are less likely to be right; discount rather than ignore them.
    const decay = Math.max(0.8, 1 - hi * 0.05);
    const toks = tokens(hyp);
    const grams = ngrams(toks, 3);
    const gramKeys = grams.map((g) => ({ g, key: phoneticKey(g) }));

    for (const { entry, exact, phonetic } of table) {
      let hit: ConceptMatch | null = null;

      for (const g of grams) {
        if (exact.has(g)) {
          hit = { conceptId: entry.conceptId, confidence: 0.95 * decay, method: 'LEXICON', matchedOn: g, hypothesisIndex: hi };
          break;
        }
      }

      if (!hit) {
        for (const { g, key } of gramKeys) {
          if (key.length >= 3 && phonetic.has(key)) {
            hit = {
              conceptId: entry.conceptId,
              confidence: 0.82 * decay,
              method: 'LEXICON',
              matchedOn: `${g} ~ ${phonetic.get(key)}`,
              hypothesisIndex: hi,
            };
            break;
          }
        }
      }

      if (!hit) {
        // Fuzzy, single tokens only. The edit budget scales with word length, because an edit
        // distance of 1 on a four-letter word is not a near-miss — it is a different word.
        // "कल" (kala, yesterday) sat one edit from "फल" (fala, fruit) and produced a confident
        // horticulture match out of a sentence about rain blocking the road.
        outer: for (const tok of toks) {
          if (tok.length < 5) continue;
          const budget = tok.length >= 7 ? 2 : 1;
          for (const form of exact) {
            if (form.includes(' ') || Math.abs(form.length - tok.length) > budget || form.length < 5) continue;
            // The first sound is the most informative one, and Soundex-family keys have always
            // kept it for the same reason. Without this, "रास्ता" (rasta, road) fuzzy-matched
            // "नाश्ता" (nasta, breakfast) and recommended a food stall to somebody describing a
            // blocked road.
            if (tok[0] !== form[0]) continue;
            const d = levenshtein(tok, form, budget);
            if (d <= budget) {
              // Deliberately BELOW the 0.55 accept threshold. A lone edit-distance hit is a
              // suspicion, not an answer: "बंद" (banda, closed) sits one edit from "बांस"
              // (bansa, bamboo), and there is no way to tell them apart from the string alone.
              // So a bare fuzzy match falls through to a re-ask or a spoken confirmation, and
              // only becomes trustworthy when several ASR hypotheses agree on it (the agreement
              // boost below). Low confidence is a re-ask, not an error — decisions.md.
              hit = {
                conceptId: entry.conceptId,
                confidence: (d === 1 ? 0.52 : 0.44) * decay,
                method: 'LEXICON',
                matchedOn: `${tok} ~ ${form} (d=${d})`,
                hypothesisIndex: hi,
              };
              break outer;
            }
          }
        }
      }

      if (hit) keep(hit);
    }
  });

  const out = [...best.values()].map((m) => {
    const agreed = agreement.get(m.conceptId)?.size ?? 1;
    const boosted = agreed > 1 ? Math.min(0.97, m.confidence + 0.04 * (agreed - 1)) : m.confidence;
    return { ...m, confidence: Number(boosted.toFixed(3)) };
  });
  out.sort((a, b) => b.confidence - a.confidence);
  return out.slice(0, opts.maxResults ?? 5);
}

// -------------------------------------------------------------------- rung 2: regex

/** Hindi/Bhojpuri number words 0-30, the range that matters for "how many years". */
const NUM_WORDS: Record<string, number> = {
  ek: 1, do: 2, teen: 3, tin: 3, char: 4, char_: 4, panch: 5, paanch: 5, chah: 6, chhah: 6, che: 6,
  sat: 7, saat: 7, ath: 8, aath: 8, nau: 9, nav: 9, das: 10, dus: 10,
  gyarah: 11, igarah: 11, barah: 12, baarah: 12, terah: 13, chaudah: 14, chodah: 14,
  pandrah: 15, pandra: 15, solah: 16, satrah: 17, atharah: 18, atharaha: 18, unnis: 19, unis: 19,
  bis: 20, bees: 20, ikkis: 21, bais: 22, tais: 23, chaubis: 24, pachchis: 25, pacchis: 25,
  chhabbis: 26, sattais: 27, atthais: 28, untis: 29, tis: 30, tees: 30,
};

const DEVA_DIGITS = '०१२३४५६७८९';

function devaDigitsToInt(s: string): number | null {
  let out = '';
  for (const ch of s) {
    const i = DEVA_DIGITS.indexOf(ch);
    if (i >= 0) out += String(i);
    else if (/[0-9]/.test(ch)) out += ch;
    else return null;
  }
  return out ? Number(out) : null;
}

/** "बारह साल", "12 saal", "12 years", "१२ वर्ष", "barah baras" → 12 */
export function extractYears(text: string): { years: number; matchedOn: string } | null {
  const devaMatch = text.match(/([०-९]+)\s*(साल|वर्ष|बरस|बार)/);
  if (devaMatch) {
    const n = devaDigitsToInt(devaMatch[1]);
    if (n !== null && n >= 0 && n <= 70) return { years: n, matchedOn: devaMatch[0] };
  }
  const r = romanize(text);
  const digit = r.match(/(\d{1,2})\s*(sal|saal|varsh|baras|baris|year|years|yr|bars)/);
  if (digit) {
    const n = Number(digit[1]);
    if (n >= 0 && n <= 70) return { years: n, matchedOn: digit[0] };
  }
  const toks = tokens(text);
  for (let i = 0; i < toks.length; i++) {
    const n = NUM_WORDS[toks[i]];
    if (n === undefined) continue;
    const next = toks[i + 1] ?? '';
    if (/^(sal|saal|varsh|baras|baris|bars|year|years|barsh)/.test(next)) {
      return { years: n, matchedOn: `${toks[i]} ${next}` };
    }
  }
  // Bare number with no unit is still usable when the question asked for years.
  const bare = r.match(/(?:^|\s)(\d{1,2})(?:\s|$)/);
  if (bare) {
    const n = Number(bare[1]);
    if (n >= 0 && n <= 70) return { years: n, matchedOn: bare[1] };
  }
  for (const tok of toks) {
    if (NUM_WORDS[tok] !== undefined) return { years: NUM_WORDS[tok], matchedOn: tok };
  }
  return null;
}

const EDU_PATTERNS: { edu: Education; re: RegExp; conf: number }[] = [
  { edu: 'graduate_plus', re: /(graduate|snatak|b\.?a\b|b\.?sc|b\.?com|degree|college pas|post ?graduate|m\.?a\b)/, conf: 0.9 },
  { edu: 'iti_diploma', re: /(iti|i\.?t\.?i|diploma|polytechnic|trade certificate|diploma)/, conf: 0.9 },
  { edu: 'higher_sec', re: /(barah|baarah|12 ?(th|vi|vin)?|intermediate|inter pas|inter\b|higher secondary|plus two|barahvin|1 ?2 pas)/, conf: 0.88 },
  { edu: 'secondary', re: /(das(vin|vi|va)?\b|10 ?(th|vi|vin)?|matric|metric|hai ?school|high school|board pas|dasvi)/, conf: 0.88 },
  { edu: 'middle', re: /(athvin|aathvin|8 ?(th|vi|vin)?|satvin|7 ?(th|vi)?|chhathvin|6 ?(th|vi)?|middle|madhyamik pas|ath pas)/, conf: 0.85 },
  { edu: 'primary', re: /(panchvin|paanchvin|5 ?(th|vi|vin)?|chauthi|4 ?(th|vi)?|tisri|3 ?(rd|vi)?|dusri|primary|prathmik|panchvi)/, conf: 0.85 },
  { edu: 'read_write', re: /(likh (leta|leti|lete)|padh (leta|leti|lete)|sirf nam|naam likh|thoda padh|akshar|signature|dastkhat)/, conf: 0.8 },
  { edu: 'none', re: /(nahi padh|nahin padh|kabhi school|school nahi|padha nahi|anpadh|nirakshar|kuch nahi padh|bilkul nahi|no school|never went)/, conf: 0.85 },
];

/** Q1. Order matters: the most specific claim wins, so "ITI ke baad" beats the "10th" in it. */
export function extractEducation(hypotheses: string[]): { education: Education; confidence: number; matchedOn: string } | null {
  for (let hi = 0; hi < hypotheses.length; hi++) {
    const r = romanize(hypotheses[hi]);
    const deva = hypotheses[hi];
    const decay = Math.max(0.8, 1 - hi * 0.05);
    // Devanagari ordinals that romanize poorly are worth a direct look.
    const devaMap: [RegExp, Education][] = [
      [/दसवीं|दसवी|मैट्रिक|हाई ?स्कूल/, 'secondary'],
      [/बारहवीं|बारहवी|इंटर/, 'higher_sec'],
      [/आठवीं|आठवी|सातवीं/, 'middle'],
      [/पाँचवी|पांचवी|पाँचवीं|चौथी|तीसरी/, 'primary'],
      [/स्नातक|ग्रेजुएट|बी\.?ए/, 'graduate_plus'],
      [/आई ?टी ?आई|डिप्लोमा/, 'iti_diploma'],
      [/नहीं पढ़|कभी स्कूल|अनपढ़|निरक्षर/, 'none'],
    ];
    for (const [re, edu] of devaMap) {
      if (re.test(deva)) return { education: edu, confidence: 0.88 * decay, matchedOn: deva.match(re)![0] };
    }
    for (const { edu, re, conf } of EDU_PATTERNS) {
      const m = r.match(re);
      if (m) return { education: edu, confidence: Number((conf * decay).toFixed(3)), matchedOn: m[0] };
    }
  }
  return null;
}

/** Q5. Distance in km, when they volunteer one: "paanch kilometre tak jaa sakti hoon". */
export function extractRadiusKm(text: string): number | null {
  const r = romanize(text);
  const digit = r.match(/(\d{1,3})\s*(km|kilometre|kilometer|kilomitar)/);
  if (digit) return Number(digit[1]);
  const toks = tokens(text);
  for (let i = 0; i < toks.length; i++) {
    if (NUM_WORDS[toks[i]] !== undefined && /^(km|kilo)/.test(toks[i + 1] ?? '')) return NUM_WORDS[toks[i]];
  }
  const deva = text.match(/([०-९]+)\s*(किलोमीटर|किमी)/);
  if (deva) return devaDigitsToInt(deva[1]);
  return null;
}

/** Yes/no across the five prompt locales, plus the DTMF equivalents the IVR channel sends. */
export function extractYesNo(hypotheses: string[]): { yes: boolean; confidence: number } | null {
  for (const hyp of hypotheses) {
    if (/हाँ|हां|जी हाँ|ठीक|सही|बिल्कुल|हई|हओ|आमा|ஆம்/.test(hyp)) return { yes: true, confidence: 0.92 };
    if (/नहीं|नही|गलत|ना\b|मत|नइखे|நில்லை|இல்லை/.test(hyp)) return { yes: false, confidence: 0.92 };
    const r = romanize(hyp);
    if (/\b(ha|haan|han|ji ha|ji han|thik|sahi|bilkul|hai ji|yes|ok|correct|aama|hao|hai)\b/.test(r)) {
      return { yes: true, confidence: 0.88 };
    }
    if (/\b(nahi|nahin|na|galat|no|nope|nai|naikhe|illai)\b/.test(r)) return { yes: false, confidence: 0.88 };
  }
  return null;
}

export function conceptExists(conceptId: string): boolean {
  return CONCEPT_BY_ID.has(conceptId);
}
