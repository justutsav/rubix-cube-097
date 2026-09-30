import React from 'react';
import { Img, staticFile, interpolate, Easing } from 'remotion';
import { T } from '../theme';
import { SourceShot, Cite } from '../components/SourceShot';
import { TOP_ROLES } from '../s1Timeline';

/**
 * Section 1 runs on the same paper as the rest of the film — the sections are cut
 * together, so a palette of its own would read as a different video. `amber` is the
 * section accent where it has to survive as type; `fill` is the same accent where it
 * is a bar, a ring or a rule and can be lighter.
 */
export const D = {
  bg: T.bg,
  panel: '#ffffff',
  hair: T.line,
  text: T.ink,
  muted: T.inkSoft,
  amber: '#b45309',
  fill: T.orange,
  yellow: '#ffd600',
  red: '#dc2626',
  green: T.mintDeep,
  blue: T.blue,
} as const;

const E = { easing: Easing.out(Easing.cubic), extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const show = (t: number, from: number, len = 0.42) => interpolate(t, [from, from + len], [0, 1], E);
const ease = (t: number, a: number, b: number, from: number, to: number) =>
  interpolate(t, [a, b], [from, to], E);

const IN = new Intl.NumberFormat('en-IN');

const Stage: React.FC<{ children: React.ReactNode; pad?: string; gap?: number; row?: boolean }> = ({
  children, pad = '128px 88px 150px', gap = 26, row = false,
}) => (
  <div style={{
    position: 'absolute', inset: 0, display: 'flex',
    flexDirection: row ? 'row' : 'column', alignItems: 'center', justifyContent: 'center',
    gap, padding: pad,
  }}>{children}</div>
);

const Kicker: React.FC<{ children: React.ReactNode; o: number; color?: string }> = ({ children, o, color = D.amber }) => (
  <div style={{ font: `800 21px/1 ${T.font}`, color, letterSpacing: 3.4, opacity: o }}>{children}</div>
);

const Head: React.FC<{ children: React.ReactNode; o: number; size?: number; color?: string }> = ({
  children, o, size = 62, color = D.text,
}) => (
  <div style={{
    font: `900 ${size}px/1.1 ${T.font}`, color, textAlign: 'center',
    letterSpacing: -1.4, opacity: o, transform: `translateY(${(1 - o) * 16}px)`,
  }}>{children}</div>
);

/* 1 ─ cold open ──────────────────────────────────────────────────────────── */
export const S1Open: React.FC<{ t: number }> = ({ t }) => {
  const rule = ease(t, 0.35, 1.1, 0, 1);
  const wipe = ease(t, 0.15, 0.95, 0, 100);
  return (
    <Stage gap={22}>
      <Kicker o={show(t, 0.05)}>SIH 26097 · MINISTRY OF SOCIAL JUSTICE &amp; EMPOWERMENT</Kicker>
      <div style={{
        font: `900 128px/1 ${T.font}`, color: D.text, letterSpacing: -4,
        clipPath: `inset(0 ${100 - wipe}% 0 0)`,
      }}>THE PROBLEM</div>
      <div style={{ width: 720 * rule, height: 3, background: D.fill, borderRadius: 2 }} />
      <div style={{ font: `600 27px/1.4 ${T.font}`, color: D.muted, opacity: show(t, 0.85) }}>
        Not our finding. Theirs.
      </div>
    </Stage>
  );
};

/* 2 ─ the clause, and what the scheme uses to reach the people it describes ── */
export const S1Clause: React.FC<{ t: number }> = ({ t }) => {
  // the whole board slides left when the counter-card arrives
  const shift = ease(t, 6.3, 7.1, 0, 1);
  const logoO = show(t, 0.05);
  const spin = ease(t, 0.05, 0.95, -22, 0);

  return (
    <div style={{ position: 'absolute', inset: 0, padding: '112px 76px 150px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 26, opacity: logoO }}>
        <Img src={staticFile('s1/pmajay.png')} style={{
          width: 116, height: 112, transform: `rotate(${spin}deg) scale(${0.86 + 0.14 * logoO})`,
        }} />
        <div>
          <div style={{ font: `900 40px/1.1 ${T.font}`, color: D.text, letterSpacing: -0.8 }}>
            PM-AJAY <span style={{ color: D.muted, fontWeight: 700, fontSize: 27 }}>· Grant-in-Aid, skilling</span>
          </div>
          <div style={{
            marginTop: 12, background: '#fff', borderRadius: 8, padding: '8px 12px',
            display: 'inline-block', opacity: show(t, 0.55),
          }}>
            <Img src={staticFile('s1/mosje.png')} style={{ height: 74, display: 'block' }} />
          </div>
        </div>
      </div>

      <div style={{
        position: 'absolute', left: 76, right: 76, top: 322,
        display: 'flex', gap: 38, alignItems: 'flex-start',
      }}>
        <SourceShot
          id="clause"
          t={t}
          width={1290 - shift * 430}
          appear={0.55}
          swipes={[
            { name: 'interest', at: 3.55, per: 0.5, dur: 0.52 },
            { name: 'advert', at: 6.6, dur: 0.5 },
          ]}
          chip={<Cite>PM-AJAY Guidelines (revised May 2023) · Ch. 3 ¶7A(a)(v)(c) · p.23</Cite>}
        />

        {/* the population that clause is aimed at, in the problem statement's own words */}
        <div style={{
          width: 600, flex: 'none', opacity: shift, transform: `translateX(${(1 - shift) * 120}px)`,
          background: '#fff1f2', border: `1px solid #fda4af`,
          borderRadius: 16, padding: '26px 28px',
        }}>
          <div style={{ font: `800 19px/1 ${T.font}`, color: D.red, letterSpacing: 2.6 }}>
            THE PEOPLE IT IS AIMED AT
          </div>
          <div style={{ font: `700 30px/1.36 ${T.font}`, color: D.text, marginTop: 18 }}>
            “low digital literacy, limited awareness of modern trades, language constraints,
            and difficulty navigating text-heavy digital systems.”
          </div>
          <div style={{ marginTop: 20 }}>
            <Cite>SIH 26097 · Problem statement, MoSJE</Cite>
          </div>
        </div>
      </div>
    </div>
  );
};

/* 3 ─ who found the rest of this ─────────────────────────────────────────── */
export const S1Audit: React.FC<{ t: number }> = ({ t }) => {
  const o = show(t, 0.05, 0.4);
  const ring = ease(t, 0.1, 0.9, 0, 1);
  return (
    <div style={{
      position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
      justifyContent: 'center', gap: 70, padding: '150px 100px 160px',
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, width: 560 }}>
        <div style={{ position: 'relative', width: 200, height: 200 }}>
          <div style={{
            position: 'absolute', inset: 0, borderRadius: 999,
            border: `2px solid ${D.fill}`, opacity: (1 - ring) * 0.85,
            transform: `scale(${0.7 + ring * 0.9})`,
          }} />
          <Img src={staticFile('s1/cagseal.png')} style={{
            width: 200, height: 200, objectFit: 'contain',
            opacity: o, transform: `scale(${0.72 + 0.28 * o})`,
          }} />
        </div>
        <Head o={show(t, 0.3)} size={40}>Comptroller and Auditor General of India</Head>
        <div style={{ font: `700 24px/1.3 ${T.font}`, color: D.amber, opacity: show(t, 0.5), textAlign: 'center' }}>
          Report No. 20 of 2025 · tabled 18 December 2025
        </div>
      </div>

      {/* the report as it stands on cag.gov.in — not a retyped citation */}
      <div style={{ opacity: show(t, 0.42), transform: `translateX(${(1 - show(t, 0.42)) * 40}px)` }}>
        <div style={{
          width: 1000, background: '#fff', borderRadius: 14, padding: 16,
          boxShadow: T.shadow, border: `1px solid ${T.line}`,
        }}>
          <Img src={staticFile('s1/cagsite.png')} style={{ width: '100%', display: 'block', borderRadius: 6 }} />
        </div>
        <div style={{ marginTop: 10 }}><Cite>cag.gov.in · Audit Reports · Performance Audit (Civil)</Cite></div>
      </div>
    </div>
  );
};

/* 4 ─ 56.14 lakh certified ───────────────────────────────────────────────── */
export const S1Certified: React.FC<{ t: number }> = ({ t }) => {
  const n = ease(t, 0.12, 1.5, 0, 56.14);
  return (
    <div style={{ position: 'absolute', inset: 0, padding: '124px 88px 150px', display: 'flex', gap: 60, alignItems: 'center' }}>
      <div style={{ width: 760 }}>
        <Kicker o={show(t, 0.05)}>WHAT THE AUDIT COUNTED</Kicker>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginTop: 18 }}>
          <div style={{ font: `900 156px/1 ${T.font}`, color: D.text, letterSpacing: -6 }}>
            {n.toFixed(2)}
          </div>
          <div style={{ font: `900 56px/1 ${T.font}`, color: D.amber, letterSpacing: 1, marginLeft: 10 }}>LAKH</div>
        </div>
        <div style={{ font: `700 34px/1.32 ${T.font}`, color: D.muted, marginTop: 14, opacity: show(t, 0.9) }}>
          certified under the short-term training and special-project components,
          across <span style={{ color: D.text }}>724 job-roles</span>.
        </div>
      </div>
      <SourceShot
        id="placement"
        t={t}
        width={900}
        appear={1.45}
        swipes={[{ name: 'certified', at: 1.95, dur: 0.5 }]}
        chip={<Cite>CAG Report No. 20 of 2025 · ¶3.6</Cite>}
      />
    </div>
  );
};

/* 5 ─ 41% placed against a mandated 70% ──────────────────────────────────── */
export const S1Placed: React.FC<{ t: number }> = ({ t }) => {
  const W = 1330;
  const got = ease(t, 0.35, 2.4, 0, 41.29);
  const target = show(t, 1.5);
  const pct = (v: number) => (v / 100) * W;

  return (
    <div style={{ position: 'absolute', inset: 0, padding: '116px 88px 150px' }}>
      <Kicker o={show(t, 0.05)}>WHAT THE AUDIT FOUND AT THE OTHER END</Kicker>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 22, marginTop: 16 }}>
        <div style={{ font: `900 120px/1 ${T.font}`, color: D.red, letterSpacing: -5 }}>
          {got.toFixed(2)}%
        </div>
        <div style={{ font: `700 32px/1.2 ${T.font}`, color: D.muted }}>
          placed · 23.18 lakh of 56.14 lakh
        </div>
      </div>

      {/* the bar, the mandate marker, and the distance between them */}
      <div style={{ position: 'relative', width: W, height: 74, marginTop: 30 }}>
        <div style={{ position: 'absolute', inset: 0, background: '#dbe2e8', borderRadius: 10 }} />
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0, width: pct(got),
          background: `linear-gradient(90deg, #ef4444, #f87171)`, borderRadius: 10,
        }} />
        {/* the shortfall */}
        <div style={{
          position: 'absolute', left: pct(got), top: 0, bottom: 0, width: pct(70 - got) * target,
          background: 'repeating-linear-gradient(135deg, rgba(244,166,56,0.55) 0 10px, rgba(244,166,56,0.18) 10px 20px)',
          borderTop: `1px dashed ${D.amber}`, borderBottom: `1px dashed ${D.amber}`,
        }} />
        <div style={{
          position: 'absolute', left: pct(70) - 2, top: -22, bottom: -16, width: 4,
          background: D.amber, opacity: target, borderRadius: 2,
        }} />
        <div style={{
          position: 'absolute', left: pct(70) - 2, bottom: 92, opacity: target,
          font: `800 26px/1.25 ${T.font}`, color: D.amber, whiteSpace: 'nowrap',
        }}>
          70% MANDATED
          <div style={{ font: `600 19px/1.3 ${T.font}`, color: D.muted, marginTop: 4 }}>
            short-term training, PM-AJAY
          </div>
        </div>
        <div style={{
          position: 'absolute', left: pct(got) + 10, top: 84, opacity: show(t, 2.5),
          font: `800 27px/1 ${T.font}`, color: D.amber,
        }}>
          28.7 points short
        </div>
      </div>

      {/* the mandate is not our number either */}
      <div style={{ position: 'absolute', right: 88, bottom: 168 }}>
        <SourceShot
          id="mandate"
          t={t}
          width={880}
          appear={3.25}
          swipes={[{ name: 'seventy', at: 3.85, dur: 0.5 }]}
          chip={<Cite>PM-AJAY Guidelines (revised May 2023) · ¶(vi)(b)(ii) · p.24</Cite>}
        />
      </div>
    </div>
  );
};

/* 6 ─ 40% of everything, in ten job-roles ────────────────────────────────── */
const DotField: React.FC<{ t: number }> = ({ t }) => {
  const dots = Array.from({ length: 724 }, (_, i) => i);
  const pick = ease(t, 1.15, 1.75, 0, 1);
  // the ten concentrated roles, scattered through the field rather than lined up
  const hot = new Set([37, 91, 148, 226, 290, 351, 433, 508, 604, 688]);
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9, width: 1340 }}>
      {dots.map((i) => {
        const on = show(t, 0.1 + (i / 724) * 0.55, 0.3);
        const isHot = hot.has(i);
        const dim = isHot ? 1 : 1 - pick * 0.86;
        const s = isHot ? 1 + pick * 0.85 : 1;
        return (
          <div key={i} style={{
            width: 15, height: 15, borderRadius: 999,
            background: isHot ? D.fill : '#a9b6c4',
            opacity: on * dim, transform: `scale(${s})`,
          }} />
        );
      })}
    </div>
  );
};

export const S1Ten: React.FC<{ t: number }> = ({ t }) => {
  const toBars = ease(t, 1.95, 2.55, 0, 1);
  return (
    <div style={{ position: 'absolute', inset: 0, padding: '116px 88px 150px' }}>
      <Kicker o={show(t, 0.05)}>724 JOB-ROLES WERE ON OFFER</Kicker>
      <div style={{ font: `900 58px/1.1 ${T.font}`, color: D.text, letterSpacing: -1.6, marginTop: 14, opacity: show(t, 0.15) }}>
        40% of every certification sat in <span style={{ color: D.amber }}>ten</span> of them
      </div>

      <div style={{ position: 'absolute', left: 88, top: 348, opacity: 1 - toBars, transform: `scale(${1 - toBars * 0.06})` }}>
        <DotField t={t} />
      </div>

      <div style={{
        position: 'absolute', left: 88, top: 330, width: 1030,
        opacity: toBars, transform: `translateY(${(1 - toBars) * 22}px)`,
      }}>
        {TOP_ROLES.map((r, i) => {
          const g = ease(t, 2.3 + i * 0.055, 2.85 + i * 0.055, 0, 1);
          return (
            <div key={r.role} style={{ display: 'flex', alignItems: 'center', gap: 14, height: 46 }}>
              <div style={{
                width: 430, font: `700 21px/1.15 ${T.font}`, color: D.text,
                textAlign: 'right', whiteSpace: 'nowrap', overflow: 'hidden',
              }}>
                {r.role}
                <span style={{ color: D.muted, fontWeight: 600 }}> · {r.sector}</span>
              </div>
              <div style={{ position: 'relative', width: 420, height: 28 }}>
                <div style={{
                  position: 'absolute', left: 0, top: 0, bottom: 0,
                  width: (r.pct / 8.06) * 420 * g, borderRadius: 5,
                  background: `linear-gradient(90deg, ${D.fill}, #e08a16)`,
                }} />
              </div>
              <div style={{ width: 140, font: `800 22px/1 ${T.font}`, color: D.amber }}>
                {IN.format(r.n)}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ position: 'absolute', right: 72, top: 392 }}>
        <SourceShot
          id="concentration"
          t={t}
          width={736}
          appear={2.9}
          swipes={[{ name: 'tenroles', at: 3.35, per: 0.34, dur: 0.44 }]}
          chip={<Cite>CAG Report No. 20 of 2025 · ¶2.1.2</Cite>}
        />
      </div>
    </div>
  );
};

/* 7 ─ the one that should quiet the room ─────────────────────────────────── */
export const S1Green: React.FC<{ t: number }> = ({ t }) => {
  const pct = ease(t, 0.9, 2.6, 0, 90.35);
  const R = 132, C = 2 * Math.PI * R;
  const toDoc = ease(t, 4.05, 4.6, 0, 1);

  return (
    <div style={{ position: 'absolute', inset: 0, padding: '116px 88px 150px' }}>
      <Kicker o={show(t, 0.05)}>SECTOR: GREEN JOBS · 10 JOB-ROLES · 4,27,113 CERTIFIED</Kicker>

      <div style={{
        position: 'absolute', left: 130, top: 300, display: 'flex', alignItems: 'center', gap: 64,
        opacity: 1 - toDoc, transform: `translateX(${-toDoc * 70}px)`,
      }}>
        <svg width={320} height={320} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={160} cy={160} r={R} fill="none" stroke="#dbe2e8" strokeWidth={30} />
          <circle
            cx={160} cy={160} r={R} fill="none" stroke={D.fill} strokeWidth={30} strokeLinecap="butt"
            strokeDasharray={`${(pct / 100) * C} ${C}`}
          />
        </svg>
        <div>
          <div style={{ font: `900 128px/1 ${T.font}`, color: D.text, letterSpacing: -5 }}>
            {pct.toFixed(2)}<span style={{ fontSize: 64, color: D.amber }}>%</span>
          </div>
          <div style={{ font: `700 31px/1.32 ${T.font}`, color: D.muted, marginTop: 10, width: 620 }}>
            of every “Green Jobs” certification went to
            <span style={{ color: D.text }}> one single job-role</span>.
          </div>
        </div>
      </div>

      {/* delivered flat: the name, the count, nothing else */}
      <div style={{
        position: 'absolute', left: 130, bottom: 196, opacity: show(t, 3.55, 0.5),
        transform: `translateY(${(1 - show(t, 3.55, 0.5)) * 14}px)`,
      }}>
        <div style={{ width: 620, height: 2, background: D.hair, marginBottom: 22 }} />
        <div style={{ font: `900 78px/1 ${T.font}`, color: D.text, letterSpacing: -2.2 }}>
          Safai Karmchari
        </div>
        <div style={{ font: `700 28px/1 ${T.font}`, color: D.muted, marginTop: 14 }}>
          3,85,880 of 4,27,113 certifications
        </div>
      </div>

      <div style={{ position: 'absolute', right: 88, top: 268 }}>
        <SourceShot
          id="tableb"
          t={t}
          width={900}
          appear={4.15}
          swipes={[
            { name: 'green', at: 4.55, dur: 0.34 },
            { name: 'safai', at: 4.8, dur: 0.38 },
            { name: 'share', at: 5.05, dur: 0.3 },
          ]}
          chip={<Cite>CAG Report No. 20 of 2025 · Table 2.1(b)</Cite>}
        />
      </div>
    </div>
  );
};

/* 8 ─ the turn ───────────────────────────────────────────────────────────── */
export const S1Turn: React.FC<{ t: number }> = ({ t }) => (
  <Stage gap={30}>
    <Kicker o={show(t, 0.05)}>SO THE CHALLENGE IS NOT THE ONE IT LOOKS LIKE</Kicker>
    <div style={{ display: 'flex', gap: 28, marginTop: 8 }}>
      {[
        { k: 'SOLVED', v: 'Getting people into training', n: '56.14 lakh certified', tone: D.green, o: show(t, 0.3) },
        { k: 'NOT SOLVED', v: 'Getting the right person to the right trade', n: '41% placed · 10 job-roles · one role per sector', tone: D.red, o: show(t, 1.35) },
      ].map((c) => (
        <div key={c.k} style={{
          width: 690, padding: '32px 34px', borderRadius: 18,
          background: c.tone === D.green ? '#f0fdf4' : '#fff1f2',
          border: `1px solid ${c.tone === D.green ? '#86efac' : '#fda4af'}`, opacity: c.o,
          transform: `translateY(${(1 - c.o) * 26}px)`,
        }}>
          <div style={{ font: `800 19px/1 ${T.font}`, color: c.tone, letterSpacing: 2.6 }}>{c.k}</div>
          <div style={{ font: `800 40px/1.22 ${T.font}`, color: D.text, marginTop: 16 }}>{c.v}</div>
          <div style={{ font: `600 25px/1.3 ${T.font}`, color: D.muted, marginTop: 14 }}>{c.n}</div>
        </div>
      ))}
    </div>
  </Stage>
);

/* 9 ─ what the section is actually asking for ────────────────────────────── */
export const S1Match: React.FC<{ t: number }> = ({ t }) => {
  const join = ease(t, 0.2, 1.3, 0, 1);
  const pulse = show(t, 1.25, 0.5);
  return (
    <Stage gap={34}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 34 }}>
        <div style={{
          font: `900 64px/1.06 ${T.font}`, color: D.text, letterSpacing: -1.8, textAlign: 'right',
          opacity: join, transform: `translateX(${(1 - join) * -160}px)`,
        }}>
          the right<br />pathway
        </div>
        <div style={{
          width: 34, height: 34, borderRadius: 999, background: D.fill,
          opacity: pulse, transform: `scale(${0.4 + pulse * 0.6 + Math.sin(t * 7) * 0.05})`,
          boxShadow: `0 0 ${28 * pulse}px rgba(244,166,56,0.8)`,
        }} />
        <div style={{
          font: `900 64px/1.06 ${T.font}`, color: D.text, letterSpacing: -1.8,
          opacity: join, transform: `translateX(${(1 - join) * 160}px)`,
        }}>
          for the right<br />person
        </div>
      </div>
      <div style={{ font: `600 30px/1.4 ${T.font}`, color: D.muted, opacity: show(t, 1.8), textAlign: 'center' }}>
        The clause on page 23 already asks for this. It has never had an instrument.
      </div>
    </Stage>
  );
};

/* 10 ─ the four tiles, the team, and the hand-off ────────────────────────── */
export const S1Team: React.FC<{ t: number }> = ({ t }) => {
  const tiles = [
    'Low digital literacy',
    'Limited awareness',
    'Language barrier',
    'Livelihood pathway gap',
  ];
  const swipe = ease(t, 1.7, 2.3, 0, 1);
  const arrow = ease(t, 3.3, 4.1, 0, 1);
  return (
    <Stage gap={34}>
      <Kicker o={show(t, 0.05)}>THE PROBLEM BOX, AND THE ONE WE JUST PROVED</Kicker>
      <div style={{ display: 'flex', gap: 18 }}>
        {tiles.map((k, i) => {
          const o = show(t, 0.25 + i * 0.12);
          const last = i === tiles.length - 1;
          return (
            <div key={k} style={{
              width: 412, padding: '24px 22px 28px', borderRadius: 14,
              background: D.panel, border: `1px solid ${last ? D.fill : D.hair}`,
              boxShadow: T.shadowSm, opacity: o, transform: `translateY(${(1 - o) * 20}px)`,
            }}>
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <div style={{
                  font: `800 27px/1.24 ${T.font}`, color: D.text, position: 'relative',
                  zIndex: 1, whiteSpace: 'nowrap',
                }}>{k}</div>
                {last ? (
                  <div style={{
                    position: 'absolute', left: -4, right: 0, bottom: -2, height: 18,
                    width: `${swipe * 104}%`, background: D.yellow, opacity: 0.85,
                    borderRadius: 3, transform: 'rotate(-0.4deg)',
                  }} />
                ) : null}
              </div>
              {last ? (
                <div style={{ font: `700 20px/1.3 ${T.font}`, color: D.amber, marginTop: 14, opacity: show(t, 2.2) }}>
                  proved, out of the audit
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 26, marginTop: 18, opacity: show(t, 2.6) }}>
        <div style={{ font: `900 62px/1 ${T.font}`, color: D.text, letterSpacing: -1.8 }}>
          Team RubixCube
        </div>
        <div style={{ width: 2, height: 54, background: D.hair }} />
        <div style={{ font: `700 30px/1.3 ${T.font}`, color: D.muted }}>
          here is how we built to address the gaps
        </div>
        <div style={{ width: 150 * arrow, height: 3, background: D.fill, borderRadius: 2 }} />
      </div>
    </Stage>
  );
};
