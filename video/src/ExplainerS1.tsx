import React from 'react';
import { AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame, interpolate, getInputProps } from 'remotion';
import { S1_SCENES, CAPTIONS_S1, CUES_S1, S1_START_ABS, at1, FPS_S1 } from './s1Timeline';
import { resolveCues } from './cues';
import { T, STAGE } from './theme';
import {
  D, S1Open, S1Clause, S1Audit, S1Certified, S1Placed, S1Ten, S1Green, S1Turn, S1Match, S1Team,
} from './scenes/S1Scenes';

const SCENE: Record<string, React.FC<{ t: number }> | undefined> = {
  open: S1Open, clause: S1Clause, audit: S1Audit, certified: S1Certified, placed: S1Placed,
  ten: S1Ten, green: S1Green, turn: S1Turn, match: S1Match, team: S1Team,
};

const Header: React.FC = () => (
  <div style={{ position: 'absolute', left: 76, top: 30 }}>
    <div style={{ font: `800 27px/1 ${T.font}`, color: D.text, letterSpacing: -0.2 }}>
      PM-AJAY Livelihood · <span style={{ color: D.amber }}>The problem</span>
    </div>
    <div style={{ font: `600 18px/1 ${T.font}`, color: D.muted, marginTop: 8, letterSpacing: 1 }}>
      Rubix Cube · SIH 26097
    </div>
  </div>
);

/** Running clock against the source cut, so any beat can be checked against the tape. */
const Stamp: React.FC = () => {
  const frame = useCurrentFrame();
  const abs = S1_START_ABS + frame / FPS_S1;
  const s = abs.toFixed(1).padStart(4, '0');
  return (
    <div style={{
      position: 'absolute', right: 40, top: 32, font: `600 20px/1 ${T.font}`,
      color: D.muted, letterSpacing: 1.4, opacity: 0.7,
    }}>
      SPEAKER 1 · 0:{s}
    </div>
  );
};

const Caption1: React.FC = () => {
  const frame = useCurrentFrame();
  const line = CAPTIONS_S1.find((c) => frame >= at1(c.abs) && frame <= at1(c.end));
  if (!line) return null;
  const start = at1(line.abs);
  const o = interpolate(frame - start, [0, 5], [0, 1], { extrapolateRight: 'clamp' });
  const lift = interpolate(frame - start, [0, 8], [10, 0], { extrapolateRight: 'clamp' });
  return (
    <div style={{
      position: 'absolute', left: 0, right: 0, bottom: 34,
      display: 'flex', justifyContent: 'center', opacity: o, transform: `translateY(${lift}px)`,
    }}>
      <div style={{
        maxWidth: 1500, padding: '16px 34px', borderRadius: 16,
        background: 'rgba(15,23,42,0.92)', color: '#fff',
        font: `500 30px/1.32 ${T.font}`, textAlign: 'center', boxShadow: T.shadow,
      }}>{line.text}</div>
    </div>
  );
};

export const ExplainerS1: React.FC = () => {
  const frame = useCurrentFrame();

  const idx = Math.max(0, S1_SCENES.findIndex((s, i) =>
    frame >= at1(s.fromAbs) && (i === S1_SCENES.length - 1 || frame < at1(S1_SCENES[i + 1].fromAbs))));
  const scene = S1_SCENES[idx];
  const t = (frame - at1(scene.fromAbs)) / FPS_S1;
  const dur = scene.toAbs - scene.fromAbs;

  const out = interpolate(t, [dur - 0.2, dur], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const Scene = SCENE[scene.id];

  return (
    <AbsoluteFill style={{ background: D.bg, width: STAGE.w, height: STAGE.h, fontFamily: T.font }}>
      {/* a very faint field so the paper is not flat */}
      <AbsoluteFill style={{
        background: 'radial-gradient(1300px 780px at 22% 16%, rgba(255,255,255,0.85), rgba(238,242,240,0) 72%)',
      }} />

      {(getInputProps() as { muteNarration?: boolean }).muteNarration ? null : (
        <Audio src={staticFile('narration_s1.wav')} />
      )}
      {resolveCues(CUES_S1, S1_SCENES, S1_START_ABS, FPS_S1).map((c, i) => (
        <Sequence key={i} from={c.frame} durationInFrames={FPS_S1 * 3} layout="none">
          <Audio src={staticFile(`sfx_soft/${c.file}`)} volume={c.volume} />
        </Sequence>
      ))}

      <div style={{ position: 'absolute', inset: 0, opacity: out, transform: `translateY(${(1 - out) * -10}px)` }}>
        {Scene ? <Scene t={t} /> : null}
      </div>

      <Header />
      <Stamp />
      <Caption1 />
    </AbsoluteFill>
  );
};
