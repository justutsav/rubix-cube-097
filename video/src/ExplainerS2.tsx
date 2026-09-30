import React from 'react';
import { AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame, interpolate, getInputProps } from 'remotion';
import { S2_SCENES, CAPTIONS_S2, CUES_S2, S2_START_ABS, at2, FPS_S2 } from './s2Timeline';
import { resolveCues } from './cues';
import { T, STAGE } from './theme';
import {
  S2Hook, S2Svc1, S2Svc2, S2Svc3, S2Tells, S2Ai, S2Checks, S2Training, S2Roadmap, S2Close, S2Handoff,
} from './scenes/S2Scenes';

const SCENE: Record<string, React.FC<{ t: number }> | undefined> = {
  hook: S2Hook, svc1: S2Svc1, svc2: S2Svc2, svc3: S2Svc3, tells: S2Tells,
  ai: S2Ai, checks: S2Checks, training: S2Training, roadmap: S2Roadmap,
  close: S2Close, handoff: S2Handoff,
};

const Header: React.FC = () => (
  <div style={{ position: 'absolute', left: 56, top: 28 }}>
    <div style={{ font: `800 27px/1 ${T.font}`, color: T.ink, letterSpacing: -0.2 }}>
      PM-AJAY Livelihood · <span style={{ color: T.green }}>What the system does for her</span>
    </div>
    <div style={{ font: `600 18px/1 ${T.font}`, color: T.inkSoft, marginTop: 8, letterSpacing: 1 }}>
      Rubix Cube · SIH 26097
    </div>
  </div>
);

const Caption2: React.FC = () => {
  const frame = useCurrentFrame();
  const line = CAPTIONS_S2.find((c) => frame >= at2(c.abs) && frame <= at2(c.end));
  if (!line) return null;
  const start = at2(line.abs);
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

export const ExplainerS2: React.FC = () => {
  const frame = useCurrentFrame();

  const idx = Math.max(0, S2_SCENES.findIndex((s, i) =>
    frame >= at2(s.fromAbs) && (i === S2_SCENES.length - 1 || frame < at2(S2_SCENES[i + 1].fromAbs))));
  const scene = S2_SCENES[idx];
  const t = (frame - at2(scene.fromAbs)) / FPS_S2;
  const dur = scene.toAbs - scene.fromAbs;

  // Scenes stagger their own content in, so only the tail is cross-faded.
  const out = interpolate(t, [dur - 0.3, dur], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const Scene = SCENE[scene.id];

  return (
    <AbsoluteFill style={{ background: T.bg, width: STAGE.w, height: STAGE.h, fontFamily: T.font }}>
      {/* --props='{"muteNarration":true}' renders the effects alone, for laying
          under the original footage in an editor. */}
      {(getInputProps() as { muteNarration?: boolean }).muteNarration ? null : (
        <Audio src={staticFile('narration_s2.wav')} />
      )}
      {resolveCues(CUES_S2, S2_SCENES, S2_START_ABS, FPS_S2).map((c, i) => (
        <Sequence key={i} from={c.frame} durationInFrames={FPS_S2 * 3} layout="none">
          <Audio src={staticFile(`sfx_soft/${c.file}`)} volume={c.volume} />
        </Sequence>
      ))}

      <div style={{ position: 'absolute', inset: 0, opacity: out, transform: `translateY(${(1 - out) * -14}px)` }}>
        {Scene ? <Scene t={t} /> : null}
      </div>

      <Header />
      <Caption2 />
    </AbsoluteFill>
  );
};
