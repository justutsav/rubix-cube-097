import { cueFrame } from './sfxPeaks';

/**
 * A cue is anchored to a scene and a time *inside* that scene, which is how the
 * animations are written — so a cue cannot drift out of sync with the thing it is
 * meant to punctuate. The old list used absolute timestamps guessed off the
 * narration, which is why sounds landed where nothing was moving.
 */
export type SceneCue = { scene: string; rel: number; file: string; volume?: number };

export type SceneSpan = { id: string; fromAbs: number };

/** Resolve scene-relative cues to placement frames, compensating each file's attack. */
export const resolveCues = (
  cues: SceneCue[],
  scenes: SceneSpan[],
  startAbs: number,
  fps: number,
): { frame: number; file: string; volume: number }[] =>
  cues.flatMap((c) => {
    const scene = scenes.find((s) => s.id === c.scene);
    if (!scene) return [];
    const rel = scene.fromAbs - startAbs + c.rel;
    return [{ frame: Math.max(0, cueFrame(rel, c.file, fps)), file: c.file, volume: c.volume ?? 0.42 }];
  });
