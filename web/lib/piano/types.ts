/**
 * Common interface for piano player implementations.
 *
 * Each adapter wraps a concrete audio library (Tone.Sampler, smplr, etc.)
 * and exposes a uniform API so that useMidiPlayer can swap implementations
 * without changing its scheduling logic.
 */

export interface NoteStartOptions {
  /** Note name, e.g. "C4", "F#5" */
  note: string;
  /** Duration in seconds */
  duration: number;
  /** Audio-context time at which to start the note (from Tone.Part callback) */
  time?: number;
  /** Velocity normalised to 0 – 1 (matching @tonejs/midi output) */
  velocity: number;
}

export interface PianoPlayer {
  /** Resolves when all samples / SoundFonts are loaded and ready to play. */
  readonly loaded: Promise<void>;

  /** Schedule (or immediately play) a single note. */
  start(opts: NoteStartOptions): void;

  /** Silence all currently ringing notes immediately. */
  stop(): void;

  /** Release all resources. The instance must not be used after this call. */
  dispose(): void;
}

/**
 * A factory that creates a PianoPlayer given a Web Audio AudioContext.
 * Pass one of these to useMidiPlayer to choose the sound engine.
 */
export type PianoPlayerFactory = (audioContext: AudioContext) => PianoPlayer;
