import React from 'react';
import { AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame, interpolate, getInputProps } from 'remotion';
import { S4_SCENES, CAPTIONS_S4, CUES_S4, S4_START_ABS, at4, FPS_S4 } from './s4Timeline';
import { resolveCues } from './cues';
import { T, STAGE } from './theme';
import {
  S4Problem, S4Collect, S4Demand, S4District, S4State, S4Timeline, S4Outcome, S4Built,
} from './scenes/S4Scenes';

const SCENE: Record<string, React.FC<{ t: number }> | undefined> = {
  problem: S4Problem, collect: S4Collect, demand: S4Demand, district: S4District,
  state: S4State, timeline: S4Timeline, outcome: S4Outcome, built: S4Built,
};

const Header: React.FC = () => (
  <div style={{ position: 'absolute', left: 56, top: 28 }}>
    <div style={{ font: `800 27px/1 ${T.font}`, color: T.ink, letterSpacing: -0.2 }}>
      PM-AJAY Livelihood · <span style={{ color: T.green }}>The government half</span>
    </div>
    <div style={{ font: `600 18px/1 ${T.font}`, color: T.inkSoft, marginTop: 8, letterSpacing: 1 }}>
      Rubix Cube · SIH 26097
    </div>
  </div>
);

const Caption4: React.FC = () => {
  const frame = useCurrentFrame();
  const line = CAPTIONS_S4.find((c) => frame >= at4(c.abs) && frame <= at4(c.end));
  if (!line) return null;
  const start = at4(line.abs);
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

export const ExplainerS4: React.FC = () => {
  const frame = useCurrentFrame();

  const idx = Math.max(0, S4_SCENES.findIndex((s, i) =>
    frame >= at4(s.fromAbs) && (i === S4_SCENES.length - 1 || frame < at4(S4_SCENES[i + 1].fromAbs))));
  const scene = S4_SCENES[idx];
  const t = (frame - at4(scene.fromAbs)) / FPS_S4;
  const dur = scene.toAbs - scene.fromAbs;

  const out = interpolate(t, [dur - 0.3, dur], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const Scene = SCENE[scene.id];

  return (
    <AbsoluteFill style={{ background: T.bg, width: STAGE.w, height: STAGE.h, fontFamily: T.font }}>
      {/* --props='{"muteNarration":true}' renders the effects alone. */}
      {(getInputProps() as { muteNarration?: boolean }).muteNarration ? null : (
        <Audio src={staticFile('narration_s4.wav')} />
      )}
      {resolveCues(CUES_S4, S4_SCENES, S4_START_ABS, FPS_S4).map((c, i) => (
        <Sequence key={i} from={c.frame} durationInFrames={FPS_S4 * 3} layout="none">
          <Audio src={staticFile(`sfx_soft/${c.file}`)} volume={c.volume} />
        </Sequence>
      ))}

      <div style={{ position: 'absolute', inset: 0, opacity: out, transform: `translateY(${(1 - out) * -14}px)` }}>
        {Scene ? <Scene t={t} /> : null}
      </div>

      <Header />
      <Caption4 />
    </AbsoluteFill>
  );
};
