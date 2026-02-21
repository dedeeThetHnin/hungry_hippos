/**
 * soundfont-player — General MIDI SoundFont adapter.
 *
 * Loads the "acoustic_grand_piano" preset from the gleitz CDN
 * (MusyngKite SoundFont). Lighter weight with decent quality,
 * good for quick A/B comparison against the other engines.
 *
 * @see https://github.com/danigb/soundfont-player
 */

import Soundfont, { type Player, type PlayingNode } from "soundfont-player";
import type { PianoPlayer, PianoPlayerFactory } from "./types";

function createSoundfontPiano(audioContext: AudioContext): PianoPlayer {
  let disposed = false;
  let instrument: Player | null = null;
  const activeNodes: PlayingNode[] = [];

  const loadedPromise: Promise<void> = Soundfont.instrument(
    audioContext,
    "acoustic_grand_piano",
  ).then((inst) => {
    instrument = inst;
  });

  return {
    loaded: loadedPromise,

    start({ note, duration, time, velocity }) {
      if (disposed || !instrument) return;
      const node = instrument.play(note, time, {
        duration,
        gain: velocity * 5, // soundfont-player gain maps 0–1 (also give it a 5x boost to match the volume of the other pianos)
      });
      if (node) activeNodes.push(node);
    },

    stop() {
      if (disposed) return;
      activeNodes.forEach((n) => {
        try {
          n.stop();
        } catch {
          /* already stopped */
        }
      });
      activeNodes.length = 0;
      instrument?.stop();
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      activeNodes.forEach((n) => {
        try {
          n.stop();
        } catch {
          /* already stopped */
        }
      });
      activeNodes.length = 0;
      instrument?.stop();
      instrument = null;
    },
  };
}

export const soundfontPiano: PianoPlayerFactory = createSoundfontPiano;
