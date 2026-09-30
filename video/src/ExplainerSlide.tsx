import React from 'react';
import { AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame, interpolate, Easing, getInputProps } from 'remotion';
import { FOCUS, NARRATION_START_ABS, at, FPS, type Rect } from './timeline';
import { resolveCues } from './cues';
import { SLIDE_SCENES, SLIDE_CUES, SLIDE_FOCUS, SLIDE_DUR, OPEN_ZOOM, SLIDE_PANEL } from './slideTimeline';
import { T, STAGE } from './theme';
import { FlowchartRail } from './components/FlowchartRail';
import { PanelRect } from './components/Panel';
import { Caption, SourceStamp } from './components/Caption';
import {
  IntroPanel, VoicePanel, InterviewPanel, EnginePanel, NsqfPanel, PlanPanel, ChannelsPanel,
} from './scenes/Panels';
import { DoorsPanel } from './scenes/DoorsPanel';
import { CloseOverlay } from './scenes/Close';

const PANELS: Record<string, React.FC<{ t: number }> | undefined> = {
  intro: IntroPanel,
  doors: DoorsPanel,
  voice: VoicePanel,
  interview: InterviewPanel,
  engine: EnginePanel,
  nsqf: NsqfPanel,
  plan: PlanPanel,
  channels: ChannelsPanel,
};

const lerpRect = (a: Rect, b: Rect, k: number): Rect => ({
  x: a.x + (b.x - a.x) * k,
  y: a.y + (b.y - a.y) * k,
  w: a.w + (b.w - a.w) * k,
  h: a.h + (b.h - a.h) * k,
});

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

export const ExplainerSlide: React.FC = () => {
  const frame = useCurrentFrame();

  const idx = Math.max(0, SLIDE_SCENES.findIndex((s, i) =>
    frame >= at(s.fromAbs) && (i === SLIDE_SCENES.length - 1 || frame < at(SLIDE_SCENES[i + 1].fromAbs))));
  const scene = SLIDE_SCENES[idx];
  const next = SLIDE_SCENES[idx + 1];
  const t = (frame - at(scene.fromAbs)) / FPS;
  const dur = scene.toAbs - scene.fromAbs;
  const isClose = scene.id === 'close';

  const here = SLIDE_FOCUS[scene.focus];

  // Opening move: one zoom from the whole chart down onto the beneficiary. The only
  // zoom in the cut — everything after it is a slide.
  const opening = idx === 0;
  const openP = opening
    ? interpolate(t, [0.25, 0.25 + OPEN_ZOOM], [0, 1], {
        easing: Easing.out(Easing.cubic), extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
      })
    : 1;

  // Travel: the last SLIDE_DUR seconds of a beat are spent moving to the next stop.
  const slideStart = dur - SLIDE_DUR;
  const slideP = next
    ? interpolate(t, [slideStart, dur], [0, 1], {
        easing: Easing.inOut(Easing.cubic), extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
      })
    : 0;

  let view: Rect = here;
  if (opening && openP < 1) view = lerpRect(SLIDE_FOCUS.whole, here, openP);
  if (next && slideP > 0) view = lerpRect(here, SLIDE_FOCUS[next.focus], slideP);

  // Blur tracks how fast the camera is actually moving: nothing while parked,
  // most in the middle of a slide.
  const travel = Math.sin(Math.PI * slideP) * 5.5 + (opening ? Math.sin(Math.PI * openP) * 2.5 : 0);

  const highlightOpacity =
    interpolate(t, [openP < 1 ? OPEN_ZOOM * 0.8 : 0.1, (openP < 1 ? OPEN_ZOOM * 0.8 : 0.1) + 0.5], [0, 1], {
      extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
    }) * (1 - slideP);

  const chipOpacity = interpolate(
    t,
    [0.05, 0.5, Math.max(0.6, slideStart - 0.2), Math.max(0.75, slideStart)],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  const panelStart = opening ? 0.25 + OPEN_ZOOM * 0.85 : 0.08;
  const panelT = t - panelStart;
  const Panel = PANELS[scene.id];

  return (
    <AbsoluteFill style={{ background: T.bg, width: STAGE.w, height: STAGE.h, fontFamily: T.font }}>
      {(getInputProps() as {muteNarration?: boolean}).muteNarration ? null : (
        <Audio src={staticFile('narration.wav')} />
      )}
      {resolveCues(SLIDE_CUES, SLIDE_SCENES, NARRATION_START_ABS, FPS).map((c, i) => (
        <Sequence key={i} from={c.frame} durationInFrames={FPS * 3} layout="none">
          <Audio src={staticFile(`sfx_soft/${c.file}`)} volume={c.volume} />
        </Sequence>
      ))}

      <FlowchartRail
        view={view}
        blur={travel}
        highlight={scene.node ? FOCUS[scene.node] : null}
        highlightOpacity={highlightOpacity}
        chip={scene.chip}
        chipOpacity={isClose ? 0 : chipOpacity}
      />

      <PanelRect.Provider value={SLIDE_PANEL}>
        {!isClose && Panel && panelT > -0.05 ? (
          <div style={{ opacity: 1 - slideP, transform: `translateX(${slideP * 90}px)` }}>
            <Panel t={Math.max(0, panelT)} />
          </div>
        ) : null}
      </PanelRect.Provider>

      {isClose ? <CloseOverlay t={t} /> : null}

      <Header />
      <SourceStamp />
      <Caption />
    </AbsoluteFill>
  );
};
