import React from 'react';
import { Img, staticFile, interpolate, Easing } from 'remotion';
import { T } from '../theme';
import { Phone } from '../components/Phone';
import { CallScreen } from '../components/CallScreen';
import { shot } from '../screens';

const E = { easing: Easing.out(Easing.cubic), extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const show = (t: number, from: number, len = 0.45) => interpolate(t, [from, from + len], [0, 1], E);

const card: React.CSSProperties = {
  background: '#fff', borderRadius: 20, border: `1px solid ${T.line}`, boxShadow: T.shadowSm,
};

const Stage: React.FC<{ children: React.ReactNode; gap?: number }> = ({ children, gap = 32 }) => (
  <div style={{
    position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', gap, padding: '120px 90px 150px',
  }}>{children}</div>
);

const Kicker: React.FC<{ children: React.ReactNode; o: number }> = ({ children, o }) => (
  <div style={{ font: `800 22px/1 ${T.font}`, color: T.green, letterSpacing: 3, opacity: o }}>{children}</div>
);

const Title: React.FC<{ children: React.ReactNode; o: number; size?: number }> = ({ children, o, size = 64 }) => (
  <div style={{
    font: `900 ${size}px/1.12 ${T.font}`, color: T.ink, textAlign: 'center',
    letterSpacing: -1.2, opacity: o, transform: `translateY(${(1 - o) * 18}px)`,
  }}>{children}</div>
);

/** A desktop console in a window frame — these are 1440x900 captures, not phones. */
const Console: React.FC<{ file: string; w?: number; label: string; o: number }> = ({ file, w = 1080, label, o }) => (
  <div style={{ opacity: o, transform: `translateY(${(1 - o) * 30}px) scale(${0.97 + 0.03 * o})` }}>
    <div style={{ width: w, borderRadius: 16, overflow: 'hidden', boxShadow: T.shadow, border: `1px solid ${T.line}`, background: '#fff' }}>
      <div style={{ height: 38, background: '#e9edf1', display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px' }}>
        {['#ef6a5f', '#f5bf4f', '#61c454'].map((c) => (
          <div key={c} style={{ width: 12, height: 12, borderRadius: 999, background: c }} />
        ))}
        <div style={{ font: `600 15px/1 ${T.font}`, color: T.inkSoft, marginLeft: 12 }}>{label}</div>
      </div>
      <Img src={staticFile(file)} style={{ width: '100%', display: 'block' }} />
    </div>
  </div>
);

/* 1 ─ the half of the problem nobody films ──────────────────────────────── */
export const S4Problem: React.FC<{ t: number }> = ({ t }) => (
  <Stage>
    <Kicker o={show(t, 0.05)}>THE OTHER HALF OF THE PROBLEM STATEMENT</Kicker>
    <Title o={show(t, 0.2)}>Planning and placement, on the implementation side</Title>
    <div style={{ display: 'flex', gap: 28, marginTop: 14 }}>
      {[
        { k: 'PLANNING', v: 'Districts plan without knowing who wants what', tint: T.blue, soft: T.blueSoft },
        { k: 'PLACEMENT', v: 'Nobody checks whether the training led to work', tint: '#b45309', soft: '#fef3c7' },
      ].map((c, i) => {
        const o = show(t, 1.5 + i * 0.5);
        return (
          <div key={c.k} style={{
            ...card, width: 540, padding: '28px 30px', background: c.soft, border: `1px solid ${c.tint}33`,
            opacity: o, transform: `translateY(${(1 - o) * 28}px)`,
          }}>
            <div style={{ font: `800 20px/1 ${T.font}`, color: c.tint, letterSpacing: 1.6 }}>{c.k}</div>
            <div style={{ font: `700 30px/1.3 ${T.font}`, color: T.ink, marginTop: 14 }}>{c.v}</div>
          </div>
        );
      })}
    </div>
    <div style={{ font: `600 28px/1.4 ${T.font}`, color: T.inkSoft, marginTop: 10, opacity: show(t, 4.2) }}>
      The same conversations already answer both.
    </div>
  </Stage>
);

/* 2 ─ her answers become rows ────────────────────────────────────────────── */
export const S4Collect: React.FC<{ t: number }> = ({ t }) => {
  const slide = interpolate(t, [0.4, 1.6], [0, 1], E);
  return (
    <Stage gap={36}>
      <Kicker o={show(t, 0.05)}>WHAT SHE SAID, WHERE IT GOES</Kicker>
      <Title o={show(t, 0.2)}>Every answer is already a row</Title>
      <div style={{ display: 'flex', alignItems: 'center', gap: 40, marginTop: 6 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: 420 }}>
          {['“Nal-mistri ka kaam.”', '“Paanch saal se.”', '“Apne block mein.”'].map((q, i) => (
            <div key={q} style={{
              ...card, padding: '16px 20px', font: `600 24px/1.25 ${T.font}`, color: T.inkSoft,
              opacity: show(t, 0.3 + i * 0.28) * (1 - slide * 0.55),
              transform: `translateX(${slide * 70}px)`,
            }}>{q}</div>
          ))}
        </div>
        <div style={{ font: `800 44px/1 ${T.font}`, color: T.line, opacity: slide }}>→</div>
        <div style={{ ...card, width: 720, padding: '24px 26px', opacity: show(t, 1.5) }}>
          <div style={{ font: `800 19px/1 ${T.font}`, color: T.green, letterSpacing: 1.6, marginBottom: 14 }}>DISTRICT DATA</div>
          {[['Trade wanted', 'Plumbing'], ['Prior work', '5 years'], ['Block', 'Laharpur']].map((r, i) => (
            <div key={r[0]} style={{
              display: 'flex', justifyContent: 'space-between', padding: '12px 0',
              borderTop: i ? `1px solid ${T.line}` : undefined, opacity: show(t, 1.9 + i * 0.3),
            }}>
              <span style={{ font: `600 24px/1.2 ${T.font}`, color: T.inkSoft }}>{r[0]}</span>
              <span style={{ font: `700 24px/1.2 ${T.font}`, color: T.ink }}>{r[1]}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ font: `600 25px/1.4 ${T.font}`, color: T.inkSoft, opacity: show(t, 3.0) }}>
        No separate survey. No extra form. It is a by-product of the interview.
      </div>
    </Stage>
  );
};

/* 3 ─ many people become demand ──────────────────────────────────────────── */
export const S4Demand: React.FC<{ t: number }> = ({ t }) => {
  const gather = interpolate(t, [0.9, 2.4], [0, 1], E);
  const bars = interpolate(t, [2.3, 3.8], [0, 1], E);
  const people = Array.from({ length: 28 });
  const trades = [
    { name: 'Plumbing', v: 1.0 },
    { name: 'Tailoring', v: 0.72 },
    { name: 'Electrical', v: 0.55 },
    { name: 'Masonry', v: 0.38 },
  ];
  return (
    <Stage gap={34}>
      <Kicker o={show(t, 0.05)}>ONE PERSON IS A CASE. MANY ARE A PATTERN.</Kicker>
      <Title o={show(t, 0.2)}>Demand becomes visible</Title>
      <div style={{ display: 'flex', alignItems: 'center', gap: 60, marginTop: 8 }}>
        <div style={{ width: 470, display: 'flex', flexWrap: 'wrap', gap: 14, justifyContent: 'center' }}>
          {people.map((_, i) => {
            const o = show(t, 0.3 + (i % 8) * 0.05);
            return (
              <div key={i} style={{
                width: 62, height: 62, borderRadius: 999, background: i % 3 === 0 ? T.mint : '#dbeafe',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30,
                opacity: o * (1 - gather * 0.75),
                transform: `translate(${gather * (180 - (i % 6) * 14)}px, ${gather * ((i % 4) - 1.5) * 10}px) scale(${1 - gather * 0.35})`,
              }}>🧍</div>
            );
          })}
        </div>
        <div style={{ ...card, width: 700, padding: '26px 30px', opacity: show(t, 2.2) }}>
          <div style={{ font: `800 19px/1 ${T.font}`, color: T.blue, letterSpacing: 1.6, marginBottom: 18 }}>DEMAND BY TRADE · ONE DISTRICT</div>
          {trades.map((tr, i) => (
            <div key={tr.name} style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', font: `600 21px/1.2 ${T.font}`, color: T.inkSoft, marginBottom: 7 }}>
                <span>{tr.name}</span>
              </div>
              <div style={{ height: 22, borderRadius: 999, background: '#eef2f6', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 999, background: i === 0 ? T.green : '#93b4e8',
                  width: `${tr.v * 100 * bars}%`,
                }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </Stage>
  );
};

/* 4,5 ─ the two consoles, as they really look ────────────────────────────── */
export const S4District: React.FC<{ t: number }> = ({ t }) => (
  <Stage gap={22}>
    <Kicker o={show(t, 0.05)}>DISTRICT CONSOLE</Kicker>
    <Title o={show(t, 0.12)} size={52}>The district team plans projects from it</Title>
    <Console file={`screens/${'officer.png'}`} label="District console · Sitapur · DL-PACC" o={show(t, 0.2)} w={1180} />
  </Stage>
);

export const S4State: React.FC<{ t: number }> = ({ t }) => (
  <Stage gap={22}>
    <Kicker o={show(t, 0.05)}>STATE CONSOLE</Kicker>
    <Title o={show(t, 0.12)} size={52}>The state prepares the perspective plan</Title>
    <Console file={`screens/${'state.png'}`} label="State console · SL-PACC" o={show(t, 0.2)} w={1180} />
  </Stage>
);

/* 6 ─ the scheme's own calendar ──────────────────────────────────────────── */
export const S4Timeline: React.FC<{ t: number }> = ({ t }) => {
  const line = interpolate(t, [0.8, 2.6], [0, 1], E);
  const marks = [
    { who: 'District', when: 'first week', tint: T.blue, at: 0.12 },
    { who: 'State', when: 'by the 15th', tint: T.green, at: 0.5 },
    { who: 'Ministry', when: 'by the 21st', tint: '#b45309', at: 0.88 },
  ];
  return (
    <Stage gap={40}>
      <Kicker o={show(t, 0.05)}>IT RUNS ON THE SCHEME'S CALENDAR, NOT OURS</Kicker>
      <Title o={show(t, 0.2)}>The planning timeline, followed</Title>
      <div style={{ position: 'relative', width: 1380, height: 230, marginTop: 20 }}>
        <div style={{ position: 'absolute', left: 0, top: 96, height: 8, borderRadius: 999, background: '#dbe3ea', width: '100%' }} />
        <div style={{ position: 'absolute', left: 0, top: 96, height: 8, borderRadius: 999, background: T.green, width: `${line * 100}%` }} />
        {marks.map((m, i) => {
          const o = show(t, 2.8 + i * 1.4, 0.5);
          return (
            <div key={m.who} style={{ position: 'absolute', left: `${m.at * 100}%`, top: 0, transform: 'translateX(-50%)', opacity: o }}>
              <div style={{ ...card, padding: '16px 24px', textAlign: 'center', borderTop: `6px solid ${m.tint}` }}>
                <div style={{ font: `800 30px/1.1 ${T.font}`, color: T.ink }}>{m.who}</div>
                <div style={{ font: `600 22px/1.2 ${T.font}`, color: T.inkSoft, marginTop: 6 }}>{m.when}</div>
              </div>
              <div style={{ width: 22, height: 22, borderRadius: 999, background: m.tint, margin: '18px auto 0', border: '4px solid #fff', boxShadow: T.shadowSm }} />
            </div>
          );
        })}
      </div>
      <div style={{ font: `600 26px/1.4 ${T.font}`, color: T.inkSoft, opacity: show(t, 6.6) }}>
        Deadlines the officers already have. The system meets them.
      </div>
    </Stage>
  );
};

/* 7 ─ the question after the training ────────────────────────────────────── */
export const S4Outcome: React.FC<{ t: number }> = ({ t }) => {
  const loop = show(t, 5.2, 0.8);
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 56, padding: '120px 90px 150px' }}>
      <div style={{ opacity: show(t, 0.15), transform: `translateY(${(1 - show(t, 0.15)) * 30}px)` }}>
        <Phone w={250}>
          <CallScreen
            s={250 / 352}
            seconds={t > 1.4 ? 12 : 0}
            question={t > 1.5 ? 'Kya aapko kaam mil gaya?' : undefined}
            answer={t > 2.6 ? 'Haan, kaam mil gaya.' : undefined}
            energy={t > 2.6 ? 0.6 : 0.1}
          />
        </Phone>
      </div>
      <div style={{ width: 980 }}>
        <Kicker o={show(t, 0.05)}>AFTER THE TRAINING</Kicker>
        <div style={{ font: `900 56px/1.14 ${T.font}`, color: T.ink, letterSpacing: -1, marginTop: 12, opacity: show(t, 0.2) }}>
          One simple question: did you get the work?
        </div>
        <div style={{ ...card, padding: '26px 30px', marginTop: 30, opacity: show(t, 3.3) }}>
          <div style={{ font: `800 19px/1 ${T.font}`, color: T.green, letterSpacing: 1.6, marginBottom: 16 }}>OUTCOMES, ONE DISTRICT</div>
          <div style={{ display: 'flex', gap: 36 }}>
            {[['12', 'interviewed'], ['10', 'joined'], ['40%', 'working']].map(([n, l], i) => (
              <div key={l} style={{ opacity: show(t, 3.6 + i * 0.25) }}>
                <div style={{ font: `900 54px/1 ${T.font}`, color: T.ink }}>{n}</div>
                <div style={{ font: `600 21px/1.2 ${T.font}`, color: T.inkSoft, marginTop: 6 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 16, marginTop: 26, opacity: loop,
          transform: `translateX(${(1 - loop) * -24}px)`,
        }}>
          <div style={{ font: `800 34px/1 ${T.font}`, color: T.green }}>↺</div>
          <div style={{ font: `700 30px/1.3 ${T.font}`, color: T.ink }}>
            The answer goes back in, and the next recommendation is better for it.
          </div>
        </div>
      </div>
    </div>
  );
};

/* 8 ─ what exists today ─────────────────────────────────────────────────── */
/**
 * The first two rows are ticked because a screenshot in this very video proves
 * them. The third is deliberately NOT ticked: the district console on screen says
 * outcomes are "updated from the Outcomes tab at the kiosk centre, until the
 * follow-up call is built". Until someone confirms that shipped, this renders the
 * follow-up call as the next step and claims nothing either way.
 */
export const S4Built: React.FC<{ t: number }> = ({ t }) => {
  const rows = [
    { label: 'The beneficiary side', tint: T.green, done: true },
    { label: 'The state and district consoles', tint: T.blue, done: true },
    { label: 'The follow-up call', tint: '#b45309', done: false },
  ];
  return (
    <Stage gap={26}>
      <Kicker o={show(t, 0.05)}>WHAT EXISTS TODAY</Kicker>
      <Title o={show(t, 0.15)} size={58}>Running software, not slideware</Title>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginTop: 14 }}>
        {rows.map((r, i) => {
          const o = show(t, 0.3 + i * 1.4, 0.55);
          return (
            <div key={r.label} style={{
              ...card, width: 1080, padding: '26px 34px', display: 'flex', alignItems: 'center', gap: 24,
              opacity: o, transform: `translateY(${(1 - o) * 22}px)`, borderLeft: `8px solid ${r.tint}`,
            }}>
              <div style={{
                width: 52, height: 52, borderRadius: 999, flexShrink: 0,
                background: r.done ? r.tint : '#fff', border: r.done ? 'none' : `3px solid ${r.tint}`,
                color: r.done ? '#fff' : r.tint,
                display: 'flex', alignItems: 'center', justifyContent: 'center', font: `800 26px/1 ${T.font}`,
              }}>{r.done ? '✓' : '→'}</div>
              <div style={{ font: `800 38px/1.15 ${T.font}`, color: T.ink }}>{r.label}</div>
            </div>
          );
        })}
      </div>
    </Stage>
  );
};
