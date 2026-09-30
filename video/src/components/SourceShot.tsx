import React from 'react';
import { Img, staticFile, interpolate, Easing } from 'remotion';
import { SOURCES as S1_SOURCES, type HlRect } from '../s1Sources';
import { SOURCES_S5 } from '../s5Sources';

/** Both sections' crops live in one lookup — the component does not care which cut it is. */
const SOURCES = { ...S1_SOURCES, ...SOURCES_S5 };

const E = { easing: Easing.out(Easing.cubic), extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

export type Swipe = { name: string; at: number; per?: number; dur?: number };

/**
 * A real crop of a real page, with a real highlighter.
 *
 * The crop and every rectangle come out of the PDF itself (s1Sources.ts), so the
 * yellow can only ever land on the words it is quoting. The bar wipes left to
 * right one line at a time, multiplied over the page so the text stays readable —
 * a fill would hide the sentence the highlight exists to point at.
 */
const Highlight: React.FC<{ r: HlRect; p: number }> = ({ r, p }) => {
  // the ink sits a touch taller than the glyph box and a hair off level, like a real pen
  const padY = r.h * 0.22;
  return (
    // multiply lives on THIS element, not on a child. `transform` makes an element an
    // isolated group for its descendants, so a child that blends here would blend against
    // this wrapper's transparent backdrop and come out opaque — which paints the sentence
    // out instead of highlighting it. Blending the wrapper itself puts the page underneath
    // back in the backdrop, and the black text survives the yellow.
    <div style={{
      position: 'absolute',
      left: `${r.x * 100}%`,
      top: `${(r.y - padY) * 100}%`,
      width: `${r.w * p * 100}%`,
      height: `${(r.h + padY * 2) * 100}%`,
      overflow: 'hidden',
      transform: 'rotate(-0.25deg)',
      transformOrigin: 'left center',
      mixBlendMode: 'multiply',
      pointerEvents: 'none',
    }}>
      <div style={{
        position: 'absolute', inset: 0,
        width: `${100 / Math.max(p, 0.0001)}%`,
        background: 'linear-gradient(180deg, rgba(255,231,64,0.72) 0%, rgba(255,214,0,0.95) 45%, rgba(250,196,0,0.8) 100%)',
        borderRadius: 4,
      }} />
      {/* the wet edge under the nib */}
      {p > 0.02 && p < 0.995 ? (
        <div style={{
          position: 'absolute', right: 0, top: 0, bottom: 0, width: 10,
          background: 'linear-gradient(90deg, rgba(255,196,0,0) 0%, rgba(245,158,11,0.85) 100%)',
        }} />
      ) : null}
    </div>
  );
};

export const SourceShot: React.FC<{
  id: string;
  t: number;
  width: number;
  appear?: number;
  swipes?: Swipe[];
  /** scale + focal point (0..1 of the crop) to push into after `at` seconds */
  zoom?: { at: number; to: number; x: number; y: number; len?: number };
  chip?: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ id, t, width, appear = 0, swipes = [], zoom, chip, style }) => {
  const src = SOURCES[id];
  if (!src) throw new Error(`no source crop named ${id}`);
  // the page sits inside a 16px paper margin; the highlight boxes are percentages of
  // the *image*, so the frame that holds them has to be exactly the image's box
  const inner = width - 32;
  const h = inner / src.aspect;

  const o = interpolate(t, [appear, appear + 0.42], [0, 1], E);
  const rise = (1 - o) * 26;

  const z = zoom ? interpolate(t, [zoom.at, zoom.at + (zoom.len ?? 0.8)], [1, zoom.to], E) : 1;
  const ox = zoom ? (0.5 - zoom.x) * width * (z - 1) : 0;
  const oy = zoom ? (0.5 - zoom.y) * h * (z - 1) : 0;

  return (
    <div style={{ opacity: o, transform: `translateY(${rise}px)`, ...style }}>
      <div style={{
        width, background: '#fff', borderRadius: 14, padding: 16,
        boxShadow: '0 22px 50px rgba(15,23,42,0.18)', border: '1px solid #cbd5e1',
      }}>
        <div style={{ position: 'relative', width: inner, height: h, overflow: 'hidden', borderRadius: 6 }}>
          <div style={{
            position: 'absolute', inset: 0,
            transform: `translate(${ox}px, ${oy}px) scale(${z})`,
            transformOrigin: 'center center',
          }}>
            <Img src={staticFile(src.src)} style={{ width: '100%', display: 'block' }} />
            {swipes.map((s) => {
              const rects = src.hl[s.name] ?? [];
              return rects.map((r, i) => {
                const from = s.at + i * (s.per ?? 0.38);
                const p = interpolate(t, [from, from + (s.dur ?? 0.46)], [0, 1], E);
                return p <= 0.01 ? null : <Highlight key={`${s.name}-${i}`} r={r} p={p} />;
              });
            })}
          </div>
        </div>
      </div>
      {chip ? <div style={{ marginTop: 10 }}>{chip}</div> : null}
    </div>
  );
};

/** The attribution that rides under every document. Small, always present, never spoken. */
export const Cite: React.FC<{ children: React.ReactNode; o?: number }> = ({ children, o = 1 }) => (
  <div style={{
    display: 'inline-flex', alignItems: 'center', gap: 10, opacity: o,
    padding: '7px 14px', borderRadius: 999,
    background: '#ffffff', border: '1px solid #cbd5e1',
    font: '600 18px/1 "Segoe UI", Arial, sans-serif', color: '#475569', letterSpacing: 0.4,
  }}>
    <span style={{ width: 7, height: 7, borderRadius: 999, background: '#f4a638' }} />
    {children}
  </div>
);
