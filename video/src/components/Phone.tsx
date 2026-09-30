import React from 'react';
import { T } from '../theme';

export const Phone: React.FC<{
  children: React.ReactNode;
  w?: number;
  label?: string;
  style?: React.CSSProperties;
}> = ({ children, w = 352, label, style }) => {
  const h = Math.round(w * 2.06);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, ...style }}>
      <div
        style={{
          width: w, height: h, borderRadius: 40, background: '#0b1020', padding: 11,
          boxShadow: '0 26px 60px rgba(15,23,42,0.30)', position: 'relative',
        }}
      >
        <div style={{ position: 'absolute', left: '50%', top: 17, transform: 'translateX(-50%)', width: 92, height: 20, borderRadius: 999, background: '#0b1020', zIndex: 5 }} />
        <div style={{ width: '100%', height: '100%', borderRadius: 30, overflow: 'hidden', background: '#fff', position: 'relative' }}>
          {children}
        </div>
      </div>
      {label ? (
        <div style={{ font: `700 21px/1 ${T.font}`, color: T.inkSoft, letterSpacing: 0.6 }}>{label}</div>
      ) : null}
    </div>
  );
};

export const StatusBar: React.FC<{ tone?: 'light' | 'dark'; title?: string }> = ({ tone = 'dark', title }) => (
  <div style={{
    height: 44, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
    padding: '0 18px 6px', font: `600 14px/1 ${T.font}`,
    color: tone === 'dark' ? '#0f172a' : '#fff',
  }}>
    <span>{title ?? '9:41'}</span>
    <span style={{ letterSpacing: 2 }}>▮▮▮ ▲ ▰</span>
  </div>
);

/** A voice waveform. `energy` 0..1 drives height; `seed` decorrelates bars. */
export const Waveform: React.FC<{
  bars?: number; energy: number; color: string; height?: number; seed?: number; width?: number;
}> = ({ bars = 34, energy, color, height = 54, seed = 1, width }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 3, height, width }}>
    {Array.from({ length: bars }).map((_, i) => {
      const n = Math.abs(Math.sin((i + 1) * 12.9898 * seed) * 43758.5453) % 1;
      const hgt = Math.max(4, height * (0.18 + 0.82 * n * energy));
      return <div key={i} style={{ flex: 1, height: hgt, borderRadius: 3, background: color, opacity: 0.55 + 0.45 * energy }} />;
    })}
  </div>
);

/**
 * A candybar feature phone, mid-call. This is the handset the section is actually
 * about: the IVR door needs no smartphone, no data and no app, because it is an
 * ordinary voice call. Drawn rather than screenshotted for obvious reasons.
 */
export const FeaturePhone: React.FC<{ w?: number; label?: string; ringing?: number }> = ({ w = 150, label, ringing = 0 }) => {
  const h = Math.round(w * 2.0);
  const keys = [['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9'], ['*', '0', '#']];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <div style={{
        width: w, height: h, borderRadius: w * 0.14, background: 'linear-gradient(160deg,#3b4048,#23262b)',
        padding: w * 0.055, boxShadow: '0 16px 36px rgba(15,23,42,0.28)', display: 'flex', flexDirection: 'column', gap: w * 0.04,
      }}>
        <div style={{ height: w * 0.06, display: 'flex', justifyContent: 'center' }}>
          <div style={{ width: w * 0.22, height: w * 0.028, borderRadius: 999, background: '#11141a' }} />
        </div>
        {/* screen */}
        <div style={{
          background: '#b9d4a8', borderRadius: w * 0.04, padding: w * 0.05, color: '#16240f',
          height: h * 0.32, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: w * 0.035,
        }}>
          <div style={{ font: `700 ${w * 0.058}px/1 ${T.font}`, letterSpacing: 0.4, opacity: 0.75 }}>INCOMING CALL</div>
          <div style={{ font: `800 ${w * 0.085}px/1.15 ${T.font}` }}>PM-AJAY Saathi</div>
          <div style={{ font: `600 ${w * 0.055}px/1 ${T.font}`, opacity: 0.8 }}>
            {ringing > 0 ? 'ringing…' : 'calling you back'}
          </div>
        </div>
        {/* soft keys + d-pad row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: `0 ${w * 0.04}px` }}>
          <div style={{ width: w * 0.2, height: w * 0.075, borderRadius: 999, background: '#1f7a3d' }} />
          <div style={{ width: w * 0.16, height: w * 0.16, borderRadius: 999, border: `${w * 0.02}px solid #4a505a`, background: '#2b2f36' }} />
          <div style={{ width: w * 0.2, height: w * 0.075, borderRadius: 999, background: '#a33' }} />
        </div>
        {/* physical keypad */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: w * 0.028, justifyContent: 'flex-end' }}>
          {keys.map((row, i) => (
            <div key={i} style={{ display: 'flex', gap: w * 0.028 }}>
              {row.map((k) => (
                <div key={k} style={{
                  flex: 1, background: '#30353d', borderRadius: w * 0.032, textAlign: 'center',
                  padding: `${w * 0.022}px 0`, color: '#e8eaee', font: `600 ${w * 0.072}px/1 ${T.font}`,
                }}>{k}</div>
              ))}
            </div>
          ))}
        </div>
      </div>
      {label ? <div style={{ font: `700 18px/1.25 ${T.font}`, color: T.inkSoft, textAlign: 'center' }}>{label}</div> : null}
    </div>
  );
};
