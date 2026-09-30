import React from 'react';
import { T } from '../theme';
import { Waveform } from './Phone';

/**
 * A stock Android in-call screen, drawn to match a real handset.
 *
 * The point this screen has to make on its own: **this is an ordinary phone call.**
 * No app, no data, no smartphone required — the dialer is the interface. The keypad
 * is real too: the build accepts a keypad press as well as speech (the flowchart's
 * "Keypad Press" under Keywords Extraction), which is what a noisy room needs.
 *
 * The flow is missed-call -> the system rings *her* back, so the header says it is
 * calling her back rather than showing a dial-out.
 */

const D: Record<string, string> = {
  '1': '', '2': 'ABC', '3': 'DEF', '4': 'GHI', '5': 'JKL', '6': 'MNO',
  '7': 'PQRS', '8': 'TUV', '9': 'WXYZ', '*': '', '0': '+', '#': '',
};
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];

/** Monochrome control icons, drawn rather than emoji — colour emoji fights the dark UI. */
const Glyph: React.FC<{ kind: string; s: number; on?: boolean }> = ({ kind, s, on }) => {
  const c = on ? '#1b1b1f' : '#e3e3e6';
  if (kind === 'keypad') {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 2.5 * s }}>
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} style={{ width: 3 * s, height: 3 * s, borderRadius: 999, background: c }} />
        ))}
      </div>
    );
  }
  if (kind === 'mic') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5 * s }}>
        <div style={{ width: 6.5 * s, height: 11 * s, borderRadius: 999, background: c }} />
        <div style={{ width: 11 * s, height: 1.8 * s, borderRadius: 999, background: c }} />
      </div>
    );
  }
  if (kind === 'speaker') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 1.5 * s }}>
        <div style={{ width: 5 * s, height: 7 * s, background: c, borderRadius: 1 * s }} />
        <div style={{
          width: 0, height: 0, borderTop: `${6 * s}px solid transparent`, borderBottom: `${6 * s}px solid transparent`,
          borderRight: `${6 * s}px solid ${c}`, marginLeft: -2 * s,
        }} />
        <div style={{ width: 4 * s, height: 8 * s, borderRight: `${1.6 * s}px solid ${c}`, borderRadius: '0 999px 999px 0' }} />
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2.5 * s }}>
      {[0, 1, 2].map((i) => <div key={i} style={{ width: 3 * s, height: 3 * s, borderRadius: 999, background: c }} />)}
    </div>
  );
};

const Ctl: React.FC<{ kind: string; label: string; active?: boolean; s: number }> = ({ kind, label, active, s }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 * s }}>
    <div style={{
      width: 44 * s, height: 44 * s, borderRadius: 999,
      background: active ? '#d7d0ff' : '#2a2d31',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}><Glyph kind={kind} s={s} on={active} /></div>
    <div style={{ font: `500 ${10.5 * s}px/1 ${T.font}`, color: '#c7c7cc' }}>{label}</div>
  </div>
);

export const CallScreen: React.FC<{
  /** scale factor: 1 == a 352px-wide phone */
  s?: number;
  keypad?: boolean;
  pressed?: string | null;
  seconds?: number;
  question?: string;
  answer?: string;
  readback?: boolean;
  energy?: number;
}> = ({ s = 1, keypad = false, pressed = null, seconds = 0, question, answer, readback, energy = 0 }) => {
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(Math.floor(seconds % 60)).padStart(2, '0');

  return (
    <div style={{ width: '100%', height: '100%', background: '#1b1c1e', color: '#fff', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      {/* status bar */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: `${13 * s}px ${14 * s}px 0`, font: `600 ${11 * s}px/1 ${T.font}`, color: '#e3e3e6',
      }}>
        <span>7:06 &nbsp;📞</span>
        <span style={{ letterSpacing: 1 }}>4G ▮▮▮ 57%</span>
      </div>

      {/* who is on the line */}
      <div style={{ textAlign: 'center', paddingTop: 14 * s }}>
        <div style={{ font: `500 ${12.5 * s}px/1.2 ${T.font}`, color: '#b9bcc2' }}>
          {seconds > 0 ? `In call  ${mm}:${ss}` : 'Calling you back…'}
        </div>
        <div style={{ font: `400 ${29 * s}px/1.15 ${T.font}`, marginTop: 8 * s, letterSpacing: -0.4 }}>PM-AJAY Saathi</div>
        <div style={{ font: `400 ${12.5 * s}px/1.2 ${T.font}`, color: '#b9bcc2', marginTop: 6 * s }}>Mobile  +91 ••••• 26097</div>
      </div>

      {/* the IVR turn, where a stock dialer would show the avatar */}
      <div style={{ flex: 1, minHeight: 0, padding: `${12 * s}px ${13 * s}px`, display: 'flex', flexDirection: 'column', gap: 8 * s, justifyContent: 'center' }}>
        {!keypad ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7 * s, marginBottom: 4 * s }}>
            <div style={{
              width: 62 * s, height: 62 * s, borderRadius: 999, background: '#2f4f3c',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              font: `700 ${21 * s}px/1 ${T.font}`, color: '#9fe6b8',
            }}>PA</div>
            <Waveform energy={0.25 + 0.5 * energy} color="#6b7280" height={14 * s} bars={22} seed={11} />
          </div>
        ) : null}
        {question ? (
          <div style={{ background: '#26282c', borderRadius: 13 * s, padding: `${10 * s}px ${12 * s}px` }}>
            <div style={{ font: `700 ${9.5 * s}px/1 ${T.font}`, color: '#8ad6a4', letterSpacing: 1.2, marginBottom: 6 * s }}>SYSTEM ASKS</div>
            <div style={{ font: `600 ${14.5 * s}px/1.35 ${T.font}` }}>{question}</div>
          </div>
        ) : null}
        {answer ? (
          <div style={{ background: '#f4f5f7', color: '#101317', borderRadius: 13 * s, padding: `${10 * s}px ${12 * s}px` }}>
            <div style={{ font: `700 ${9.5 * s}px/1 ${T.font}`, color: '#4b5563', letterSpacing: 1.2, marginBottom: 6 * s }}>SHE ANSWERS · IN HER LANGUAGE</div>
            <div style={{ font: `600 ${14.5 * s}px/1.35 ${T.font}` }}>{answer}</div>
            <div style={{ marginTop: 7 * s }}><Waveform energy={energy} color={T.green} height={22 * s} bars={26} seed={3} /></div>
          </div>
        ) : null}
        {readback ? (
          <div style={{ background: 'rgba(250,204,21,0.16)', border: '1px solid rgba(250,204,21,0.45)', borderRadius: 12 * s, padding: `${9 * s}px ${11 * s}px` }}>
            <div style={{ font: `700 ${12 * s}px/1.3 ${T.font}` }}>↺ Read back — “is that right?”</div>
            <div style={{ font: `500 ${10.5 * s}px/1.35 ${T.font}`, color: '#e8e2c4', marginTop: 3 * s }}>
              Nothing is counted until she confirms.
            </div>
          </div>
        ) : null}
      </div>

      {/* keypad sheet */}
      {keypad ? (
        <div style={{ background: '#25272b', borderTopLeftRadius: 22 * s, borderTopRightRadius: 22 * s, padding: `${10 * s}px ${12 * s}px ${6 * s}px` }}>
          <div style={{ font: `400 ${16 * s}px/1 ${T.font}`, color: '#c7c7cc', marginBottom: 6 * s }}>✕</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 * s }}>
            {KEYS.map((k) => (
              <div
                key={k}
                style={{
                  background: pressed === k ? '#4a4f57' : '#1c1e21', borderRadius: 999,
                  padding: `${6 * s}px 0`, textAlign: 'center',
                  transform: pressed === k ? 'scale(0.95)' : 'none',
                }}
              >
                <div style={{ font: `400 ${17 * s}px/1.05 ${T.font}` }}>{k}</div>
                {D[k] ? <div style={{ font: `600 ${7.5 * s}px/1 ${T.font}`, color: '#a8acb3', letterSpacing: 0.8 }}>{D[k]}</div> : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* controls + hang up */}
      <div style={{ background: keypad ? '#25272b' : 'transparent', padding: `${8 * s}px ${14 * s}px ${12 * s}px` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Ctl kind="keypad" label="Keypad" active={keypad} s={s} />
          <Ctl kind="mic" label="Mute" s={s} />
          <Ctl kind="speaker" label="Speaker" s={s} />
          <Ctl kind="more" label="More" s={s} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 10 * s }}>
          <div style={{
            width: 96 * s, height: 40 * s, borderRadius: 999, background: '#f2827f',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{
              width: 19 * s, height: 19 * s, borderRadius: `0 0 ${9 * s}px ${9 * s}px`,
              borderBottom: `${4 * s}px solid #1b1b1f`, borderLeft: `${4 * s}px solid #1b1b1f`,
              borderRight: `${4 * s}px solid #1b1b1f`, transform: 'rotate(135deg)',
            }} />
          </div>
        </div>
      </div>
    </div>
  );
};
