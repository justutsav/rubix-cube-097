import React from 'react';
import { T } from '../theme';
import { StatusBar } from './Phone';

const Bubble: React.FC<{ side: 'in' | 'out'; children: React.ReactNode; time: string; show: number }> = ({ side, children, time, show }) => (
  <div style={{
    display: 'flex', justifyContent: side === 'out' ? 'flex-end' : 'flex-start',
    opacity: show, transform: `translateY(${(1 - show) * 14}px)`,
  }}>
    <div style={{
      maxWidth: '86%', background: side === 'out' ? '#d9fdd3' : '#fff', borderRadius: 12,
      padding: '9px 11px 6px', boxShadow: '0 1px 1px rgba(0,0,0,0.13)',
      borderTopRightRadius: side === 'out' ? 3 : 12, borderTopLeftRadius: side === 'out' ? 12 : 3,
    }}>
      {children}
      <div style={{ font: `500 11px/1 ${T.font}`, color: '#667781', textAlign: 'right', marginTop: 5 }}>
        {time} {side === 'out' ? '✓✓' : ''}
      </div>
    </div>
  </div>
);

/** A voice note bubble — the thing the whole WhatsApp door is about. */
const VoiceNote: React.FC<{ secs: string; played?: number; tint?: string }> = ({ secs, played = 0, tint = '#25d366' }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 196 }}>
    <div style={{ width: 30, height: 30, borderRadius: 999, background: tint, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', font: '13px sans-serif' }}>▶</div>
    <div style={{ flex: 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, height: 24 }}>
        {Array.from({ length: 26 }).map((_, i) => {
          const n = Math.abs(Math.sin((i + 3) * 8.233) * 1000) % 1;
          return <div key={i} style={{ flex: 1, height: Math.max(4, 22 * (0.25 + 0.75 * n)), borderRadius: 2, background: i / 26 < played ? tint : '#b8c4cc' }} />;
        })}
      </div>
      <div style={{ font: `500 11px/1 ${T.font}`, color: '#667781', marginTop: 3 }}>{secs}</div>
    </div>
  </div>
);

/**
 * The asynchronous door. One question per message, as audio — we costed batching
 * and rejected it, because batching turns WhatsApp into a form read aloud.
 */
export const WhatsAppScreen: React.FC<{ step: number; recording?: number }> = ({ step, recording = 0 }) => (
  <div style={{ width: '100%', height: '100%', background: '#efeae2', display: 'flex', flexDirection: 'column' }}>
    <div style={{ background: '#075e54', color: '#fff' }}>
      <StatusBar tone="light" />
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '6px 14px 11px' }}>
        <div style={{ width: 36, height: 36, borderRadius: 999, background: '#25d366', display: 'flex', alignItems: 'center', justifyContent: 'center', font: '17px sans-serif' }}>✓</div>
        <div>
          <div style={{ font: `700 16px/1.1 ${T.font}` }}>PM-AJAY Saathi</div>
          <div style={{ font: `500 12px/1.2 ${T.font}`, opacity: 0.85, marginTop: 2 }}>online</div>
        </div>
      </div>
    </div>

    <div style={{ flex: 1, padding: '14px 12px', display: 'flex', flexDirection: 'column', gap: 9 }}>
      <Bubble side="out" time="10:02" show={Math.min(1, Math.max(0, step))}>
        <VoiceNote secs="0:06" played={0.62} />
      </Bubble>
      <Bubble side="in" time="10:02" show={Math.min(1, Math.max(0, step - 1))}>
        <div style={{ font: `600 13px/1.35 ${T.font}`, color: T.ink, marginBottom: 7 }}>One question at a time</div>
        <VoiceNote secs="0:04" played={0.35} tint="#075e54" />
      </Bubble>
      <Bubble side="out" time="10:47" show={Math.min(1, Math.max(0, step - 2))}>
        <VoiceNote secs="0:08" played={0.2} />
      </Bubble>
      {step > 2.4 ? (
        <div style={{ alignSelf: 'center', background: 'rgba(15,23,42,0.06)', borderRadius: 999, padding: '5px 12px', font: `600 11px/1 ${T.font}`, color: T.inkSoft }}>
          answered between chores — the session waits
        </div>
      ) : null}
    </div>

    <div style={{ padding: 9, background: '#f0f2f5', display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 38, borderRadius: 999, background: '#fff', display: 'flex', alignItems: 'center', padding: '0 13px', gap: 8 }}>
        {recording > 0 ? (
          <>
            <div style={{ width: 8, height: 8, borderRadius: 999, background: '#ef4444', opacity: 0.4 + 0.6 * Math.abs(Math.sin(recording * 6)) }} />
            <span style={{ font: `600 13px/1 ${T.font}`, color: '#ef4444' }}>recording… {recording.toFixed(1)}s</span>
          </>
        ) : (
          <span style={{ font: `500 13px/1 ${T.font}`, color: '#8696a0' }}>Hold the mic to answer</span>
        )}
      </div>
      <div style={{ width: 38, height: 38, borderRadius: 999, background: '#25d366', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', font: '17px sans-serif' }}>🎤</div>
    </div>
  </div>
);
