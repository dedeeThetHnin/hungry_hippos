// ── Shared piano canvas drawing utilities ─────────────────────────────
// Used by FallingNotesTab and PracticeTab for consistent keyboard rendering.

/** Which pitch classes are black keys (0 = C) */
export const BLACK_PITCH_CLASSES = new Set([1, 3, 6, 8, 10]); // C#, D#, F#, G#, A#

export function isBlackKey(midiNumber: number): boolean {
  return BLACK_PITCH_CLASSES.has(midiNumber % 12);
}

/**
 * Returns the count of white keys in the midi range [rangeMin, rangeMax].
 */
export function buildKeyLayout(rangeMin: number, rangeMax: number) {
  const lo = rangeMin;
  const hi = rangeMax;
  let whiteCount = 0;
  for (let m = lo; m <= hi; m++) {
    if (!isBlackKey(m)) whiteCount++;
  }
  return { lo, hi, whiteCount };
}

/**
 * Given a midi number and the keyboard layout, return the x-position,
 * width and centre of that key relative to the keyboard.
 */
export function keyPosition(
  midi: number,
  lo: number,
  hi: number,
  whiteCount: number,
  keyboardWidth: number,
) {
  const whiteKeyWidth = keyboardWidth / whiteCount;
  const blackKeyWidth = whiteKeyWidth * 0.6;

  let whiteIndex = 0;
  for (let m = lo; m < midi; m++) {
    if (!isBlackKey(m)) whiteIndex++;
  }

  if (!isBlackKey(midi)) {
    const x = whiteIndex * whiteKeyWidth;
    return { x, w: whiteKeyWidth, centre: x + whiteKeyWidth / 2 };
  } else {
    const x = whiteIndex * whiteKeyWidth - blackKeyWidth / 2;
    return { x, w: blackKeyWidth, centre: x + blackKeyWidth / 2 };
  }
}

// ── Note name helper ──────────────────────────────────────────────────

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export function midiToNoteName(midi: number): string {
  const octave = Math.floor(midi / 12) - 1;
  const note = NOTE_NAMES[midi % 12];
  return `${note}${octave}`;
}

// ── Colour helpers ────────────────────────────────────────────────────

/** Two-tone colouring: darker for bass track, lighter for treble track. */
export const BASS_COLOR = (alpha: number) => `hsla(340, 80%, 65%, ${alpha})`;
export const TREBLE_COLOR = (alpha: number) => `hsla(345, 85%, 80%, ${alpha})`;

export function noteColor(isBass: boolean, alpha = 1): string {
  return isBass ? BASS_COLOR(alpha) : TREBLE_COLOR(alpha);
}

export const ACTIVE_KEY_COLOR = "#FF7EB6";
export const WHITE_KEY_COLOR = "#FFFFFF";
export const BLACK_KEY_COLOR = "#2D3142";
export const KEY_BORDER_COLOR = "#CBD5E1";
export const CANVAS_BG = "#1a1028";
export const HIT_LINE_COLOR = "rgba(255,126,182,0.45)";

// Practice-mode specific colours
export const EXPECTED_KEY_COLOR = "#4ADE80"; // green glow for expected notes
export const WRONG_KEY_COLOR = "#EF4444"; // red flash for wrong notes
export const WAITING_OVERLAY_COLOR = "rgba(255,255,255,0.08)";
