/**
 * One runnable check for the whole engine. `npm test` from the repo root.
 *
 * Assert-based, no framework, no fixtures. It exists to fail if the load-bearing logic breaks:
 * the phonetic matcher, the years/education regex, the eligibility gate's three buckets, the
 * experience substitution that is the entire point of Q2, the transcript erasure at CONFIRM, and
 * the PIN gate that stops a shared handset leaking one person's answers to another.
 *
 * Run:  npm test
 */

import assert from 'node:assert/strict';
import {
  QUALIFICATIONS,
  OPPORTUNITIES,
  LEXICON,
  PROMPTS,
  describeAnswer,
  eligibleLevels,
  extractEducation,
  extractYears,
  extractYesNo,
  gate,
  matchConcepts,
  phoneticKey,
  planResume,
  profileFrom,
  promptCoverage,
  provenanceReport,
  recommend,
  requirementCoverage,
  say,
  spreadReport,
  startSession,
  turn,
  type Answer,
  type FieldNo,
  type Profile,
  type SessionState,
  type TurnDeps,
  type TurnRequest,
  type Utterance,
} from '../src/index.js';

let checks = 0;
const ok = (label: string, fn: () => void | Promise<void>) => {
  const r = fn();
  if (r instanceof Promise) return r.then(() => { checks++; console.log(`  ok  ${label}`); });
  checks++;
  console.log(`  ok  ${label}`);
  return Promise.resolve();
};

const deps: TurnDeps = {
  catalogue: QUALIFICATIONS,
  opportunities: OPPORTUNITIES,
  now: () => new Date('2026-09-26T10:00:00Z'),
  uuid: (() => { let n = 0; return () => `t${++n}`; })(),
};

async function main() {
  console.log('\nphonetic + lexicon');

  await ok('Devanagari and Roman forms of the same trade share a phonetic key', () => {
    assert.equal(phoneticKey('सिलाई'), phoneticKey('silai'));
    assert.equal(phoneticKey('दर्जी'), phoneticKey('darzi'));
    assert.equal(phoneticKey('बुनाई'), phoneticKey('bunai'));
  });

  await ok('aspirates and sibilant variants collapse (ASR confuses exactly these)', () => {
    assert.equal(phoneticKey('shilai'), phoneticKey('silai'));
    assert.equal(phoneticKey('thaiyal'), phoneticKey('taiyal'));
    assert.equal(phoneticKey('bunkar'), phoneticKey('bunakar'));
  });

  await ok('the retroflex flap ड़/ढ़ — "badhai" vs "barhai" — resolves at concept level', () => {
    // The consonant skeleton deliberately does NOT merge D and R: that would make "das" and
    // "ras" identical and cost real recall. So this pair is carried by the surface list instead.
    // What matters is the concept, not the key.
    assert.equal(matchConcepts(['badhai ka kaam'])[0]?.conceptId, 'TRADE.CARPENTRY');
    assert.equal(matchConcepts(['barhai ka kaam'])[0]?.conceptId, 'TRADE.CARPENTRY');
    assert.equal(matchConcepts(['बढ़ई के काम'])[0]?.conceptId, 'TRADE.CARPENTRY');
  });

  await ok('a clean utterance lands on the right concept with high confidence', () => {
    const m = matchConcepts(['हम सिलाई का काम करती हूँ']);
    assert.equal(m[0].conceptId, 'TRADE.TAILORING');
    assert.ok(m[0].confidence >= 0.85, `got ${m[0].confidence}`);
  });

  await ok('the Magahi dialect form "सिवाई" still reaches TRADE.TAILORING', () => {
    const m = matchConcepts(['सिवाई करत बानी']);
    assert.equal(m[0]?.conceptId, 'TRADE.TAILORING');
  });

  await ok('a misheard transcript still classifies — the whole thesis of the build', () => {
    // "बुनाई" heard as "बुनाइ", "डेरी" heard as "देरी": a 26.8-WER model does this constantly.
    assert.equal(matchConcepts(['बुनाइ के काम'])[0]?.conceptId, 'TRADE.HANDLOOM_WEAVING');
    assert.equal(matchConcepts(['dairy ka kaam'])[0]?.conceptId, 'TRADE.DAIRY');
  });

  await ok('agreement across n-best hypotheses raises confidence', () => {
    const one = matchConcepts(['बकरी पालन']);
    const many = matchConcepts(['बकरी पालन', 'bakri palan', 'बकरी पालल']);
    assert.ok(many[0].confidence >= one[0].confidence, `${many[0].confidence} < ${one[0].confidence}`);
  });

  await ok('unrelated speech matches nothing rather than guessing', () => {
    const m = matchConcepts(['कल बारिश हुई थी और रास्ता बंद था']);
    assert.ok(m.length === 0 || m[0].confidence < 0.55, JSON.stringify(m[0]));
  });

  console.log('\nregex rung');

  await ok('years parse from words, digits and Devanagari digits', () => {
    assert.equal(extractYears('बारह साल से यही काम')?.years, 12);
    assert.equal(extractYears('12 saal')?.years, 12);
    assert.equal(extractYears('१५ वर्ष')?.years, 15);
    assert.equal(extractYears('twenty')?.years, undefined); // English words not in the table — honest miss
  });

  await ok('education parses across scripts and phrasings', () => {
    assert.equal(extractEducation(['दसवीं पास हूँ'])?.education, 'secondary');
    assert.equal(extractEducation(['8th tak padha hai'])?.education, 'middle');
    assert.equal(extractEducation(['मैंने कभी स्कूल नहीं देखा'])?.education, 'none');
    assert.equal(extractEducation(['ITI kiya hai'])?.education, 'iti_diploma');
  });

  await ok('yes/no works in Hindi, Bhojpuri and Roman', () => {
    assert.equal(extractYesNo(['जी हाँ'])?.yes, true);
    assert.equal(extractYesNo(['नइखे'])?.yes, false);
    assert.equal(extractYesNo(['haan ji'])?.yes, true);
  });

  console.log('\neligibility gate');

  const weaver: Profile = {
    education: 'none',
    occupation: { conceptId: 'TRADE.HANDLOOM_WEAVING', years: 12 },
    livelihood: null,
    skills: ['TRADE.HANDLOOM_WEAVING'],
    mobility: { constraint: 'none', radiusKm: 10 },
    pref: 'self',
    localDemand: ['TRADE.HANDLOOM_WEAVING'],
    districtName: 'Varanasi',
    blockName: 'Pindra',
  };

  await ok('NSQF Levels 1-2 need no schooling at all — the door nobody reads aloud', () => {
    const q = QUALIFICATIONS.find((x) => x.localId === 'proto-handloom-helper')!;
    const v = gate(q, weaver);
    assert.equal(v.bucket, 'ELIGIBLE', JSON.stringify(v));
    assert.match(v.route!, /No formal education required/i);
  });

  await ok('but Level 2.5 requires literacy, so a non-literate weaver is NEAR_MISS, not eligible', () => {
    // The gazette's Level 2.5 routes are: 9th pass · 8th+1yr · 5th+4yr · "ability to read and
    // write"+5yr. Every one of them has a floor this beneficiary is under. Twelve years of
    // experience does NOT substitute for literacy at 2.5 — it substitutes for *schooling*, and
    // the lowest route still asks that she can read and write.
    //
    // This is the finding the gate exists to surface rather than smooth over: for a beneficiary
    // with no schooling at all, the register's ceiling is Level 2 until a literacy step is done.
    // Saying so is R4's fourth output. Quietly marking her eligible would be the CAG's 41%.
    const q = QUALIFICATIONS.find((x) => x.localId === 'proto-handloom-weaver')!;
    const v = gate(q, weaver, { eligibleLevels: eligibleLevels(weaver) });
    assert.equal(v.bucket, 'NEAR_MISS', JSON.stringify(v));
    assert.equal(v.gap!.kind, 'level_step');
    assert.match(v.gap!.need, /Level 2\b/);
  });

  await ok('the same weaver who can read and write DOES clear Level 2.5 on experience alone', () => {
    const literate: Profile = { ...weaver, education: 'read_write' };
    const q = QUALIFICATIONS.find((x) => x.localId === 'proto-handloom-weaver')!;
    const v = gate(q, literate);
    assert.equal(v.bucket, 'ELIGIBLE', JSON.stringify(v));
    assert.match(v.route!, /read and write \+ 5 years/i);
    assert.match(v.route!, /12 years in the same trade/);
  });

  await ok('experience is only credited when it is RELEVANT', () => {
    const welding = QUALIFICATIONS.find((x) => x.localId === 'proto-welder')!;
    const v = gate(welding, weaver);
    // 12 years of weaving must not unlock a Level 3 welding course.
    assert.notEqual(v.bucket, 'ELIGIBLE', JSON.stringify(v));
  });

  await ok('a related trade counts at half — weaver to embroidery', () => {
    // 12 years of weaving is credited as 6 towards embroidery: both textile, genuinely closer
    // than weaving is to welding, but not the same trade. 6 >= the 5 years the read/write route
    // asks for, so she clears it.
    const emb = QUALIFICATIONS.find((x) => x.localId === 'proto-embroiderer')!;
    const v = gate(emb, { ...weaver, education: 'read_write' });
    assert.equal(v.bucket, 'ELIGIBLE', JSON.stringify(v));
    assert.match(v.route!, /half/i);
  });

  await ok('NEAR_MISS states the exact gap, and it is a years gap when it can be', () => {
    const short: Profile = { ...weaver, education: 'primary', occupation: { conceptId: 'TRADE.HANDLOOM_WEAVING', years: 4 } };
    const l3 = QUALIFICATIONS.find((x) => x.localId === 'proto-carpenter')!;
    const near: Profile = { ...short, occupation: { conceptId: 'TRADE.CARPENTRY', years: 4 } };
    const v = gate(l3, near, { eligibleLevels: eligibleLevels(near) });
    assert.equal(v.bucket, 'NEAR_MISS', JSON.stringify(v));
    assert.equal(v.gap!.kind, 'years');
    assert.match(v.gap!.need, /1 more year|RPL/i);
  });

  await ok('levels with no gazette row are INELIGIBLE, never guessed', () => {
    const fake = { ...QUALIFICATIONS[0], level: 5.5, levelLabel: 'Level 5.5' };
    const v = gate(fake, weaver);
    assert.equal(v.bucket, 'INELIGIBLE');
    assert.match(v.reasons[0], /ENTRY_REQUIREMENT_NOT_IN_SOURCE/);
  });

  await ok('a physical constraint blocks a high-demand role but not a low-demand one', () => {
    const p: Profile = { ...weaver, mobility: { constraint: 'physical', radiusKm: 5 } };
    const mason = QUALIFICATIONS.find((x) => x.localId === 'proto-mason')!;
    // Level 2, low physical demand — so the only thing under test is the physical dimension.
    const tailorHelper = QUALIFICATIONS.find((x) => x.localId === 'proto-tailor-helper')!;
    assert.equal(gate(mason, p).bucket, 'INELIGIBLE');
    const v = gate(tailorHelper, { ...p, occupation: { conceptId: 'TRADE.TAILORING', years: 12 }, skills: ['TRADE.TAILORING'] });
    assert.equal(v.bucket, 'ELIGIBLE', JSON.stringify(v));
  });

  await ok('a centre beyond the stated radius is NEAR_MISS on distance, not silently dropped', () => {
    // Level 2 so the entry requirement is unambiguously met and distance is the only variable.
    const q = QUALIFICATIONS.find((x) => x.localId === 'proto-handloom-helper')!;
    const v = gate(q, { ...weaver, mobility: { constraint: 'distance', radiusKm: 3 } }, { nearestCentreKm: () => 12 });
    assert.equal(v.bucket, 'NEAR_MISS', JSON.stringify(v));
    assert.equal(v.gap!.kind, 'distance');
    assert.match(v.gap!.need, /9 km beyond/);
  });

  console.log('\nrecommender');

  await ok('gate runs before rank — nothing ineligible reaches top[]', () => {
    const r = recommend(weaver, { catalogue: QUALIFICATIONS, opportunities: OPPORTUNITIES });
    assert.ok(r.top.length > 0);
    assert.ok(r.top.every((t) => t.gate.bucket === 'ELIGIBLE'), JSON.stringify(r.top.map((t) => t.gate.bucket)));
  });

  await ok('R4 output 4 has a producer: a NEAR_MISS with a stated gap comes back', () => {
    const p: Profile = { ...weaver, education: 'middle', occupation: { conceptId: 'TRADE.CARPENTRY', years: 1 }, skills: ['TRADE.CARPENTRY'] };
    const r = recommend(p, { catalogue: QUALIFICATIONS });
    assert.ok(r.nearMiss.length > 0, 'no NEAR_MISS produced');
    assert.ok(r.nearMiss[0].gate.gap, 'NEAR_MISS carries no gap');
  });

  await ok('Q6 changes the ordering inside the trade she actually asked for', () => {
    // A literate tailor of 12 years clears both the Level 2 helper (not self-employable) and the
    // Level 2.5 "Self Employed Tailor" (self-employable), so preference is the deciding factor
    // and nothing else moves.
    //
    // Note what is NOT asserted: that "self" forces a self-employable pick overall. Only 25 of
    // the 1,199 valid ≤L4 rows in the real register are entrepreneurship-shaped, so demanding
    // that would push her out of her own trade and into whatever happens to be self-employable.
    // Aspiration leads; preference orders. The weights are in recommend.ts and versioned.
    const tailor: Profile = {
      ...weaver,
      education: 'read_write',
      occupation: { conceptId: 'TRADE.TAILORING', years: 12 },
      skills: ['TRADE.TAILORING'],
      localDemand: ['TRADE.TAILORING'],
    };
    const rank = (p: Profile) => {
      const r = recommend(p, { catalogue: QUALIFICATIONS, topN: 10 });
      const ids = r.top.map((t) => t.qualification.localId);
      return { self: ids.indexOf('proto-self-tailor'), helper: ids.indexOf('proto-tailor-helper') };
    };
    const wantsOwn = rank({ ...tailor, pref: 'self' });
    const wantsJob = rank({ ...tailor, pref: 'wage' });
    assert.ok(wantsOwn.self >= 0 && wantsOwn.helper >= 0, JSON.stringify(wantsOwn));
    assert.ok(wantsOwn.self < wantsOwn.helper, `"own work" should prefer Self Employed Tailor: ${JSON.stringify(wantsOwn)}`);
    assert.ok(wantsJob.helper < wantsJob.self, `"a job" should prefer the helper role: ${JSON.stringify(wantsJob)}`);
  });

  await ok('every recommendation is auditable: weights, engine and provenance are stamped', () => {
    const r = recommend(weaver, { catalogue: QUALIFICATIONS });
    assert.ok(r.weightsVersion && r.engineVersion);
    assert.equal(r.containsPrototypeData, true, 'prototype catalogue must be flagged as such');
    const a = r.top[0].explain.auditor as Record<string, unknown>;
    assert.equal(a.qpCode, null, 'prototype rows must expose a NULL qp code, never an invented one');
    assert.ok(a.components && a.inputs && a.weightsVersion);
  });

  await ok('PM-DAKSH routing refuses to assume an age nobody asked for', () => {
    const r = recommend(weaver, { catalogue: QUALIFICATIONS });
    assert.equal(r.routeToPmDaksh!.route, false);
    assert.match(r.routeToPmDaksh!.reason, /age_unknown/);
    const r2 = recommend({ ...weaver, ageBand: '18_45' }, { catalogue: QUALIFICATIONS });
    assert.equal(r2.routeToPmDaksh!.route, true);
  });

  await ok('the spread penalty actually demotes an over-recommended trade', () => {
    const hist = new Map([['TRADE.HANDLOOM_WEAVING', 900], ['TRADE.DAIRY', 5]]);
    const plain = recommend(weaver, { catalogue: QUALIFICATIONS });
    const skewed = recommend(weaver, { catalogue: QUALIFICATIONS, districtHistogram: hist });
    const before = plain.top[0].score;
    const after = skewed.top.find((t) => t.qualification.concepts.includes('TRADE.HANDLOOM_WEAVING'))?.score ?? 0;
    assert.ok(after < before, `spread penalty did nothing: ${after} !< ${before}`);
  });

  await ok('spreadReport reproduces the CAG statistic shape', () => {
    const rep = spreadReport(new Map([['a', 40], ['b', 30], ['c', 30]]), 1);
    assert.equal(rep.total, 100);
    assert.ok(Math.abs(rep.topShare - 0.4) < 1e-9);
  });

  console.log('\nFSM — a full interview');

  const t = async (s: SessionState, u: Utterance, channel: 'app' | 'ivr' = 'app') => {
    const req: TurnRequest = { channel, channelRef: 'test', identity: { kind: 'device', value: 'dev1' }, utterance: u };
    return turn(s, req, deps);
  };

  let s = startSession({ channel: 'app', now: deps.now, uuid: deps.uuid });
  let r = await t(s, { kind: 'opened' });

  await ok('the interview opens on language select, not on a question', () => {
    assert.equal(r.session.state, 'LANG_SELECT');
    assert.equal(r.expect.kind, 'enum');
  });

  r = await t(r.session, { kind: 'choice', optionId: 'hi' });
  await ok('Q0 (village/block) is asked before consent — it is registration metadata', () => {
    assert.equal(r.session.state, 'Q0_VILLAGE_BLOCK');
  });

  r = await t(r.session, { kind: 'text', value: 'Pindra' });
  r = await t(r.session, { kind: 'choice', optionId: 'yes' });
  await ok('consent is an FSM state, and declining ends the call politely', async () => {
    assert.equal(r.session.state, 'CONSENT');
    const declined = await t(r.session, { kind: 'choice', optionId: 'no' });
    assert.equal(declined.session.consentState, 'NONE');
    assert.equal(declined.terminal, true);
    assert.equal(declined.session.status, 'ABANDONED');
  });

  r = await t(r.session, { kind: 'choice', optionId: 'yes' });
  await ok('consent yes emits a consent_event carrying the script version actually heard', () => {
    const ev = r.events.find((e) => e.type === 'consent.record');
    assert.ok(ev, 'no consent event');
    assert.equal((ev as { scriptVersion: string }).scriptVersion, 'consent.ask.v1');
    assert.equal(r.session.state, 'IDENTIFY');
    assert.equal(r.expect.kind, 'pin');
  });

  r = await t(r.session, { kind: 'dtmf', digits: '4291' });
  await ok('the resume PIN is captured and Q1 follows', () => {
    assert.equal(r.session.resumePin, '4291');
    assert.equal(r.session.state, 'Q1_EDUCATION');
  });

  r = await t(r.session, { kind: 'audio', transcripts: ['कभी स्कूल नहीं गई'], asrEngine: 'test', asrVersion: '0' });
  await ok('a high-confidence answer still goes through spoken confirmation', () => {
    assert.equal(r.session.phase, 'CONFIRM');
    assert.equal(r.session.answers[1]!.confirmedAt, null);
    assert.ok(r.session.answers[1]!.rawTranscript, 'transcript should exist BEFORE confirmation');
  });

  r = await t(r.session, { kind: 'choice', optionId: 'yes' });
  await ok('CONFIRM erases the transcript and the n-best, and emits the erase event', () => {
    const a = r.session.answers[1]!;
    assert.ok(a.confirmedAt, 'not confirmed');
    assert.equal(a.rawTranscript, null, 'transcript survived confirmation — DPDP violation');
    assert.equal(a.nbest, null, 'n-best survived confirmation');
    assert.ok(r.events.some((e) => e.type === 'transcript.erase'));
  });

  r = await t(r.session, { kind: 'audio', transcripts: ['हमरा घर में बुनाई होखे ला'], asrEngine: 'test', asrVersion: '0' });
  r = await t(r.session, { kind: 'choice', optionId: 'yes' });
  await ok('Q2 splits into trade then years, and stays field 2 throughout', () => {
    assert.equal(r.session.state, 'Q2_YEARS');
    assert.equal(r.expect.kind, 'number');
    assert.equal(Object.keys(r.session.answers).length, 2);
  });

  r = await t(r.session, { kind: 'audio', transcripts: ['बारह साल'], asrEngine: 'test', asrVersion: '0' });
  r = await t(r.session, { kind: 'choice', optionId: 'yes' });
  await ok('twelve years of experience triggers the eligibility sentence, not a shrug', () => {
    assert.equal((r.session.answers[2]!.value as { years: number }).years, 12);
    assert.ok(r.say.some((x) => x.id === 'q2.eligibility.good.v1'), JSON.stringify(r.say.map((x) => x.id)));
    assert.equal(r.session.state, 'Q3_CURRENT_LIVELIHOOD');
  });

  // Q3..Q7
  const answerAndConfirm = async (st: SessionState, u: Utterance) => {
    const a = await t(st, u);
    return t(a.session, { kind: 'choice', optionId: 'yes' });
  };
  r = await answerAndConfirm(r.session, { kind: 'audio', transcripts: ['दिहाड़ी पर मज़दूरी'], asrEngine: 'test', asrVersion: '0' });
  r = await answerAndConfirm(r.session, { kind: 'audio', transcripts: ['बुनाई और सिलाई सीखना है'], asrEngine: 'test', asrVersion: '0' });
  r = await answerAndConfirm(r.session, { kind: 'audio', transcripts: ['पाँच किलोमीटर तक जा सकती हूँ'], asrEngine: 'test', asrVersion: '0' });
  r = await answerAndConfirm(r.session, { kind: 'audio', transcripts: ['अपना काम करना है'], asrEngine: 'test', asrVersion: '0' });
  r = await answerAndConfirm(r.session, { kind: 'audio', transcripts: ['यहाँ कपड़े की मांग है'], asrEngine: 'test', asrVersion: '0' });

  await ok('all seven confirmed, in order, and the readback comes next', () => {
    const confirmed = ([1, 2, 3, 4, 5, 6, 7] as FieldNo[]).filter((n) => r.session.answers[n]?.confirmedAt);
    assert.equal(confirmed.length, 7, `only ${confirmed.length} confirmed: ${confirmed}`);
    assert.equal(r.session.state, 'READBACK');
  });

  r = await t(r.session, { kind: 'opened' });
  await ok('readback speaks every field back before anything is recommended', () => {
    assert.ok(r.say.length >= 8, `readback said ${r.say.length} lines`);
    assert.equal(r.session.phase, 'CONFIRM');
  });

  r = await t(r.session, { kind: 'choice', optionId: 'yes' });
  await ok('the recommendation arrives with three explanations and an outcome row', () => {
    assert.ok(r.recommendation, 'no recommendation on the turn result');
    assert.ok(r.recommendation!.top.length > 0);
    const top = r.recommendation!.top[0];
    assert.ok(top.explain.beneficiary.length > 0);
    assert.ok(top.explain.officer.length > 0);
    assert.ok(top.explain.auditor);
    assert.ok(r.events.some((e) => e.type === 'recommendation.create'));
    assert.ok(r.events.some((e) => e.type === 'outcome.upsert'));
  });

  console.log('\nFSM — the paths that actually happen in the field');

  await ok('two failed extractions then a DTMF fallback, then DEFER — never a hang-up', async () => {
    let x = startSession({ channel: 'ivr', now: deps.now, uuid: deps.uuid });
    x = { ...x, state: 'Q4_SKILLS_INTERESTS', phase: 'LISTEN', consentState: 'GIVEN' };
    const noise: Utterance = { kind: 'audio', transcripts: ['खरखर आवाज़ कुछ समझ नहीं'], asrEngine: 'test', asrVersion: '0' };
    let y = await t(x, noise, 'ivr');
    assert.equal(y.session.reAskCount, 1);
    y = await t(y.session, noise, 'ivr');
    assert.equal(y.expect.kind, 'enum', 're-ask 2 should offer the closed set');
    y = await t(y.session, noise, 'ivr');
    assert.equal(y.session.phase, 'DTMF_FALLBACK');
    y = await t(y.session, noise, 'ivr');
    assert.ok(y.session.deferred.includes(4), 'field 4 should be deferred, not fatal');
    assert.equal(y.terminal, false, 'the system must not hang up on someone it cannot understand');
  });

  await ok('a dropped call leaves the session RESUMABLE and the answers intact', async () => {
    const y = await t(r.session, { kind: 'hangup', reason: 'network' }, 'ivr');
    assert.ok(y.terminal);
    assert.equal(Object.keys(y.session.answers).length, 7);
  });

  await ok('planResume returns the first UNCONFIRMED field, never a confirmed one', () => {
    const answers: Partial<Record<FieldNo, Answer>> = {
      1: { ...r.session.answers[1]! },
      2: { ...r.session.answers[2]!, confirmedAt: null },
    };
    assert.equal(planResume(answers), 'Q2_FAMILY_OCCUPATION');
    assert.equal(planResume(r.session.answers), null); // all seven done
  });

  await ok('BLOCKER 1: the resume gate reveals nothing before the PIN clears', async () => {
    const shared: SessionState = { ...r.session, state: 'RESUME_GATE', resumePin: '4291', pinAttempts: 0 };
    const wrong = await t(shared, { kind: 'dtmf', digits: '1111' }, 'ivr');
    const spoken = wrong.say.map((x) => ('text' in x ? x.text : '')).join(' ');
    // A brother entering a wrong PIN must not hear his sister's education, trade or disability.
    assert.ok(!/बुनाई|weaving|दिहाड़ी|स्कूल/.test(spoken), `leaked prior answers: ${spoken}`);
    assert.equal(wrong.session.pinAttempts, 1);
    const wrongAgain = await t(wrong.session, { kind: 'dtmf', digits: '2222' }, 'ivr');
    // Two failures → a NEW record, never a lockout and never an overwrite of hers.
    assert.notEqual(wrongAgain.session.beneficiaryId, r.session.beneficiaryId);
    assert.equal(Object.keys(wrongAgain.session.answers).length, 0);
  });

  await ok('the correct PIN resumes, and only then is anything spoken', async () => {
    const partial: SessionState = {
      ...r.session,
      state: 'RESUME_GATE',
      resumePin: '4291',
      pinAttempts: 0,
      answers: { 1: r.session.answers[1]!, 2: { ...r.session.answers[2]!, confirmedAt: null } },
    };
    const good = await t(partial, { kind: 'dtmf', digits: '4291' }, 'ivr');
    assert.equal(good.session.state, 'Q2_FAMILY_OCCUPATION');
    assert.equal(good.session.resumedFrom, 'Q2_FAMILY_OCCUPATION');
  });

  await ok('DPDP Rule 11: the guardian branch fires on capacity, and only after a physical disclosure', async () => {
    let x = startSession({ channel: 'app', now: deps.now, uuid: deps.uuid });
    x = { ...x, state: 'Q5_MOBILITY_CONSTRAINT', phase: 'LISTEN', consentState: 'GIVEN' };
    let y = await t(x, { kind: 'choice', optionId: 'physical:5' });
    y = await t(y.session, { kind: 'choice', optionId: 'yes' });
    assert.equal(y.session.state, 'GUARDIAN_CHECK');
    // "No court-appointed guardian" must proceed normally. Treating every disclosed condition as
    // incapacity is its own dignity failure.
    const no = await t(y.session, { kind: 'choice', optionId: 'no' });
    assert.equal(no.session.state, 'Q6_EMPLOYMENT_PREF');
    assert.equal(no.session.consentState, 'GIVEN');
    const yes = await t(y.session, { kind: 'choice', optionId: 'yes' });
    assert.equal(yes.session.consentState, 'GUARDIAN_PENDING');
    assert.equal(yes.terminal, true);

    // And a distance-only answer must NOT trigger it at all.
    let z = await t({ ...x }, { kind: 'choice', optionId: 'distance:10' });
    z = await t(z.session, { kind: 'choice', optionId: 'yes' });
    assert.equal(z.session.state, 'Q6_EMPLOYMENT_PREF');
  });

  await ok('a new channel triggers a purpose restatement (spec §9 MINOR 1)', async () => {
    let x: SessionState = { ...r.session, state: 'Q3_CURRENT_LIVELIHOOD', phase: 'LISTEN', consentState: 'GIVEN', noticedChannels: ['app'] };
    const y = await t(x, { kind: 'audio', transcripts: ['अपना काम'], asrEngine: 'test', asrVersion: '0' }, 'ivr');
    assert.ok(y.say.some((p) => p.id === 'consent.newchannel.v1'), JSON.stringify(y.say.map((p) => p.id)));
    assert.ok(y.session.noticedChannels.includes('ivr'));
  });

  console.log('\nprompts, data and coverage');

  await ok('every prompt referenced by the FSM exists in the registry', () => {
    // The FSM builds ids by convention; a typo would only show up at runtime on a live call.
    const prefixes = ['q0', 'q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7'];
    for (const p of prefixes) {
      say(`${p}.ask.v1`, 'hi');
      say(`${p}.confirm.v1`, 'hi');
    }
    for (const p of ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7']) say(`${p}.reask1.v1`, 'hi');
    for (const id of ['consent.ask.v1', 'consent.declined.v1', 'consent.newchannel.v1', 'pin.set.v1', 'pin.ask.v1',
      'pin.wrong.v1', 'resume.ack.v1', 'guardian.check.v1', 'guardian.defer.v1', 'readback.intro.v1',
      'readback.confirm.v1', 'readback.which.v1', 'recommend.intro.v1', 'recommend.nearmiss.intro.v1',
      'recommend.none.v1', 'recommend.pmdaksh.v1', 'recommend.financial.v1', 'recommend.assetgrant.v1',
      'nextstep.v1', 'close.v1', 'ack.hmm.v1', 'ack.got.v1', 'defer.v1', 'q2.years.ask.v1',
      'lang.select.v1', 'q0.reask.v1', 'timeout.v1', 'dropped.sms.v1']) say(id, 'hi');
  });

  await ok('placeholders fill, and a missing locale falls back rather than going silent', () => {
    const p = say('q2.confirm.v1', 'hi', { value: 'बुनाई', years: 12 });
    assert.ok(p.text.includes('बुनाई') && p.text.includes('12'));
    assert.ok(!p.text.includes('{'));
    const r2 = say('q3.ask.v1', 'raj'); // Rajasthani not authored for this prompt
    assert.equal(r2.fellBack, true);
    assert.equal(r2.usedLocale, 'hi');
  });

  await ok('no prompt claims a native-speaker review it has not had', () => {
    const reviewed = PROMPTS.filter((p) => Object.values(p.review).includes('NATIVE_REVIEWED'));
    assert.equal(reviewed.length, 0, 'someone marked a prompt NATIVE_REVIEWED — was it actually reviewed?');
    const cov = promptCoverage();
    assert.ok(cov.find((c) => c.locale === 'hi')!.authored === PROMPTS.length, 'Hindi must be fully authored');
  });

  await ok('no qualification carries an invented QP code', () => {
    const invented = QUALIFICATIONS.filter((q) => q.qpCode !== null && q.source !== 'NQR_OFFICIAL');
    assert.equal(invented.length, 0, `invented codes: ${invented.map((q) => q.qpCode)}`);
  });

  await ok('every lexicon entry has an Annexure I home — GIA cannot fund the rest', () => {
    const orphans = LEXICON.filter((e) => !e.annexureDomain);
    assert.equal(orphans.length, 0, `no Annexure I domain: ${orphans.map((e) => e.conceptId)}`);
  });

  await ok('no lexicon entry claims an NQR code before the import has run', () => {
    const claimed = LEXICON.filter((e) => (e.nqrCodes?.length ?? 0) > 0);
    assert.equal(claimed.length, 0, `claims NQR codes: ${claimed.map((e) => e.conceptId)}`);
  });

  await ok('every opportunity row is either sourced or visibly flagged as a placeholder', () => {
    const rep = provenanceReport();
    assert.ok(rep.sourced > 0, 'not one sourced opportunity row');
    assert.ok(rep.placeholder === 0 || rep.warning, 'placeholders exist with no warning string');
    for (const o of OPPORTUNITIES) {
      assert.ok(o.source.length > 0, `${o.title} has no source at all`);
    }
  });

  await ok('requirement coverage is honest about what is still PARTIAL', () => {
    const cov = requirementCoverage();
    assert.equal(cov.length, 9);
    const partial = cov.filter((c) => c.status === 'PARTIAL').map((c) => c.id);
    // R2 and R7 cannot be COVERED until the dialect measurement and the native prompt pass exist.
    assert.ok(partial.includes('R2') && partial.includes('R7'), `R2/R7 must stay PARTIAL, got ${partial}`);
  });

  await ok('profileFrom survives a half-finished interview without inventing answers', () => {
    const half = startSession({ channel: 'app', now: deps.now, uuid: deps.uuid });
    const p = profileFrom({ ...half, answers: { 1: r.session.answers[1]! } });
    assert.equal(p.occupation, null);
    assert.deepEqual(p.skills, []);
    assert.equal(p.ageBand, null);
  });

  await ok('describeAnswer renders every answer kind in both registers', () => {
    for (const n of [1, 2, 3, 4, 5, 6, 7] as FieldNo[]) {
      const a = r.session.answers[n]!;
      assert.ok(describeAnswer(a.value, 'hi').length > 0, `field ${n} hi`);
      assert.ok(describeAnswer(a.value, 'en').length > 0, `field ${n} en`);
    }
  });

  console.log(`\n${checks} checks passed\n`);
}

main().catch((e) => {
  console.error('\nFAILED:', e instanceof Error ? e.message : e);
  process.exit(1);
});
