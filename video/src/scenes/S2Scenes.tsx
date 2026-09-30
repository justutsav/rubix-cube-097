import React from 'react';
import { interpolate, Easing } from 'remotion';
import { T } from '../theme';
import { Phone, Waveform, FeaturePhone } from '../components/Phone';
import { CallScreen } from '../components/CallScreen';
import { WhatsAppScreen } from '../components/WhatsAppScreen';
import { KioskScreen } from '../components/KioskScreen';
import { shot } from '../screens';

const E = { easing: Easing.out(Easing.cubic), extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
/** show(t, at) -> 0..1, the standard stagger used everywhere below */
const show = (t: number, from: number, len = 0.45) => interpolate(t, [from, from + len], [0, 1], E);

const Stage: React.FC<{ children: React.ReactNode; gap?: number }> = ({ children, gap = 34 }) => (
  <div style={{
    position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', gap, padding: '120px 90px 150px',
  }}>{children}</div>
);

const Kicker: React.FC<{ children: React.ReactNode; o: number }> = ({ children, o }) => (
  <div style={{ font: `800 22px/1 ${T.font}`, color: T.green, letterSpacing: 3, opacity: o }}>{children}</div>
);

const Title: React.FC<{ children: React.ReactNode; o: number; size?: number }> = ({ children, o, size = 68 }) => (
  <div style={{
    font: `900 ${size}px/1.1 ${T.font}`, color: T.ink, textAlign: 'center',
    letterSpacing: -1.2, opacity: o, transform: `translateY(${(1 - o) * 18}px)`,
  }}>{children}</div>
);

const card: React.CSSProperties = {
  background: '#fff', borderRadius: 20, border: `1px solid ${T.line}`, boxShadow: T.shadowSm,
};

const Bullet: React.FC<{ o: number; children: React.ReactNode; tint?: string }> = ({ o, children, tint = T.green }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 14, opacity: o,
    transform: `translateX(${(1 - o) * 26}px)`,
  }}>
    <div style={{ width: 12, height: 12, borderRadius: 999, background: tint, flexShrink: 0 }} />
    <div style={{ font: `600 30px/1.32 ${T.font}`, color: T.inkSoft }}>{children}</div>
  </div>
);

/* 1 ─ not a form, a conversation → three services ────────────────────────── */
export const S2Hook: React.FC<{ t: number }> = ({ t }) => {
  const kill = interpolate(t, [0.3, 1.25], [0, 1], E);
  const swap = interpolate(t, [1.1, 1.7], [0, 1], E);
  const list = interpolate(t, [1.9, 2.4], [0, 1], E);
  const svc = [
    { n: '1', name: 'IVR voice call', tint: T.blue, soft: T.blueSoft, icon: '📞' },
    { n: '2', name: 'WhatsApp voice note', tint: T.green, soft: '#dcfce7', icon: '💬' },
    { n: '3', name: 'Kiosk-based light app', tint: '#b45309', soft: '#fef3c7', icon: '🖥' },
  ];
  return (
    <Stage>
      <div style={{ position: 'relative', height: 200, width: 760, opacity: 1 - swap * 0.999 }}>
        <div style={{ ...card, position: 'absolute', inset: 0, padding: '26px 30px' }}>
          <div style={{ font: `700 20px/1 ${T.font}`, color: T.inkSoft, letterSpacing: 1.6, marginBottom: 18 }}>APPLICATION FORM</div>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ position: 'relative', marginBottom: 14 }}>
              <div style={{ height: 26, borderRadius: 7, background: '#f1f5f9', border: `1px solid ${T.line}` }} />
              <div style={{
                position: 'absolute', left: 0, top: 12, height: 3, borderRadius: 2, background: T.red,
                width: `${Math.max(0, Math.min(1, kill * 1.6 - i * 0.18)) * 100}%`,
              }} />
            </div>
          ))}
        </div>
      </div>

      <Title o={swap} size={74}>Not a form. A conversation.</Title>

      <div style={{ display: 'flex', gap: 26, marginTop: 10 }}>
        {svc.map((s, i) => {
          const o = show(t, 2.0 + i * 0.32);
          return (
            <div key={s.n} style={{
              ...card, width: 366, padding: '30px 28px', background: s.soft, border: `1px solid ${s.tint}33`,
              opacity: o * list, transform: `translateY(${(1 - o) * 34}px)`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{
                  width: 52, height: 52, borderRadius: 999, background: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 25,
                }}>{s.icon}</div>
                <div style={{ font: `900 34px/1 ${T.font}`, color: s.tint }}>{s.n}</div>
              </div>
              <div style={{ font: `800 32px/1.2 ${T.font}`, color: T.ink, marginTop: 16 }}>{s.name}</div>
            </div>
          );
        })}
      </div>
    </Stage>
  );
};

/* 2,3,4 ─ one service at a time ──────────────────────────────────────────── */
const Service: React.FC<{
  t: number; n: string; name: string; tint: string; bullets: string[]; children: React.ReactNode;
}> = ({ t, n, name, tint, bullets, children }) => (
  <div style={{
    position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
    justifyContent: 'center', gap: 80, padding: '130px 110px 160px',
  }}>
    <div style={{ opacity: show(t, 0.1), transform: `translateY(${(1 - show(t, 0.1)) * 40}px)` }}>
      {children}
    </div>
    <div style={{ width: 760 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 18, opacity: show(t, 0.25) }}>
        <div style={{
          width: 64, height: 64, borderRadius: 999, background: tint, color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center', font: `900 34px/1 ${T.font}`,
        }}>{n}</div>
        <div style={{ font: `900 56px/1.1 ${T.font}`, color: T.ink, letterSpacing: -1 }}>{name}</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginTop: 34 }}>
        {bullets.map((b, i) => <Bullet key={b} o={show(t, 0.6 + i * 0.3)} tint={tint}>{b}</Bullet>)}
      </div>
    </div>
  </div>
);

export const S2Svc1: React.FC<{ t: number }> = ({ t }) => (
  <Service
    t={t} n="1" name="IVR voice call" tint={T.blue}
    bullets={['An ordinary phone call — no app, no data', 'She misses a call; the system rings her back', 'Works on the feature phone she already owns']}
  >
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 26 }}>
      <Phone w={252}><CallScreen s={252 / 352} seconds={23} /></Phone>
      <FeaturePhone w={150} ringing={1} />
    </div>
  </Service>
);

export const S2Svc2: React.FC<{ t: number }> = ({ t }) => (
  <Service
    t={t} n="2" name="WhatsApp voice note" tint={T.green}
    bullets={['She holds the mic and speaks', 'One question per message, never a form read aloud', 'The session waits — she answers between chores']}
  >
    <Phone w={252}><WhatsAppScreen step={Math.max(0, (t - 0.4) * 1.6)} recording={t > 1.9 ? t - 1.9 : 0} /></Phone>
  </Service>
);

export const S2Svc3: React.FC<{ t: number }> = ({ t }) => (
  <Service
    t={t} n="3" name="Kiosk-based light app" tint="#b45309"
    bullets={['For someone with no phone of her own', 'The CSC operator runs the same interview', 'It keeps working when the link drops']}
  >
    <Phone w={252}><KioskScreen shot={shot('interview.png')} syncing={t > 1.6} /></Phone>
  </Service>
);

/* 5 ─ what she tells it ──────────────────────────────────────────────────── */
export const S2Tells: React.FC<{ t: number }> = ({ t }) => {
  const items = [
    { k: 'Her work', v: '“Nal-mistri ka kaam karti hoon.”', tint: T.blue },
    { k: 'Her interests', v: '“Apna kaam shuru karna hai.”', tint: T.green },
    { k: 'Her preferences', v: '“Ghar ke paas, apne block mein.”', tint: '#b45309' },
  ];
  return (
    <Stage gap={40}>
      <Kicker o={show(t, 0.1)}>SHE JUST TALKS</Kicker>
      <Title o={show(t, 0.25)}>She tells it about her life</Title>
      <div style={{ display: 'flex', alignItems: 'center', gap: 22, opacity: show(t, 0.5) }}>
        <div style={{
          width: 84, height: 84, borderRadius: 999, background: T.mint,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40,
        }}>🎤</div>
        <Waveform energy={0.4 + 0.6 * Math.abs(Math.sin(t * 3.2))} color={T.green} height={58} width={420} seed={9} />
      </div>
      <div style={{ display: 'flex', gap: 24, marginTop: 6 }}>
        {items.map((it, i) => {
          const o = show(t, 1.1 + i * 0.5);
          return (
            <div key={it.k} style={{
              ...card, width: 380, padding: '24px 26px', borderTop: `6px solid ${it.tint}`,
              opacity: o, transform: `translateY(${(1 - o) * 30}px)`,
            }}>
              <div style={{ font: `800 20px/1 ${T.font}`, color: it.tint, letterSpacing: 1.4 }}>{it.k.toUpperCase()}</div>
              <div style={{ font: `600 27px/1.32 ${T.font}`, color: T.ink, marginTop: 12 }}>{it.v}</div>
            </div>
          );
        })}
      </div>
    </Stage>
  );
};

/* 6 ─ the engine turns it into a profile ─────────────────────────────────── */
export const S2Ai: React.FC<{ t: number }> = ({ t }) => {
  const pull = interpolate(t, [0.3, 1.4], [0, 1], E);
  const spin = interpolate(t, [0.6, 3.2], [0, 340], E);
  const out = show(t, 2.4);
  const rows = [
    ['Schooling', 'not required for this trade'],
    ['Work experience', '5 years, recognised'],
    ['Preference', 'self-employment, own block'],
    ['Language', 'Hindi, spoken'],
  ];
  return (
    <Stage gap={30}>
      <Kicker o={show(t, 0.05)}>WHAT THE ENGINE DOES WITH IT</Kicker>
      <Title o={show(t, 0.2)}>Speech in. A profile out.</Title>
      <div style={{ display: 'flex', alignItems: 'center', gap: 56, marginTop: 8 }}>
        {/* words being drawn in */}
        <div style={{ width: 300, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {['work', 'interests', 'preferences'].map((w, i) => (
            <div key={w} style={{
              ...card, padding: '14px 20px', font: `700 26px/1 ${T.font}`, color: T.inkSoft,
              transform: `translateX(${pull * (170 + i * 12)}px) scale(${1 - pull * 0.28})`,
              opacity: 1 - pull * 0.85,
            }}>{w}</div>
          ))}
        </div>
        <div style={{
          width: 176, height: 176, borderRadius: 30, background: '#0f172a', color: '#fff',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 8, position: 'relative', flexShrink: 0,
        }}>
          <div style={{
            position: 'absolute', inset: -10, borderRadius: 36,
            border: `3px dashed ${T.green}`, opacity: 0.55, transform: `rotate(${spin}deg)`,
          }} />
          <div style={{ font: `900 40px/1 ${T.font}` }}>AI</div>
          <div style={{ font: `600 15px/1.2 ${T.font}`, opacity: 0.75, letterSpacing: 1.2 }}>ANALYZES</div>
        </div>
        <div style={{
          ...card, width: 560, padding: '26px 28px', opacity: out,
          transform: `translateX(${(1 - out) * -30}px)`,
        }}>
          <div style={{ font: `800 19px/1 ${T.font}`, color: T.green, letterSpacing: 1.6, marginBottom: 16 }}>HER PROFILE</div>
          {rows.map((r, i) => (
            <div key={r[0]} style={{
              display: 'flex', justifyContent: 'space-between', gap: 16, padding: '11px 0',
              borderTop: i ? `1px solid ${T.line}` : undefined, opacity: show(t, 2.7 + i * 0.22),
            }}>
              <span style={{ font: `600 23px/1.2 ${T.font}`, color: T.inkSoft }}>{r[0]}</span>
              <span style={{ font: `700 23px/1.2 ${T.font}`, color: T.ink, textAlign: 'right' }}>{r[1]}</span>
            </div>
          ))}
        </div>
      </div>
    </Stage>
  );
};

/* 7 ─ the two questions it then answers ──────────────────────────────────── */
export const S2Checks: React.FC<{ t: number }> = ({ t }) => (
  <Stage gap={34}>
    <Kicker o={show(t, 0.05)}>THEN THE SYSTEM CHECKS</Kicker>
    <Title o={show(t, 0.2)}>Not “what suits her”. What she can actually enter.</Title>
    <div style={{ display: 'flex', gap: 30, marginTop: 10 }}>
      <div style={{ ...card, width: 600, padding: '28px 30px', opacity: show(t, 0.8), transform: `translateY(${(1 - show(t, 0.8)) * 26}px)` }}>
        <div style={{ font: `800 21px/1 ${T.font}`, color: T.green, letterSpacing: 1.5 }}>WHAT SHE CAN ENROL IN</div>
        {[['Plumber (General)', 'Level 3 · 2 महीने'], ['Entry requirement', 'no school certificate needed'], ['Her 5 years', 'counted as prior learning']].map((r, i) => (
          <div key={r[0]} style={{ display: 'flex', justifyContent: 'space-between', gap: 14, marginTop: 18, opacity: show(t, 1.1 + i * 0.28) }}>
            <span style={{ font: `700 26px/1.25 ${T.font}`, color: T.ink }}>✓ {r[0]}</span>
            <span style={{ font: `600 22px/1.3 ${T.font}`, color: T.inkSoft, textAlign: 'right' }}>{r[1]}</span>
          </div>
        ))}
      </div>
      <div style={{ ...card, width: 600, padding: '28px 30px', background: T.orangeSoft, border: '1px solid #fcd34d', opacity: show(t, 1.5), transform: `translateY(${(1 - show(t, 1.5)) * 26}px)` }}>
        <div style={{ font: `800 21px/1 ${T.font}`, color: '#92400e', letterSpacing: 1.5 }}>WHAT SHE IS SHORT OF</div>
        <div style={{ font: `700 30px/1.3 ${T.font}`, color: T.ink, marginTop: 18, opacity: show(t, 1.8) }}>
          The gap is named, in her own language.
        </div>
        <div style={{ font: `600 25px/1.35 ${T.font}`, color: '#7c2d12', marginTop: 14, opacity: show(t, 2.1) }}>
          “पहले इसी काम का लेवल 3 कोर्स कर लीजिए — उससे ये रास्ता खुल जाता है”
        </div>
      </div>
    </div>
  </Stage>
);

/* 8 ─ the training, and why it matters ───────────────────────────────────── */
export const S2Training: React.FC<{ t: number }> = ({ t }) => {
  const grow = interpolate(t, [1.6, 3.4], [0, 1], E);
  const my = shot('myplan.png');
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 70, padding: '130px 110px 160px' }}>
      {my ? (
        <div style={{ opacity: show(t, 0.15), transform: `translateY(${(1 - show(t, 0.15)) * 34}px)` }}>
          <Phone w={248}><KioskScreen shot={my} /></Phone>
        </div>
      ) : null}
      <div style={{ width: 880 }}>
        <Kicker o={show(t, 0.05)}>AND WHICH TRAINING PROGRAM</Kicker>
        <div style={{ font: `900 58px/1.12 ${T.font}`, color: T.ink, letterSpacing: -1, marginTop: 12, opacity: show(t, 0.2) }}>
          A programme she can actually pursue
        </div>
        <div style={{ display: 'flex', gap: 16, marginTop: 30 }}>
          {[['Plumber (General)', T.green], ['Level 3', T.blue], ['2 महीने', '#b45309'], ['आपके ब्लॉक में', T.mintDeep]].map(([label, tint], i) => (
            <div key={label} style={{
              ...card, padding: '14px 22px', borderLeft: `6px solid ${tint}`,
              font: `700 26px/1 ${T.font}`, color: T.ink,
              opacity: show(t, 0.6 + i * 0.22), transform: `translateY(${(1 - show(t, 0.6 + i * 0.22)) * 18}px)`,
            }}>{label}</div>
          ))}
        </div>
        <div style={{ marginTop: 44, opacity: show(t, 1.5) }}>
          <div style={{ font: `700 26px/1 ${T.font}`, color: T.inkSoft, marginBottom: 16 }}>so that livelihoods can improve</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 18, height: 130 }}>
            {[0.3, 0.45, 0.62, 0.84, 1].map((h, i) => (
              <div key={i} style={{
                width: 84, borderRadius: '10px 10px 0 0',
                height: `${h * 130 * grow}px`,
                background: i === 4 ? T.green : '#cbd5e1',
              }} />
            ))}
            <div style={{ font: `800 34px/1 ${T.font}`, color: T.green, marginLeft: 12, opacity: grow }}>↑</div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* 9 ─ the roadmap ────────────────────────────────────────────────────────── */
export const S2Roadmap: React.FC<{ t: number }> = ({ t }) => {
  const steps = [
    { n: '01', label: 'She speaks', sub: 'seven questions, one at a time' },
    { n: '02', label: 'Eligibility checked', sub: 'against the official register' },
    { n: '03', label: 'Training named', sub: 'trade, level, length, block' },
    { n: '04', label: 'Livelihood', sub: 'the gap named, not guessed' },
  ];
  return (
    <Stage gap={36}>
      <Kicker o={show(t, 0.05)}>FINALLY</Kicker>
      <Title o={show(t, 0.15)}>A clear roadmap to follow</Title>
      <div style={{ display: 'flex', alignItems: 'stretch', gap: 0, marginTop: 14 }}>
        {steps.map((s, i) => {
          const o = show(t, 0.55 + i * 0.3, 0.4);
          return (
            <React.Fragment key={s.n}>
              <div style={{
                ...card, width: 330, padding: '24px 24px', opacity: o,
                transform: `translateY(${(1 - o) * 26}px)`, borderTop: `6px solid ${T.green}`,
              }}>
                <div style={{ font: `900 26px/1 ${T.font}`, color: T.mint }}>{s.n}</div>
                <div style={{ font: `800 30px/1.15 ${T.font}`, color: T.ink, marginTop: 10 }}>{s.label}</div>
                <div style={{ font: `500 20px/1.3 ${T.font}`, color: T.inkSoft, marginTop: 8 }}>{s.sub}</div>
              </div>
              {i < steps.length - 1 ? (
                <div style={{
                  width: 46, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  font: `800 30px/1 ${T.font}`, color: T.line, opacity: show(t, 0.75 + i * 0.3),
                }}>→</div>
              ) : null}
            </React.Fragment>
          );
        })}
      </div>
    </Stage>
  );
};

/* 10 ─ the three-beat close ──────────────────────────────────────────────── */
export const S2Close: React.FC<{ t: number }> = ({ t }) => {
  const lines = [
    { a: 'They speak.', tint: T.blue },
    { a: 'The system understands.', tint: T.green },
    { a: 'And it guides them.', tint: '#b45309' },
  ];
  return (
    <Stage gap={30}>
      {lines.map((l, i) => {
        const o = show(t, 0.35 + i * 1.05, 0.5);
        return (
          <div key={l.a} style={{
            font: `900 82px/1.1 ${T.font}`, color: T.ink, letterSpacing: -1.8,
            opacity: o, transform: `translateY(${(1 - o) * 26}px)`,
          }}>
            {l.a}
            <div style={{ height: 7, width: `${o * 100}%`, background: l.tint, borderRadius: 999, marginTop: 12 }} />
          </div>
        );
      })}
    </Stage>
  );
};

/* 11 ─ handoff into the three doorways ───────────────────────────────────── */
export const S2Handoff: React.FC<{ t: number }> = ({ t }) => {
  const doors = [
    { icon: '📞', label: 'IVR call' },
    { icon: '💬', label: 'WhatsApp' },
    { icon: '🖥', label: 'Kiosk app' },
  ];
  return (
    <Stage gap={44}>
      <Title o={show(t, 0.1)} size={62}>Now — how it works across the three doorways</Title>
      <div style={{ display: 'flex', gap: 44 }}>
        {doors.map((d, i) => {
          const o = show(t, 0.5 + i * 0.28);
          return (
            <div key={d.label} style={{
              ...card, width: 300, padding: '34px 0', textAlign: 'center',
              opacity: o, transform: `translateY(${(1 - o) * 30}px)`, border: `2px solid ${T.mintDeep}`,
            }}>
              <div style={{ fontSize: 46 }}>{d.icon}</div>
              <div style={{ font: `800 30px/1 ${T.font}`, color: T.ink, marginTop: 14 }}>{d.label}</div>
            </div>
          );
        })}
      </div>
    </Stage>
  );
};
