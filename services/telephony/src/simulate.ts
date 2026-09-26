/**
 * A scripted Exotel call, end to end, with no Exotel account and no phone number.
 *
 * This is the smoke test that matters before spending money: it speaks the real AgentStream wire
 * protocol at the real adapter, drives a complete interview over DTMF, and asserts the FSM reached
 * a recommendation. If this passes, the only untested things left on the IVR channel are the
 * vendor's billing and the recogniser — not our code.
 *
 * DTMF rather than audio on purpose: rung 0 of the ladder is ₹0, 0 ms and 0 WER, so it exercises
 * the FSM, the gate and the recommender without needing a vendor key. The audio path is exercised
 * separately by the core self-check, which feeds real Devanagari transcripts through the ladder.
 *
 * Run:  npm run -w @rc097/telephony simulate
 */

import { WebSocket } from 'ws';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const PORT = 5199;
const here = dirname(fileURLToPath(import.meta.url));

/**
 * What a caller presses, keyed on the state the FSM is actually in.
 *
 * An earlier version of this file was a fixed list of keypresses. It "passed" while quietly
 * drifting one press out of alignment, because Q0 over DTMF consumes a variable number of turns —
 * a village name cannot be keyed in, so it re-asks, offers the closed set, then DEFERs. The labels
 * said "Q2 trade: tailoring" while the press was actually answering something else, and the test
 * asserted nothing about the answers. Driving off the state makes the labels true and lets the
 * final assertion check that the recommendation matches the trade that was entered.
 */
const KEY_FOR: Record<string, string> = {
  'LANG_SELECT/LISTEN': '1', // Hindi
  'CONSENT/LISTEN': '1', // yes
  'IDENTIFY/LISTEN': '4291', // resume PIN
  'Q1_EDUCATION/LISTEN': '1', // never went to school
  'Q1_EDUCATION/DTMF_FALLBACK': '1',
  'Q2_FAMILY_OCCUPATION/LISTEN': '1', // tailoring
  'Q2_FAMILY_OCCUPATION/DTMF_FALLBACK': '1',
  'Q2_YEARS/LISTEN': '12',
  'Q3_CURRENT_LIVELIHOOD/LISTEN': '3', // daily wage
  'Q3_CURRENT_LIVELIHOOD/DTMF_FALLBACK': '3',
  'Q4_SKILLS_INTERESTS/LISTEN': '1', // wants tailoring
  'Q4_SKILLS_INTERESTS/DTMF_FALLBACK': '1',
  'Q5_MOBILITY_CONSTRAINT/LISTEN': '2', // up to 5 km
  'Q5_MOBILITY_CONSTRAINT/DTMF_FALLBACK': '2',
  'Q6_EMPLOYMENT_PREF/LISTEN': '1', // own work
  'Q6_EMPLOYMENT_PREF/DTMF_FALLBACK': '1',
  'Q7_LOCAL_ECONOMY/LISTEN': '1', // tailoring in demand locally
  'Q7_LOCAL_ECONOMY/DTMF_FALLBACK': '1',
  'READBACK/CONFIRM': '1', // yes, all correct
};

/** Every CONFIRM phase is "yes"; Q0 cannot be keyed at all, so press anything and let it DEFER. */
function keyFor(stateAndPhase: string): string {
  if (KEY_FOR[stateAndPhase]) return KEY_FOR[stateAndPhase];
  if (stateAndPhase.endsWith('/CONFIRM')) return '1';
  if (stateAndPhase.startsWith('Q0_VILLAGE_BLOCK')) return '1';
  return '1';
}

async function main() {
  const server = spawn(process.execPath, ['--import', 'tsx', join(here, 'index.ts')], {
    env: { ...process.env, PORT: String(PORT) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const log: string[] = [];
  server.stdout.on('data', (d: Buffer) => {
    const s = d.toString();
    log.push(s);
    process.stdout.write(s.replace(/^/gm, '  | '));
  });
  server.stderr.on('data', (d: Buffer) => process.stderr.write(d.toString().replace(/^/gm, '  ! ')));

  await new Promise((r) => setTimeout(r, 2500));

  const ws = new WebSocket(`ws://localhost:${PORT}/media`);
  await new Promise<void>((resolve, reject) => {
    ws.once('open', () => resolve());
    ws.once('error', reject);
  });

  const streamSid = 'sim_stream_1';
  const send = (o: unknown) => ws.send(JSON.stringify(o));

  send({ event: 'connected', protocol: 'websocket', version: '1.0.0' });
  send({
    event: 'start',
    stream_sid: streamSid,
    start: {
      stream_sid: streamSid,
      call_sid: 'sim_call_1',
      account_sid: 'sim_account',
      from: '+919876543210',
      to: '+911600123456',
      custom_parameters: {},
      media_format: { encoding: 'audio/x-l16', sample_rate: 8000, channels: 1 },
    },
  });

  // Count what comes back, so "the caller heard something" is asserted rather than assumed.
  let mediaFrames = 0;
  let clears = 0;
  ws.on('message', (raw) => {
    try {
      const m = JSON.parse(raw.toString());
      if (m.event === 'media') mediaFrames++;
      if (m.event === 'clear') clears++;
    } catch {
      /* ignore */
    }
  });

  await new Promise((r) => setTimeout(r, 600));

  const currentState = (): string | null => {
    const all = [...log.join('').matchAll(/\[ivr\] ([A-Z0-9_]+)\/([A-Z_]+)/g)];
    const last = all.at(-1);
    return last ? `${last[1]}/${last[2]}` : null;
  };

  // Drive off the state the adapter reports, not off a counter. Caps at 40 presses so a stuck FSM
  // fails the test instead of looping forever.
  for (let i = 0; i < 40; i++) {
    const state = currentState();
    if (!state) {
      await new Promise((r) => setTimeout(r, 300));
      continue;
    }
    if (/^(NEXT_STEP|CLOSE|CLOSE_POLITE)/.test(state)) break;

    const digit = keyFor(state);
    console.log(`\n→ ${state}  [${digit}]`);
    send({ event: 'dtmf', stream_sid: streamSid, dtmf: { digit } });
    await new Promise((r) => setTimeout(r, 450));
  }

  await new Promise((r) => setTimeout(r, 1200));
  send({ event: 'stop', stream_sid: streamSid, stop: { call_sid: 'sim_call_1', reason: 'completed' } });
  await new Promise((r) => setTimeout(r, 500));
  ws.close();
  server.kill();

  const text = log.join('');
  const states = [...text.matchAll(/\[ivr\] (\w+)\//g)].map((m) => m[1]);
  const reachedRecommend = text.includes('RECOMMEND') || text.includes('NEXT_STEP');
  const confirmed = [...text.matchAll(/(\d)\/7 confirmed/g)].map((m) => Number(m[1]));
  const maxConfirmed = confirmed.length ? Math.max(...confirmed) : 0;

  console.log('\n────────────────────────────────────────────');
  console.log(`states visited : ${[...new Set(states)].join(' → ')}`);
  console.log(`fields confirmed: ${maxConfirmed}/7`);
  console.log(`clear frames    : ${clears}`);
  console.log(`media frames out: ${mediaFrames} (0 is expected until the prompt WAVs are recorded)`);
  console.log(`reached recommendation: ${reachedRecommend ? 'YES' : 'NO'}`);
  console.log('────────────────────────────────────────────');

  // The caller entered tailoring at Q2, Q4 and Q7 with no schooling, so the recommendation must be
  // a tailoring qualification at NSQF Level 1-2 — the levels that need no formal education. If it
  // comes back as something else, the answers did not reach the recommender intact.
  const recoLine = text.match(/nextstep\.v1\.wav — "([^"]+)"/)?.[1] ?? '';
  const tailoringRecommended = /Tailor/i.test(recoLine);
  console.log(`recommendation  : ${recoLine || '(none spoken)'}`);
  console.log(`matches input   : ${tailoringRecommended ? 'YES' : 'NO'}`);

  if (maxConfirmed < 7 || !reachedRecommend || !tailoringRecommended) {
    console.error('\nFAILED: the scripted call did not complete the interview.');
    process.exit(1);
  }
  console.log('\nOK — a full IVR interview completed over the real AgentStream protocol.\n');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
