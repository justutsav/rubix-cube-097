import React from 'react';
import { useCurrentFrame, interpolate } from 'remotion';
import { CAPTIONS, at, FPS } from '../timeline';
import { T } from '../theme';

/**
 * The spoken line, verbatim off the source frames. The original cut burns its own
 * karaoke captions; this is the same text, set cleanly, so a judge can follow the
 * explanation with the sound off.
 */
export const Caption: React.FC = () => {
  const frame = useCurrentFrame();
  const line = CAPTIONS.find((c) => frame >= at(c.abs) && frame <= at(c.end));
  if (!line) return null;

  const start = at(line.abs);
  const opacity = interpolate(frame - start, [0, 5], [0, 1], { extrapolateRight: 'clamp' });
  const lift = interpolate(frame - start, [0, 8], [10, 0], { extrapolateRight: 'clamp' });

  return (
    <div
      style={{
        position: 'absolute', left: 0, right: 0, bottom: 34,
        display: 'flex', justifyContent: 'center', opacity,
        transform: `translateY(${lift}px)`,
      }}
    >
      <div
        style={{
          maxWidth: 1500, padding: '16px 34px', borderRadius: 16,
          background: 'rgba(15,23,42,0.92)', color: '#fff',
          font: `500 30px/1.32 ${T.font}`, textAlign: 'center',
          boxShadow: T.shadow, letterSpacing: 0.2,
        }}
      >
        {line.text}
      </div>
    </div>
  );
};

/** Running clock against the source cut, so anyone can check a beat against the tape. */
export const SourceStamp: React.FC = () => {
  const frame = useCurrentFrame();
  const abs = 95.5 + frame / FPS;
  const m = Math.floor(abs / 60);
  const s = (abs % 60).toFixed(1).padStart(4, '0');
  return (
    <div style={{
      position: 'absolute', right: 34, top: 30, font: `600 20px/1 ${T.font}`,
      color: T.inkSoft, letterSpacing: 1.4, opacity: 0.75,
    }}>
      SPEAKER 3 · {m}:{s}
    </div>
  );
};
