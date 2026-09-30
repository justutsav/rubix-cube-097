import React from 'react';
import { interpolate } from 'remotion';
import { T } from '../theme';

/** The closer: three bridges collapsing into one engine and one record. */
export const CloseOverlay: React.FC<{ t: number }> = ({ t }) => {
  const merge = interpolate(t, [0.2, 1.5], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const show = interpolate(t, [1.1, 1.8], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const doors = [
    { label: 'IVR call', x: -430, y: 0 },
    { label: 'WhatsApp', x: 0, y: -26 },
    { label: 'Kiosk app', x: 430, y: 26 },
  ];
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(238,242,240,0.93)' }} />
      <div style={{ position: 'relative', width: 1400, height: 620 }}>
        {doors.map((d) => (
          <div
            key={d.label}
            style={{
              position: 'absolute', left: '50%', top: 40,
              transform: `translate(${d.x * (1 - merge) - 90}px, ${d.y * (1 - merge) + 108 * merge}px) scale(${1 - 0.34 * merge})`,
              width: 180, padding: '18px 0', textAlign: 'center',
              borderRadius: 16, background: '#fff', border: `2px solid ${T.mintDeep}`,
              font: `700 24px/1.2 ${T.font}`, color: T.ink, boxShadow: T.shadowSm,
              opacity: Math.max(0, 1 - 1.15 * merge),
            }}
          >
            {d.label}
          </div>
        ))}

        <div style={{
          position: 'absolute', left: '50%', top: 190, transform: 'translateX(-50%)',
          width: 420, padding: '20px 0', textAlign: 'center', borderRadius: 18,
          background: T.mint, border: `2px solid ${T.mintDeep}`, color: '#06331a',
          font: `800 30px/1.2 ${T.font}`, opacity: merge, boxShadow: T.shadowSm,
        }}>
          One engine
        </div>
        <div style={{
          position: 'absolute', left: '50%', top: 288, transform: 'translateX(-50%)',
          width: 300, padding: '16px 0', textAlign: 'center', borderRadius: 18,
          background: '#fff', border: `2px solid ${T.blue}`, color: T.blue,
          font: `800 26px/1.2 ${T.font}`, opacity: merge, boxShadow: T.shadowSm,
        }}>
          One record
        </div>

        <div style={{ position: 'absolute', left: 0, right: 0, top: 400, textAlign: 'center', opacity: show }}>
          <div style={{ font: `900 76px/1.1 ${T.font}`, color: T.ink, letterSpacing: -1 }}>
            Three channels. One system.
          </div>
          <div style={{ font: `600 38px/1.3 ${T.font}`, color: T.inkSoft, marginTop: 18 }}>
            And no complicated forms.
          </div>
        </div>
      </div>
    </div>
  );
};
