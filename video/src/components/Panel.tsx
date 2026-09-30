import React from 'react';
import { interpolate } from 'remotion';
import { T, PANEL } from '../theme';

/** Which rectangle panels draw into. The sliding cut overrides it. */
export const PanelRect = React.createContext(PANEL);

/** The right-hand explanation surface. Slides in once the chart has moved to the rail. */
export const Panel: React.FC<{ t: number; title: string; kicker?: string; children: React.ReactNode }> = ({ t, title, kicker, children }) => {
  const R = React.useContext(PanelRect);
  const enter = interpolate(t, [0, 0.32], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <div
      style={{
        position: 'absolute', left: R.x, top: R.y, width: R.w, height: R.h,
        background: T.card, borderRadius: 22, border: `1px solid ${T.line}`, boxShadow: T.shadow,
        padding: '30px 34px', display: 'flex', flexDirection: 'column',
        opacity: enter, transform: `translateX(${(1 - enter) * 70}px)`,
      }}
    >
      {kicker ? (
        <div style={{ font: `800 17px/1 ${T.font}`, color: T.green, letterSpacing: 2 }}>{kicker}</div>
      ) : null}
      <div style={{ font: `800 46px/1.15 ${T.font}`, color: T.ink, marginTop: 10 }}>{title}</div>
      <div style={{ height: 4, width: 92, background: T.mint, borderRadius: 999, margin: '18px 0 24px' }} />
      <div style={{ flex: 1, minHeight: 0 }}>{children}</div>
    </div>
  );
};

export const Row: React.FC<{ show: number; children: React.ReactNode; style?: React.CSSProperties }> = ({ show, children, style }) => (
  <div style={{ opacity: Math.min(1, Math.max(0, show)), transform: `translateY(${(1 - Math.min(1, Math.max(0, show))) * 16}px)`, ...style }}>
    {children}
  </div>
);

export const Tick: React.FC<{ ok: boolean; label: string; detail: string; show: number }> = ({ ok, label, detail, show }) => (
  <Row show={show}>
    <div style={{
      display: 'flex', alignItems: 'center', gap: 16, padding: '15px 18px', marginBottom: 12,
      borderRadius: 14, background: ok ? '#f0fdf4' : '#fef2f2',
      border: `1px solid ${ok ? '#bbf7d0' : '#fecaca'}`,
    }}>
      <div style={{
        width: 38, height: 38, borderRadius: 999, flexShrink: 0,
        background: ok ? T.green : T.red, color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center', font: `800 20px/1 ${T.font}`,
      }}>{ok ? '✓' : '!'}</div>
      <div>
        <div style={{ font: `700 25px/1.2 ${T.font}`, color: T.ink }}>{label}</div>
        <div style={{ font: `500 19px/1.3 ${T.font}`, color: T.inkSoft, marginTop: 3 }}>{detail}</div>
      </div>
    </div>
  </Row>
);
