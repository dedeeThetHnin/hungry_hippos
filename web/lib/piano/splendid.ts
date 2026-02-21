/**
 * Splendid Grand Piano — smplr SoundFont adapter.
 *
 * Loads a multi-velocity-layer SoundFont from the smplr built-in CDN,
 * producing a richer, more realistic piano tone than sparse samples.
 */

import { SplendidGrandPiano, Reverb } from "smplr";
import type { PianoPlayer, PianoPlayerFactory } from "./types";

function createSplendidPiano(audioContext: AudioContext): PianoPlayer {
  let disposed = false;
  const piano = new SplendidGrandPiano(audioContext);
//   piano.output.addEffect("reverb", new Reverb(audioContext), 0.2);

  return {
    loaded: piano.loaded().then(() => {}),

    start({ note, duration, time, velocity }) {
      if (disposed) return;
      // smplr expects velocity in 0–127 MIDI range; our interface uses 0–1.
      piano.start({
        note,
        time,
        duration,
        velocity: Math.round(velocity * 127),
      });
    },

    stop() {
      if (disposed) return;
      piano.stop();
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      piano.stop();
    },
  };
}

export const splendidPiano: PianoPlayerFactory = createSplendidPiano;
