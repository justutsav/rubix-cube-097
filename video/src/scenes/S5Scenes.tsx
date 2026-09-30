import React from 'react';
import { interpolate, Easing } from 'remotion';
import { T } from '../theme';
import { SourceShot, Cite } from '../components/SourceShot';
import { DIALECTS, LINE_RUNS } from '../s5Timeline';

/**
 * Section 5 is the one section that may not decorate. Every document on screen is a
 * real render of a real page out of `docs/references`, every highlight is the real
 * word box, and every number is carried with the thing it came from still attached.
 * Where a figure is ours rather than a source's, the frame says what it does not
 * cover — that admission is the section, not a footnote on it.
 */
const E = { easing: Easing.out(Easing.cubic), extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const show = (t: number, from: number, len = 0.42) => interpolate(t, [from, from + len], [0, 1], E);
const ease = (t: number, a: number, b: number, from: number, to: number) =>
  interpolate(t, [a, b], [from, to], E);

const D = {
  amber: '#b45309',
  red: T.red,
  green: T.mintDeep,
  blue: T.blue,
} as const;

const Stage: React.FC<{ children: React.ReactNode; gap?: number; pad?: string }> = ({
  children, gap = 28, pad = '118px 84px 148px',
}) => (
  <div style={{
    position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', gap, padding: pad,
  }}>{children}</div>
);

const Kicker: React.FC<{ children: React.ReactNode; o: number; color?: string }> = ({
  children, o, color = D.amber,
}) => (
  <div style={{ font: `800 21px/1 ${T.font}`, color, letterSpacing: 3.4, opacity: o }}>{children}</div>
);

const Head: React.FC<{ children: React.ReactNode; o: number; size?: number; color?: string }> = ({
  children, o, size = 60, color = T.ink,
}) => (
  <div style={{
    font: `900 ${size}px/1.1 ${T.font}`, color, textAlign: 'center',
    letterSpacing: -1.4, opacity: o, transform: `translateY(${(1 - o) * 16}px)`,
  }}>{children}</div>
);

/** The line that says what a number of ours does NOT cover. Always on the same frame as the number. */
const Caveat: React.FC<{ children: React.ReactNode; o: number }> = ({ children, o }) => (
  <div style={{
    opacity: o, display: 'inline-flex', alignItems: 'center', gap: 12,
    padding: '11px 20px', borderRadius: 12, background: '#fff7ed', border: '1px solid #fed7aa',
    font: `600 21px/1.3 ${T.font}`, color: '#9a3412',
  }}>
    <span style={{ font: `800 20px/1 ${T.font}` }}>!</span>{children}
  </div>
);

const card: React.CSSProperties = {
  background: '#fff', borderRadius: 18, border: `1px solid ${T.line}`, boxShadow: T.shadowSm,
};

/* 1 ─ four documents, and not one interview ──────────────────────────────── */
export const S5Sources: React.FC<{ t: number }> = ({ t }) => (
  <Stage gap={22} pad="104px 80px 148px">
    <Kicker o={show(t, 0.05)}>NO SURVEY · NO FIELD STUDY · WE READ THE DOCUMENTS</Kicker>
    <Head o={show(t, 0.25)} size={56}>We did not invent this problem. It is on the record.</Head>

    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 34, marginTop: 10 }}>
      <SourceShot
        id="cagcover" t={t} width={306} appear={4.0}
        chip={<Cite o={show(t, 4.5)}>CAG Report No. 20 of 2025</Cite>}
      />
      <SourceShot
        id="pmcover" t={t} width={306} appear={7.5}
        swipes={[{ name: 'title', at: 8.1 }]}
        chip={<Cite o={show(t, 8.0)}>PM-AJAY Guidelines · May 2023</Cite>}
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <SourceShot
          id="gazette" t={t} width={742} appear={6.0}
          swipes={[{ name: 'notified', at: 6.6 }]}
          chip={<Cite o={show(t, 6.5)}>NSQF gazette notification · June 2023</Cite>}
        />
        <SourceShot
          id="nqr" t={t} width={742} appear={9.0}
          swipes={[{ name: 'record', at: 9.5 }]}
          chip={<Cite o={show(t, 9.5)}>NSQF gazette ¶6.2 · National Qualification Register</Cite>}
        />
      </div>
    </div>
  </Stage>
);

/* 2 ─ the admission, with the real numbers ───────────────────────────────── */
export const S5Dialects: React.FC<{ t: number }> = ({ t }) => {
  const grow = ease(t, 1.2, 2.8, 0, 1);
  const max = 50;
  return (
    <Stage gap={24}>
      <Kicker o={show(t, 0.05)} color={D.red}>THE ONE THING WE WILL NOT CLAIM</Kicker>
      <Head o={show(t, 0.2)}>We have not solved dialects.</Head>

      <div style={{ ...card, width: 1320, padding: '26px 34px 22px', marginTop: 4, opacity: show(t, 0.6) }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 18 }}>
          <div style={{ font: `800 19px/1 ${T.font}`, color: T.inkSoft, letterSpacing: 1.8 }}>
            BEST PUBLISHED WORD ERROR RATE
          </div>
          <div style={{ font: `600 19px/1 ${T.font}`, color: T.inkSoft }}>
            ARTPARK-IISc SraVaani-1.0 · avg WER
          </div>
        </div>
        {DIALECTS.map((d, i) => {
          const o = show(t, 1.1 + i * 0.28);
          const w = (d.wer / max) * grow;
          return (
            <div key={d.name} style={{ marginBottom: 13, opacity: o }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ font: `700 25px/1.2 ${T.font}`, color: d.spoken ? T.ink : T.inkSoft }}>
                  {d.name}
                  <span style={{ font: `500 20px/1.2 ${T.font}`, color: T.inkSoft, marginLeft: 12 }}>
                    {d.speakers} speakers
                  </span>
                </span>
                <span style={{ font: `800 25px/1.2 ${T.font}`, color: d.wer > 35 ? D.red : D.amber }}>
                  {d.wer.toFixed(1)}%
                </span>
              </div>
              <div style={{ height: 20, borderRadius: 999, background: '#eef2f6', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 999, width: `${w * 100}%`,
                  background: d.wer > 35 ? D.red : T.orange,
                }} />
              </div>
            </div>
          );
        })}
        <div style={{ font: `600 21px/1.3 ${T.font}`, color: T.inkSoft, marginTop: 14, opacity: show(t, 3.1) }}>
          ~10.53 crore speakers between them · all four non-scheduled languages
        </div>
      </div>

      <Caveat o={show(t, 5.8)}>
        Models for all four <b>do exist</b> — Bhashini's own ASR list carries Bhojpuri and
        Chhattisgarhi. The claim here is the error rate, never the absence.
      </Caveat>
    </Stage>
  );
};

/* 3 ─ built for the transcript being wrong ───────────────────────────────── */
export const S5Design: React.FC<{ t: number }> = ({ t }) => {
  const heard = 'नाल मिसरी का काम';
  const arrow = ease(t, 3.6, 4.4, 0, 1);
  return (
    <Stage gap={26}>
      <Kicker o={show(t, 0.05)} color={D.green}>SO WE DID NOT WAIT FOR THE MODELS</Kicker>
      <Head o={show(t, 0.2)} size={56}>A wrong transcript still has to produce a right field.</Head>

      <div style={{ display: 'flex', alignItems: 'center', gap: 34, marginTop: 8 }}>
        <div style={{ ...card, width: 560, padding: '24px 28px', opacity: show(t, 1.1) }}>
          <div style={{ font: `800 18px/1 ${T.font}`, color: D.red, letterSpacing: 1.8 }}>
            WHAT THE SPEECH MODEL HEARD
          </div>
          <div style={{ font: `700 40px/1.3 ${T.font}`, color: T.ink, marginTop: 16 }}>
            “{heard}”
          </div>
          <div style={{
            font: `600 21px/1.35 ${T.font}`, color: T.inkSoft, marginTop: 14,
            opacity: show(t, 2.9),
          }}>
            two words out of four are wrong
          </div>
        </div>

        <div style={{
          font: `800 46px/1 ${T.font}`, color: T.line,
          opacity: arrow, transform: `translateX(${(1 - arrow) * -16}px)`,
        }}>→</div>

        <div style={{
          ...card, width: 620, padding: '24px 28px',
          background: '#f0fdf4', border: '1px solid #bbf7d0', opacity: show(t, 4.0),
        }}>
          <div style={{ font: `800 18px/1 ${T.font}`, color: D.green, letterSpacing: 1.8 }}>
            WHAT THE FIELD GOT
          </div>
          <div style={{ font: `800 40px/1.25 ${T.font}`, color: T.ink, marginTop: 16 }}>
            Plumber (General)
          </div>
          <div style={{ font: `600 23px/1.3 ${T.font}`, color: T.inkSoft, marginTop: 10 }}>
            NSQF Level 3 · matched to the qualification register
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16, marginTop: 6 }}>
        {[
          ['CLOSED ANSWER SET', 'the trade is chosen from the register, not transcribed free-form'],
          ['PHONETIC MATCH', 'the heard sound is matched, not the spelling'],
          ['READ-BACK & KEYPAD', 'the caller confirms it aloud, or presses a key instead'],
        ].map((g, i) => {
          const o = show(t, 5.2 + i * 0.3);
          return (
            <div key={g[0]} style={{
              ...card, width: 400, padding: '18px 22px', opacity: o,
              transform: `translateY(${(1 - o) * 16}px)`,
            }}>
              <div style={{ font: `800 17px/1 ${T.font}`, color: D.blue, letterSpacing: 1.6 }}>{g[0]}</div>
              <div style={{ font: `600 20px/1.35 ${T.font}`, color: T.inkSoft, marginTop: 10 }}>{g[1]}</div>
            </div>
          );
        })}
      </div>
    </Stage>
  );
};

/* 4 ─ the error rate published next to the accuracy ──────────────────────── */
export const S5ErrorRate: React.FC<{ t: number }> = ({ t }) => (
  <Stage gap={22}>
    <Kicker o={show(t, 0.05)}>WE PUBLISH BOTH COLUMNS</Kicker>
    <Head o={show(t, 0.2)} size={56}>Not just the accuracy. The error rate beside it.</Head>

    <div style={{ ...card, width: 1240, padding: '24px 34px 20px', marginTop: 6, opacity: show(t, 0.7) }}>
      <div style={{ display: 'flex', font: `800 18px/1 ${T.font}`, color: T.inkSoft, letterSpacing: 1.6, paddingBottom: 14 }}>
        <div style={{ flex: 1 }}>LINE CONDITION</div>
        <div style={{ width: 250, textAlign: 'right', color: D.red }}>WORD ERROR RATE</div>
        <div style={{ width: 290, textAlign: 'right', color: D.green }}>ANSWER UNDERSTOOD</div>
      </div>
      {LINE_RUNS.map((r, i) => {
        const o = show(t, 1.1 + i * 0.32);
        return (
          <div key={r.line} style={{
            display: 'flex', alignItems: 'baseline', padding: '13px 0',
            borderTop: `1px solid ${T.line}`, opacity: o,
          }}>
            <div style={{ flex: 1, font: `600 26px/1.2 ${T.font}`, color: T.ink }}>{r.line}</div>
            <div style={{ width: 250, textAlign: 'right', font: `800 30px/1.1 ${T.font}`, color: D.red }}>{r.wer}%</div>
            <div style={{ width: 290, textAlign: 'right', font: `800 30px/1.1 ${T.font}`, color: D.green }}>{r.ok}%</div>
          </div>
        );
      })}
    </div>

    <Caveat o={show(t, 2.8)}>
      Our figures, not a source's: 38 synthetic Hindi answers over a simulated phone line.
      They do not cover dialect audio, and we say so.
    </Caveat>
  </Stage>
);

/* 5 ─ the clause that asks for it ────────────────────────────────────────── */
export const S5Scheme: React.FC<{ t: number }> = ({ t }) => (
  <Stage gap={26}>
    <Kicker o={show(t, 0.05)}>THE SCHEME ALREADY ASKS FOR THIS</Kicker>
    <Head o={show(t, 0.2)} size={56}>Assess the interest before you choose the trade.</Head>
    <SourceShot
      id="clause" t={t} width={1420} appear={0.9}
      swipes={[{ name: 'interest', at: 2.3, per: 0.5 }]}
      chip={<Cite o={show(t, 1.4)}>PM-AJAY Guidelines, revised May 2023 · p.23, Ch.3 ¶7A(a)(v)(c)</Cite>}
      style={{ marginTop: 4 }}
    />
  </Stage>
);

/* 6 ─ and the instrument it had ──────────────────────────────────────────── */
export const S5Advert: React.FC<{ t: number }> = ({ t }) => (
  <Stage gap={26}>
    <Kicker o={show(t, 0.05)} color={D.red}>THE INSTRUMENT IT WAS GIVEN</Kicker>
    <Head o={show(t, 0.2)} size={56}>An advertisement, and manual processes.</Head>
    <SourceShot
      id="clause" t={t} width={1420} appear={0.35}
      swipes={[{ name: 'advert', at: 0.9 }]}
      chip={<Cite o={show(t, 0.9)}>the same clause · p.23</Cite>}
      style={{ marginTop: 4 }}
    />
    <div style={{
      font: `700 30px/1.35 ${T.font}`, color: T.inkSoft, textAlign: 'center',
      opacity: show(t, 3.0), maxWidth: 1300,
    }}>
      A notice on a wall cannot ask a question, and cannot hear the answer.
    </div>
  </Stage>
);

/* 7 ─ the requirement, turned into a process ─────────────────────────────── */
export const S5Process: React.FC<{ t: number }> = ({ t }) => {
  const steps = [
    { k: 'SHE SPEAKS', v: 'A missed call, a voice note, or the app — in her own words', tint: D.blue },
    { k: 'WE UNDERSTAND', v: 'The answer is matched to the register, then read back', tint: D.blue },
    { k: 'WE ANALYSE', v: 'NSQF eligibility, the gap, and the near-miss', tint: D.green },
    { k: 'WE GUIDE', v: 'One trade, one level, one duration — and the officer sees the demand', tint: D.green },
  ];
  return (
    <Stage gap={30}>
      <Kicker o={show(t, 0.05)} color={D.green}>THE REQUIREMENT, TURNED INTO A WORKING PROCESS</Kicker>
      <Head o={show(t, 0.2)} size={58}>This is the instrument.</Head>
      <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
        {steps.map((s, i) => {
          const o = show(t, 2.8 + i * 0.8);
          return (
            <React.Fragment key={s.k}>
              <div style={{
                ...card, width: 370, padding: '24px 24px 28px', opacity: o,
                transform: `translateY(${(1 - o) * 22}px)`, borderTop: `4px solid ${s.tint}`,
              }}>
                <div style={{ font: `800 20px/1 ${T.font}`, color: s.tint, letterSpacing: 2 }}>{s.k}</div>
                <div style={{ font: `600 23px/1.38 ${T.font}`, color: T.inkSoft, marginTop: 14 }}>{s.v}</div>
              </div>
              {i < steps.length - 1 ? (
                <div style={{
                  alignSelf: 'center', font: `800 34px/1 ${T.font}`, color: T.line,
                  opacity: show(t, 3.1 + i * 0.8),
                }}>→</div>
              ) : null}
            </React.Fragment>
          );
        })}
      </div>
    </Stage>
  );
};

/* 8 ─ the close ──────────────────────────────────────────────────────────── */
export const S5Close: React.FC<{ t: number }> = ({ t }) => {
  const rule = ease(t, 0.5, 1.4, 0, 1);
  return (
    <Stage gap={22}>
      <div style={{
        font: `600 34px/1.3 ${T.font}`, color: T.inkSoft, opacity: show(t, 0.1),
      }}>This is our approach.</div>
      <div style={{
        font: `900 96px/1 ${T.font}`, color: T.ink, letterSpacing: -3,
        opacity: show(t, 0.35), transform: `translateY(${(1 - show(t, 0.35)) * 18}px)`,
      }}>Team RubixCube</div>
      <div style={{ width: 360 * rule, height: 5, background: T.mint, borderRadius: 999 }} />
      <div style={{
        font: `700 27px/1 ${T.font}`, color: T.inkSoft, letterSpacing: 3.4, opacity: show(t, 1.1),
      }}>SIH 2026 · PS 26097 · MoSJE</div>
    </Stage>
  );
};
