import React from 'react';
import { staticFile, Img, interpolate, useCurrentFrame } from 'remotion';
import { FOCUS, type Rect } from '../timeline';
import { T, RAIL, FULL } from '../theme';

const IMG = { w: 1521, h: 927 };

/**
 * Grow a rect to a given aspect ratio about its own centre.
 *
 * This is the whole trick behind a bump-free zoom. If you fit a rect into a box
 * with min(boxW/w, boxH/h), the binding dimension can flip part-way through the
 * move — and the instant it flips, the rate of change of scale jumps and the eye
 * reads it as a hop. Matching the camera rect to the box aspect every frame means
 * scale is always boxW/rect.w: one smooth curve, no flip, no bump.
 */
const toAspect = (r: Rect, aspect: number): Rect => {
  const cur = r.w / r.h;
  if (cur < aspect) {
    const w = r.h * aspect;
    return { x: r.x - (w - r.w) / 2, y: r.y, w, h: r.h };
  }
  const h = r.w / aspect;
  return { x: r.x, y: r.y - (h - r.h) / 2, w: r.w, h };
};

const pad = (r: Rect, k: number): Rect => ({
  x: r.x - (r.w * (k - 1)) / 2,
  y: r.y - (r.h * (k - 1)) / 2,
  w: r.w * k,
  h: r.h * k,
});

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * The chart. `rail` is the eased 0..1 camera position: 0 is the whole chart filling
 * the frame, 1 is the focused node parked in the left rail. One parameter drives the
 * card geometry and the camera together, so it is a single continuous move.
 */
export const FlowchartStage: React.FC<{
  focus: keyof typeof FOCUS;
  rail: number;
  highlight: number;
}> = ({ focus, rail, highlight }) => {
  const frame = useCurrentFrame();

  const box = {
    x: lerp(FULL.x, RAIL.x, rail),
    y: lerp(FULL.y, RAIL.y, rail),
    w: lerp(FULL.w, RAIL.w, rail),
    h: lerp(FULL.h, RAIL.h, rail),
  };
  const aspect = box.w / box.h;

  // Both ends of the move, expressed in the same aspect as the card is right now.
  const wide = toAspect(pad(FOCUS.whole, 1.02), aspect);
  const near = toAspect(pad(FOCUS[focus], 1.16), aspect);

  const view: Rect = {
    x: lerp(wide.x, near.x, rail),
    y: lerp(wide.y, near.y, rail),
    w: lerp(wide.w, near.w, rail),
    h: lerp(wide.h, near.h, rail),
  };

  const scale = box.w / view.w;
  const left = -view.x * scale;
  const top = -view.y * scale;

  const r = FOCUS[focus];
  const pulse = 0.5 + 0.5 * Math.sin(frame / 9);

  return (
    <div
      style={{
        position: 'absolute', left: box.x, top: box.y, width: box.w, height: box.h,
        background: T.card, borderRadius: 22, boxShadow: T.shadow,
        overflow: 'hidden', border: `1px solid ${T.line}`,
      }}
    >
      <div style={{ position: 'absolute', left, top, transform: `scale(${scale})`, transformOrigin: '0 0' }}>
        <Img src={staticFile('flowchart.png')} style={{ width: IMG.w, height: IMG.h, display: 'block' }} />
        <div
          style={{
            position: 'absolute', left: r.x - 12, top: r.y - 12, width: r.w + 24, height: r.h + 24,
            border: `${3.5 / scale}px solid ${T.green}`, borderRadius: 18 / scale,
            boxShadow: `0 0 ${26 / scale}px rgba(22,163,74,${0.3 * highlight * (0.7 + 0.3 * pulse)})`,
            opacity: highlight, background: `rgba(22,163,74,${0.05 * highlight})`,
          }}
        />
      </div>
      <div style={{
        position: 'absolute', left: 16, top: 14, padding: '6px 14px', borderRadius: 999,
        background: 'rgba(15,23,42,0.82)', color: '#fff', font: `700 16px/1 ${T.font}`, letterSpacing: 1.2,
      }}>
        FLOWCHART
      </div>
    </div>
  );
};

/** The big label that names the step while the chart still owns the frame. */
export const ChartChip: React.FC<{ text: string; opacity: number; y?: number }> = ({ text, opacity, y = 0 }) => (
  <div style={{
    position: 'absolute', left: 0, right: 0, top: 830, display: 'flex', justifyContent: 'center',
    opacity, transform: `translateY(${y}px)`,
  }}>
    <div style={{
      padding: '14px 40px', borderRadius: 999, background: T.mint,
      border: `2px solid ${T.mintDeep}`, color: '#06331a',
      font: `800 40px/1 ${T.font}`, letterSpacing: 0.4, boxShadow: T.shadowSm,
    }}>
      {text}
    </div>
  </div>
);
