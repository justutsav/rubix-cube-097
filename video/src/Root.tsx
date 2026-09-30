import React from 'react';
import { Composition } from 'remotion';
import { Explainer } from './Explainer';
import { ExplainerSlide } from './ExplainerSlide';
import { ExplainerS1 } from './ExplainerS1';
import { ExplainerS2 } from './ExplainerS2';
import { ExplainerS4 } from './ExplainerS4';
import { ExplainerS5 } from './ExplainerS5';
import { DURATION_FRAMES, FPS } from './timeline';
import { S1_FRAMES, FPS_S1 } from './s1Timeline';
import { S2_FRAMES, FPS_S2 } from './s2Timeline';
import { S4_FRAMES, FPS_S4 } from './s4Timeline';
import { S5_FRAMES, FPS_S5 } from './s5Timeline';
import { STAGE } from './theme';

export const RemotionRoot: React.FC = () => (
  <>
    {/* the original cut: zoom out to the whole chart between beats */}
    <Composition
      id="Explainer"
      component={Explainer}
      durationInFrames={DURATION_FRAMES}
      fps={FPS}
      width={STAGE.w}
      height={STAGE.h}
    />
    {/* the sliding cut: one zoom in, then pan across the chart, pull back at the end */}
    <Composition
      id="ExplainerSlide"
      component={ExplainerSlide}
      durationInFrames={DURATION_FRAMES}
      fps={FPS}
      width={STAGE.w}
      height={STAGE.h}
    />
    {/* the opening section: the problem, proved out of the primary sources */}
    <Composition
      id="ExplainerS1"
      component={ExplainerS1}
      durationInFrames={S1_FRAMES}
      fps={FPS_S1}
      width={STAGE.w}
      height={STAGE.h}
    />
    {/* the earlier section: services and what the engine does — no flowchart */}
    <Composition
      id="ExplainerS2"
      component={ExplainerS2}
      durationInFrames={S2_FRAMES}
      fps={FPS_S2}
      width={STAGE.w}
      height={STAGE.h}
    />
    {/* the government half: district and state consoles, the calendar, the follow-up */}
    <Composition
      id="ExplainerS4"
      component={ExplainerS4}
      durationInFrames={S4_FRAMES}
      fps={FPS_S4}
      width={STAGE.w}
      height={STAGE.h}
    />
    {/* the evidence: the primary sources, the dialect admission, the published error rate */}
    <Composition
      id="ExplainerS5"
      component={ExplainerS5}
      durationInFrames={S5_FRAMES}
      fps={FPS_S5}
      width={STAGE.w}
      height={STAGE.h}
    />
  </>
);
