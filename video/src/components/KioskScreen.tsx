import React from 'react';
import { Img, staticFile } from 'remotion';
import { T } from '../theme';
import { StatusBar } from './Phone';

/**
 * The CSC / kiosk door. The honest line is "it keeps working when the link drops":
 * the interview and the record are local, the microphone is not yet. Do not let
 * this screen say "works offline".
 */
export const KioskScreen: React.FC<{ shot?: string | null; syncing?: boolean }> = ({ shot, syncing }) => {
  if (shot) {
    return (
      <div style={{ width: '100%', height: '100%', position: 'relative', background: '#fff' }}>
        <Img src={staticFile(shot)} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top center' }} />
        {syncing ? (
          <div style={{ position: 'absolute', left: 12, right: 12, bottom: 14, background: 'rgba(15,23,42,0.9)', color: '#fff', borderRadius: 12, padding: '10px 12px', font: `600 13px/1.3 ${T.font}` }}>
            ⚡ Link dropped — answers held on device, will sync
          </div>
        ) : null}
      </div>
    );
  }
  // Fallback only if the real screen could not be captured.
  return (
    <div style={{ width: '100%', height: '100%', background: '#fff', display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: T.blue, color: '#fff' }}>
        <StatusBar tone="light" />
        <div style={{ padding: '4px 16px 12px', font: `700 17px/1.2 ${T.font}` }}>CSC Kiosk · Interview</div>
      </div>
      <div style={{ flex: 1, padding: 16, display: 'flex', flexDirection: 'column', gap: 11 }}>
        <div style={{ font: `700 12px/1 ${T.font}`, color: T.inkSoft, letterSpacing: 1.3 }}>QUESTION 4 OF 7</div>
        <div style={{ font: `700 19px/1.32 ${T.font}`, color: T.ink }}>How many years have you worked at the loom?</div>
        <div style={{ height: 60, borderRadius: 12, background: T.blueSoft, border: `1px solid ${T.blue}33` }} />
        {syncing ? (
          <div style={{ marginTop: 'auto', background: '#0f172a', color: '#fff', borderRadius: 12, padding: '10px 12px', font: `600 13px/1.3 ${T.font}` }}>
            ⚡ Link dropped — answers held on device, will sync
          </div>
        ) : null}
      </div>
    </div>
  );
};
