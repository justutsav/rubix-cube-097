import React from 'react';
import { AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame, interpolate, Easing } from 'remotion';
import { SCENES, CUES, at, cueStart, FPS } from './timeline';
import { T, STAGE } from './theme';
import { FlowchartStage, ChartChip } from './components/FlowchartStage';
import { Caption, SourceStamp } from './components/Caption';
import {
  IntroPanel, VoicePanel, InterviewPanel, EnginePanel, NsqfPanel, PlanPanel, ChannelsPanel,
} from './scenes/Panels';
import { CloseOverlay } from './scenes/Close';

const PANELS: Record<string, React.FC<{ t: number }> | undefined> = {
  intro: IntroPanel,
  voice: VoicePanel,
  interview: InterviewPanel,
  engine: EnginePanel,
  nsqf: NsqfPanel,
  plan: PlanPanel,
  channels: ChannelsPanel,
};

const Header: React.FC = () => (
  <div style={{ position: 'absolute', left: 56, top: 28 }}>
    <div style={{ font: `800 27px/1 ${T.font}`, color: T.ink, letterSpacing: -0.2 }}>
      PM-AJAY Livelihood · <span style={{ color: T.green }}>How the solution works</span>
    </div>
    <div style={{ font: `600 18px/1 ${T.font}`, color: T.inkSoft, marginTop: 8, letterSpacing: 1 }}>
      Rubix Cube · SIH 26097 · walking the flowchart, step by step
    </div>
  </div>
);

export const Explainer: React.FC = () => {
  const frame = useCurrentFrame();

  const scene = [...SCENES].reverse().find((s) => frame >= at(s.fromAbs)) ?? SCENES[0];
  const startF = at(scene.fromAbs);
  const t = (frame - startF) / FPS;

  const isClose = scene.id === 'close';
  const dur = scene.toAbs - scene.fromAbs;

  // Cubic-out both ways: quick off the mark, settling gently. Linear reads as a shove.
  const CUBIC = { easing: Easing.out(Easing.cubic), extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

  // Slow, deliberate moves — but a 4s beat cannot afford a 1s zoom at each end,
  // so short beats get a proportionally shorter one and keep their panel time.
  const inDur = Math.min(1.05, dur * 0.18);
  const outDur = Math.min(1.15, dur * 0.2);

  // In: chart owns the frame, then pulls back to the rail.
  const zoomIn = interpolate(t, [scene.chartBeat, scene.chartBeat + inDur], [0, 1], CUBIC);
  // Out: before the beat ends the chart grows back to full frame, so the next
  // beat's zoom starts from the same wide shot instead of cutting to it.
  const zoomOut = isClose
    ? 0
    : interpolate(t, [dur - 0.12 - outDur, dur - 0.12], [0, 1], CUBIC);

  const rail = isClose ? 0 : zoomIn * (1 - zoomOut);

  // The chip's fade-in has to finish before the zoom starts, and chartBeat can be
  // as short as 0.35s — so scale it off chartBeat rather than hard-coding a range
  // that would invert (and interpolate() rejects a non-monotonic input range).
  const chipUp = Math.min(0.4, scene.chartBeat * 0.45);
  const chipOpacity = isClose
    ? 0
    : interpolate(
        t,
        [0.08, 0.08 + chipUp, scene.chartBeat + 0.1, scene.chartBeat + 0.45],
        [0, 1, 1, 0],
        { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
      );

  const Panel = PANELS[scene.id];
  const panelT = t - (scene.chartBeat + inDur * 0.92);

  return (
    <AbsoluteFill style={{ background: T.bg, width: STAGE.w, height: STAGE.h, fontFamily: T.font }}>
      {/* narration: speaker 3, lifted straight off the shot cut */}
      <Audio src={staticFile('narration.wav')} />
      {CUES.map((c, i) => (
        <Sequence key={i} from={Math.max(0, cueStart(c))} durationInFrames={FPS * 4} layout="none">
          <Audio src={staticFile(`sfx/${c.file}`)} volume={c.volume ?? 0.4} />
        </Sequence>
      ))}

      <FlowchartStage
        focus={scene.focus}
        rail={rail}
        highlight={interpolate(t, [0.2, 0.8], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) * (1 - zoomOut)}
      />
      <ChartChip text={scene.chip} opacity={chipOpacity} y={(1 - chipOpacity) * 12} />

      {!isClose && Panel && panelT > -0.05 && zoomOut < 0.98 ? (
        <div style={{ opacity: 1 - zoomOut, transform: `translateX(${zoomOut * 80}px)` }}>
          <Panel t={Math.max(0, panelT)} />
        </div>
      ) : null}
      {isClose ? <CloseOverlay t={t} /> : null}

      <Header />
      <SourceStamp />

      <Caption />
    </AbsoluteFill>
  );
};
