import React from 'react';
import { AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame, interpolate, getInputProps } from 'remotion';
import { S5_SCENES, CAPTIONS_S5, CUES_S5, S5_START_ABS, at5, FPS_S5 } from './s5Timeline';
import { resolveCues } from './cues';
import { T, STAGE } from './theme';
import {
  S5Sources, S5Dialects, S5Design, S5ErrorRate, S5Scheme, S5Advert, S5Process, S5Close,
} from './scenes/S5Scenes';

const SCENE: Record<string, React.FC<{ t: number }> | undefined> = {
  sources: S5Sources, dialects: S5Dialects, design: S5Design, errorrate: S5ErrorRate,
  scheme: S5Scheme, advert: S5Advert, process: S5Process, close: S5Close,
};

const Header: React.FC = () => (
  <div style={{ position: 'absolute', left: 56, top: 28 }}>
    <div style={{ font: `800 27px/1 ${T.font}`, color: T.ink, letterSpacing: -0.2 }}>
      PM-AJAY Livelihood · <span style={{ color: '#b45309' }}>The evidence</span>
    </div>
    <div style={{ font: `600 18px/1 ${T.font}`, color: T.inkSoft, marginTop: 8, letterSpacing: 1 }}>
      Rubix Cube · SIH 26097
    </div>
  </div>
);

const Caption5: React.FC = () => {
  const frame = useCurrentFrame();
  const line = CAPTIONS_S5.find((c) => frame >= at5(c.abs) && frame <= at5(c.end));
  if (!line) return null;
  const start = at5(line.abs);
  const o = interpolate(frame - start, [0, 5], [0, 1], { extrapolateRight: 'clamp' });
  const lift = interpolate(frame - start, [0, 8], [10, 0], { extrapolateRight: 'clamp' });
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 34, display: 'flex', justifyContent: 'center', opacity: o, transform: `translateY(${lift}px)` }}>
      <div style={{
        maxWidth: 1500, padding: '16px 34px', borderRadius: 16, background: 'rgba(15,23,42,0.92)',
        color: '#fff', font: `500 30px/1.32 ${T.font}`, textAlign: 'center', boxShadow: T.shadow,
      }}>{line.text}</div>
    </div>
  );
};

export const ExplainerS5: React.FC = () => {
  const frame = useCurrentFrame();

  const idx = Math.max(0, S5_SCENES.findIndex((s, i) =>
    frame >= at5(s.fromAbs) && (i === S5_SCENES.length - 1 || frame < at5(S5_SCENES[i + 1].fromAbs))));
  const scene = S5_SCENES[idx];
  const t = (frame - at5(scene.fromAbs)) / FPS_S5;
  const dur = scene.toAbs - scene.fromAbs;

  const out = interpolate(t, [dur - 0.3, dur], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const Scene = SCENE[scene.id];

  return (
    <AbsoluteFill style={{ background: T.bg, width: STAGE.w, height: STAGE.h, fontFamily: T.font }}>
      {/* --props='{"muteNarration":true}' renders the effects alone. */}
      {(getInputProps() as { muteNarration?: boolean }).muteNarration ? null : (
        <Audio src={staticFile('narration_s5.wav')} />
      )}
      {resolveCues(CUES_S5, S5_SCENES, S5_START_ABS, FPS_S5).map((c, i) => (
        <Sequence key={i} from={c.frame} durationInFrames={FPS_S5 * 3} layout="none">
          <Audio src={staticFile(`sfx_soft/${c.file}`)} volume={c.volume} />
        </Sequence>
      ))}

      <div style={{ position: 'absolute', inset: 0, opacity: out, transform: `translateY(${(1 - out) * -14}px)` }}>
        {Scene ? <Scene t={t} /> : null}
      </div>

      <Header />
      <Caption5 />
    </AbsoluteFill>
  );
};
