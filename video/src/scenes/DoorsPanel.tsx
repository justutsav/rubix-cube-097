import React from 'react';
import { interpolate } from 'remotion';
import { T } from '../theme';
import { Panel, Row } from '../components/Panel';

/**
 * A beat the narration does not ask for. Before anything is explained, show the
 * three doorways plainly, so the viewer has the shape of the system in their head
 * when the walkthrough starts.
 */
const DOORS = [
  { icon: '📞', tint: '#2563eb', soft: '#dbeafe', name: 'Beneficiary calls', line: 'A missed call. The system rings back.' },
  { icon: '💬', tint: '#16a34a', soft: '#dcfce7', name: 'Sends a voice note', line: 'WhatsApp, answered between chores.' },
  { icon: '🖥', tint: '#b45309', soft: '#fef3c7', name: 'Kiosk-based app', line: 'The CSC operator runs the same interview.' },
];

export const DoorsPanel: React.FC<{ t: number }> = ({ t }) => (
  <Panel t={t} kicker="THE SHAPE OF IT" title="Three doorways in">
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {DOORS.map((d, i) => (
        <Row key={d.name} show={interpolate(t, [0.2 + i * 0.22, 0.6 + i * 0.22], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 20, padding: '20px 22px',
            borderRadius: 16, background: d.soft, border: `1px solid ${d.tint}33`,
          }}>
            <div style={{
              width: 62, height: 62, borderRadius: 999, background: '#fff', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30,
              boxShadow: T.shadowSm,
            }}>{d.icon}</div>
            <div>
              <div style={{ font: `800 30px/1.15 ${T.font}`, color: T.ink }}>{d.name}</div>
              <div style={{ font: `500 21px/1.3 ${T.font}`, color: T.inkSoft, marginTop: 5 }}>{d.line}</div>
            </div>
          </div>
        </Row>
      ))}
      <Row show={interpolate(t, [1.1, 1.5], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })}>
        <div style={{ font: `600 22px/1.35 ${T.font}`, color: T.inkSoft, textAlign: 'center', marginTop: 4 }}>
          Same interview. Same engine. Same record.
        </div>
      </Row>
    </div>
  </Panel>
);
