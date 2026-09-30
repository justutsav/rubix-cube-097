import React from 'react';
import { staticFile, Img, useCurrentFrame } from 'remotion';
import type { Rect } from '../timeline';
import { T } from '../theme';
import { SLIDE_CHART } from '../slideTimeline';

const IMG = { w: 1521, h: 927 };

/** Grow a rect to the card's aspect about its centre, so scale never depends on a min(). */
const toAspect = (r: Rect, aspect: number): Rect => {
  const cur = r.w / r.h;
  if (cur < aspect) {
    const w = r.h * aspect;
    return { x: r.x - (w - r.w) / 2, y: r.y, w, h: r.h };
  }
  const h = r.w / aspect;
  return { x: r.x, y: r.y - (h - r.h) / 2, w: r.w, h };
};

/**
 * The chart card never moves in this cut. The camera slides inside it, and blurs
 * a little while it travels — a still frame mid-slide should look like a pan, not
 * like a cut.
 */
export const FlowchartRail: React.FC<{
  view: Rect;
  blur: number;
  highlight: Rect | null;
  highlightOpacity: number;
  chip: string;
  chipOpacity: number;
}> = ({ view, blur, highlight, highlightOpacity, chip, chipOpacity }) => {
  const frame = useCurrentFrame();
  const aspect = SLIDE_CHART.w / SLIDE_CHART.h;
  const v = toAspect(view, aspect);
  const scale = SLIDE_CHART.w / v.w;
  const pulse = 0.5 + 0.5 * Math.sin(frame / 9);

  return (
    <>
      <div
        style={{
          position: 'absolute', left: SLIDE_CHART.x, top: SLIDE_CHART.y,
          width: SLIDE_CHART.w, height: SLIDE_CHART.h,
          background: T.card, borderRadius: 22, boxShadow: T.shadow,
          overflow: 'hidden', border: `1px solid ${T.line}`,
        }}
      >
        <div
          style={{
            position: 'absolute', left: -v.x * scale, top: -v.y * scale,
            transform: `scale(${scale})`, transformOrigin: '0 0',
            filter: blur > 0.05 ? `blur(${blur}px)` : undefined,
          }}
        >
          <Img src={staticFile('flowchart.png')} style={{ width: IMG.w, height: IMG.h, display: 'block' }} />
          {highlight ? (
            <div
              style={{
                position: 'absolute',
                left: highlight.x - 10, top: highlight.y - 10,
                width: highlight.w + 20, height: highlight.h + 20,
                border: `${3.5 / scale}px solid ${T.green}`, borderRadius: 16 / scale,
                boxShadow: `0 0 ${24 / scale}px rgba(22,163,74,${0.3 * highlightOpacity * (0.7 + 0.3 * pulse)})`,
                opacity: highlightOpacity, background: `rgba(22,163,74,${0.05 * highlightOpacity})`,
              }}
            />
          ) : null}
        </div>

        <div style={{
          position: 'absolute', left: 16, top: 14, padding: '6px 14px', borderRadius: 999,
          background: 'rgba(15,23,42,0.82)', color: '#fff', font: `700 16px/1 ${T.font}`, letterSpacing: 1.2,
        }}>
          FLOWCHART
        </div>
      </div>

      {/* which stop the camera is parked on */}
      <div style={{
        position: 'absolute', left: SLIDE_CHART.x, top: SLIDE_CHART.y + SLIDE_CHART.h + 18,
        width: SLIDE_CHART.w, display: 'flex', justifyContent: 'center',
      }}>
        <div style={{
          padding: '11px 30px', borderRadius: 999, background: T.mint,
          border: `2px solid ${T.mintDeep}`, color: '#06331a',
          font: `800 30px/1 ${T.font}`, boxShadow: T.shadowSm,
          opacity: chipOpacity, transform: `translateY(${(1 - chipOpacity) * 8}px)`,
        }}>
          {chip}
        </div>
      </div>
    </>
  );
};
