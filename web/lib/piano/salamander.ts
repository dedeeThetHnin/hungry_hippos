/**
 * Salamander Grand Piano — Tone.js Sampler adapter.
 *
 * Loads individual .mp3 samples from the Tone.js CDN and interpolates
 * between ~30 sampled pitches to cover the full 88-key range.
 *
 * Lighter download (~3 MB) but fewer velocity layers than a full SoundFont.
 */

import * as Tone from "tone";
import type { PianoPlayer, PianoPlayerFactory } from "./types";

function createSalamanderPiano(audioContext: AudioContext): PianoPlayer {
  let disposed = false;

  // Tone.js needs to use the same context for scheduling to work.
  // When the hook calls `Tone.start()` / `Tone.getContext()`, Tone
  // already owns a context — and the Sampler is wired to the same
  // destination via `.toDestination()`.
  const { promise: loadedPromise, resolve, reject } = promiseWithResolvers();

  const sampler = new Tone.Sampler({
    urls: {
      A0: "A0.mp3",
      C1: "C1.mp3",
      "D#1": "Ds1.mp3",
      "F#1": "Fs1.mp3",
      A1: "A1.mp3",
      C2: "C2.mp3",
      "D#2": "Ds2.mp3",
      "F#2": "Fs2.mp3",
      A2: "A2.mp3",
      C3: "C3.mp3",
      "D#3": "Ds3.mp3",
      "F#3": "Fs3.mp3",
      A3: "A3.mp3",
      C4: "C4.mp3",
      "D#4": "Ds4.mp3",
      "F#4": "Fs4.mp3",
      A4: "A4.mp3",
      C5: "C5.mp3",
      "D#5": "Ds5.mp3",
      "F#5": "Fs5.mp3",
      A5: "A5.mp3",
      C6: "C6.mp3",
      "D#6": "Ds6.mp3",
      "F#6": "Fs6.mp3",
      A6: "A6.mp3",
      C7: "C7.mp3",
      "D#7": "Ds7.mp3",
      "F#7": "Fs7.mp3",
      A7: "A7.mp3",
      C8: "C8.mp3",
    },
    release: 1,
    baseUrl: "https://tonejs.github.io/audio/salamander/",
    onload: () => resolve(),
    onerror: () => reject(new Error("Failed to load Salamander piano samples.")),
  }).toDestination();

  return {
    loaded: loadedPromise,

    start({ note, duration, time, velocity }) {
      if (disposed || !sampler.loaded) return;
      // Tone.Sampler expects velocity in 0–1 range (same as MIDI parser output)
      sampler.triggerAttackRelease(note, duration, time, velocity);
    },

    stop() {
      if (disposed) return;
      sampler.releaseAll();
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      sampler.releaseAll();
      sampler.dispose();
    },
  };
}

/** Tiny polyfill — Promise.withResolvers() isn't available everywhere yet. */
function promiseWithResolvers() {
  let resolve!: () => void;
  let reject!: (err: Error) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

export const salamanderPiano: PianoPlayerFactory = createSalamanderPiano;
