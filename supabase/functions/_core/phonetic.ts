// GENERATED FILE — DO NOT EDIT.
// Copied from packages/core/src/phonetic.ts by scripts/vendor_core.py.
// Edit the original; this copy is re-synced on every deploy.

/**
 * Sound-alike matching for Indic text, in about a hundred lines and zero dependencies.
 *
 * Why this exists: the best published WER on dialectal telephone Hindi is 26.8 (IndicWhisper);
 * Google STT is 59.9. So the transcript is wrong roughly one word in four on a good day. A
 * plain string search against a trade lexicon therefore misses constantly — "सिलाई" comes back
 * as "शिलाई", "silai" comes back as "sivai". We match on a consonant skeleton instead, so a
 * near-miss still lands on the right concept (panel 8).
 *
 * ponytail: this is a consonant-skeleton key, not the Double Metaphone the spec names. It is
 * ~15 lines instead of ~400 and handles the Indic confusions that actually occur (s/ś/ş, b/v/w,
 * aspirate pairs, ड़/र). Upgrade path: swap `phoneticKey` for a real Double Metaphone over an
 * ISO-15919 transliteration if the experiment-2 measurement shows the skeleton losing recall.
 */

/** Devanagari consonant → Latin base. Vowels are handled separately, see `romanize`. */
const DEVA: Record<string, string> = {
  क: 'k', ख: 'k', ग: 'g', घ: 'g', ङ: 'n',
  // `ch`, not `c`: every Roman transliteration anyone actually writes uses ch — chai, machhli,
  // panch, kachra. Emitting `c` made "पाँच" romanize to "panc" and silently stopped matching the
  // number word table, which killed radius and years extraction on Devanagari input.
  च: 'ch', छ: 'chh', ज: 'j', झ: 'jh', ञ: 'n',
  ट: 't', ठ: 't', ड: 'd', ढ: 'd', ण: 'n',
  त: 't', थ: 't', द: 'd', ध: 'd', न: 'n',
  प: 'p', फ: 'f', ब: 'b', भ: 'b', म: 'm',
  य: 'y', र: 'r', ल: 'l', व: 'v', ळ: 'l',
  श: 's', ष: 's', स: 's', ह: 'h',
  क़: 'k', ख़: 'k', ग़: 'g', ज़: 'z', ड़: 'r', ढ़: 'r', फ़: 'f',
};

/** Tamil consonant → Latin. Same treatment. */
const TAMIL: Record<string, string> = {
  க: 'k', ங: 'n', ச: 'c', ஞ: 'n', ட: 't', ண: 'n', த: 't', ந: 'n',
  ப: 'p', ம: 'm', ய: 'y', ர: 'r', ல: 'l', வ: 'v', ழ: 'l', ள: 'l',
  ற: 'r', ன: 'n', ஸ: 's', ஷ: 's', ஜ: 'j', ஹ: 'h',
};

/** Latin → equivalence class. The pairs here are the ones Indic ASR actually confuses. */
const CLASS: Record<string, string> = {
  k: 'K', q: 'K',
  g: 'G',
  c: 'C',
  j: 'J', z: 'J',
  t: 'T',
  d: 'D',
  n: 'N',
  p: 'P', f: 'P',
  b: 'B', v: 'B', w: 'B',
  m: 'M',
  y: 'Y',
  r: 'R',
  l: 'L',
  s: 'S', x: 'S',
  h: 'H',
};

/** Devanagari independent vowels. */
const DEVA_VOWEL: Record<string, string> = {
  अ: 'a', आ: 'a', इ: 'i', ई: 'i', उ: 'u', ऊ: 'u', ऋ: 'ri', ऌ: 'li',
  ए: 'e', ऐ: 'ai', ओ: 'o', औ: 'au', ऑ: 'o', ऍ: 'e',
};

/** Devanagari dependent vowel signs (matras) plus the nasal marks. */
const DEVA_MATRA: Record<string, string> = {
  'ा': 'a', 'ि': 'i', 'ी': 'i', 'ु': 'u', 'ू': 'u', 'ृ': 'ri', 'ॄ': 'ri',
  'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au', 'ॉ': 'o', 'ॅ': 'e',
};

/** Consonants whose sound changes under a nukta, when the codepoint is not pre-composed. */
const DEVA_NUKTA: Record<string, string> = {
  क: 'k', ख: 'k', ग: 'g', ज: 'z', ड: 'r', ढ: 'r', फ: 'f', य: 'y',
};

const NUKTA = '़';
const VIRAMA = '्';
const ANUSVARA = 'ं';
const CANDRABINDU = 'ँ';
const VISARGA = 'ः';

const VOWELS = new Set(['a', 'e', 'i', 'o', 'u']);

/**
 * Transliterate to a comparable Latin string.
 *
 * The important part is the **inherent vowel**. Devanagari writes `बुनाई` as four consonant and
 * matra units; an earlier version of this function dropped every vowel sign and produced `"bn"`,
 * while the Roman surface form `"bunai"` stayed `"bunai"`. Nothing matched across scripts, and
 * short consonant-only strings like `"bd"` collided across unrelated trades — a Devanagari answer
 * for carpentry scored an exact hit against goat rearing. So every consonant now emits its
 * inherent `a` unless a matra or a virama says otherwise, and `बुनाई → "bunai"` lines up with the
 * Roman form exactly.
 *
 * Tamil is deliberately left as a consonant skeleton: Tamil input is matched against Tamil
 * surface forms, so both sides reduce identically, and the Roman form is listed separately.
 */
export function romanize(input: string): string {
  const chars = [...input.normalize('NFC').toLowerCase()];
  let out = '';

  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];

    const cons = DEVA[ch];
    if (cons !== undefined) {
      // A nukta may arrive as a separate combining codepoint rather than pre-composed, which is
      // how `ढ़` in `बढ़ई` slipped through as a plain `ढ` and romanized to `d` instead of `r`.
      let base = cons;
      if (chars[i + 1] === NUKTA) {
        base = DEVA_NUKTA[ch] ?? cons;
        i++;
      }
      out += base;

      const next = chars[i + 1];
      if (next === VIRAMA) {
        i++; // conjunct: no vowel at all
      } else if (next !== undefined && DEVA_MATRA[next] !== undefined) {
        out += DEVA_MATRA[next];
        i++;
        if (chars[i + 1] === ANUSVARA || chars[i + 1] === CANDRABINDU) {
          out += 'n';
          i++;
        }
      } else if (next === ANUSVARA || next === CANDRABINDU) {
        out += 'an';
        i++;
      } else if (next === VISARGA) {
        out += 'a';
        i++;
      } else {
        out += 'a'; // the inherent vowel
      }
      continue;
    }

    if (DEVA_VOWEL[ch] !== undefined) {
      out += DEVA_VOWEL[ch];
      if (chars[i + 1] === ANUSVARA || chars[i + 1] === CANDRABINDU) {
        out += 'n';
        i++;
      }
      continue;
    }

    if (DEVA_MATRA[ch] !== undefined) {
      out += DEVA_MATRA[ch]; // stray matra, e.g. a badly segmented ASR token
      continue;
    }

    const tamil = TAMIL[ch];
    if (tamil !== undefined) {
      out += tamil;
      continue;
    }

    if (/[a-z0-9]/.test(ch)) {
      out += ch;
      continue;
    }

    // Remaining Indic combining marks, ZWJ/ZWNJ, danda, avagraha: noise.
    if (/[ऀ-ॿ஀-௿​-‍]/.test(ch)) continue;
    if (/\s/.test(ch)) out += ' ';
    // punctuation drops
  }

  // Word-final schwa deletion. Hindi does not pronounce the inherent vowel at the end of a word:
  // साल is "saal", not "saala"; बारह is "barah", not "baraha". Without this step the emitted
  // form disagrees with every Roman spelling anyone actually writes, and the numeric regex stops
  // recognising "बारह साल" as twelve years. Applied to every token, so both the lexicon's stored
  // forms and the incoming transcript pass through the same rule and stay comparable.
  return out
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map((tok) => (tok.length >= 4 && tok.endsWith('a') ? tok.slice(0, -1) : tok))
    .join(' ');
}

/**
 * Consonant skeleton with equivalence classes and doubles collapsed.
 * "सिलाई" → "SL"  ·  "shilai" → "SL"  ·  "darzi" → "DRJ"  ·  "दर्जी" → "DRJ"
 */
export function phoneticKey(input: string): string {
  const roman = romanize(input);
  let key = '';
  for (let i = 0; i < roman.length; i++) {
    const ch = roman[i];
    if (VOWELS.has(ch) || ch === ' ' || /[0-9]/.test(ch)) continue;
    // 'ch' digraph → C, and don't let the h be read as H
    if (ch === 'c' && roman[i + 1] === 'h') {
      if (key.at(-1) !== 'C') key += 'C';
      i++;
      continue;
    }
    // Digraphs where the h is not a separate sound: the aspirates kh gh th dh ph bh jh, and
    // `sh` — which matters most of all, because ś/ş/s is the commonest Indic ASR confusion
    // ("शिलाई" for "सिलाई") and the whole point of this key is to survive it.
    // The trailing `h` of `chh` too, hence `h` itself in the set.
    if (ch === 'h' && i > 0 && 'kgtdpbjsh'.includes(roman[i - 1])) continue;
    const cls = CLASS[ch];
    if (!cls) continue;
    if (key.at(-1) !== cls) key += cls;
  }
  return key;
}

export function tokens(input: string): string[] {
  return romanize(input).split(' ').filter((t) => t.length > 0);
}

/** Standard iterative Levenshtein with an early bail once the best possible exceeds `max`. */
export function levenshtein(a: string, b: string, max = 3): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (cur[j] < rowMin) rowMin = cur[j];
    }
    if (rowMin > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

/** Sliding window over tokens, so a two-word surface form ("silai kadhai") can still match. */
export function ngrams(toks: string[], maxN = 3): string[] {
  const out: string[] = [];
  for (let n = 1; n <= maxN; n++) {
    for (let i = 0; i + n <= toks.length; i++) out.push(toks.slice(i, i + n).join(' '));
  }
  return out;
}
