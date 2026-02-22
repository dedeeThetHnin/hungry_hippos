/**
 * Pure drawing function for the falling-notes canvas.
 *
 * Shared between the live animation loop in FallingNotesTab and the
 * offline video-export renderer so both produce identical frames.
 */

import {
  isBlackKey,
  keyPosition,
  midiToNoteName,
  noteColor,
  ACTIVE_KEY_COLOR,
  WHITE_KEY_COLOR,
  BLACK_KEY_COLOR,
  KEY_BORDER_COLOR,
  CANVAS_BG,
  HIT_LINE_COLOR,
} from "./canvas-utils";

import type { NoteEvent } from "@/lib/hooks/useMidiPlayer";

// ── Constants ─────────────────────────────────────────────────────────
export const LOOK_AHEAD = 4; // seconds visible above hit-line
export const KEYBOARD_HEIGHT_RATIO = 0.15;
export const BLACK_KEY_HEIGHT_RATIO = 0.6;
export const MIN_BAR_PX = 6;

export interface DrawFrameLayout {
  lo: number;
  hi: number;
  whiteCount: number;
}

export interface DrawFrameParams {
  notes: NoteEvent[];
  layout: DrawFrameLayout;
  bassTrack: number;
  duration: number;
  formatTime: (s: number) => string;
}

/**
 * Draw a single falling-notes frame onto the given 2D context.
 *
 * @param ctx        – A `CanvasRenderingContext2D` (may be from OffscreenCanvas)
 * @param W          – Logical width  in CSS pixels
 * @param H          – Logical height in CSS pixels
 * @param currentTime – Virtual (original MIDI) time in seconds
 * @param params      – Notes, layout, bass-track index, duration, formatTime
 */
export function drawFallingNotesFrame(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  W: number,
  H: number,
  currentTime: number,
  params: DrawFrameParams,
) {
  const { notes, layout, bassTrack, duration, formatTime } = params;
  const { lo, hi, whiteCount } = layout;

  const kbHeight = H * KEYBOARD_HEIGHT_RATIO;
  const playAreaHeight = H - kbHeight;
  const hitY = playAreaHeight;

  // Clear
  ctx.fillStyle = CANVAS_BG;
  ctx.fillRect(0, 0, W, H);

  const whiteKeyWidth = W / whiteCount;
  const pxPerSec = playAreaHeight / LOOK_AHEAD;

  // ── Falling note bars ──────────────────────────────────────────
  const activeKeys = new Set<number>();

  for (const note of notes) {
    const noteEnd = note.time + note.duration;

    const yBottom = hitY - (note.time - currentTime) * pxPerSec;
    const yTop = hitY - (noteEnd - currentTime) * pxPerSec;

    // Cull notes fully off screen
    if (yBottom < 0 || yTop > H) continue;

    const barHeight = Math.max(MIN_BAR_PX, yBottom - yTop);

    if (currentTime >= note.time && currentTime < noteEnd) {
      activeKeys.add(note.midi);
    }

    const pos = keyPosition(note.midi, lo, hi, whiteCount, W);
    const barX = pos.x + 1;
    const barW = pos.w - 2;
    const radius = Math.min(4, barW / 2, barHeight / 2);

    const isBass = bassTrack >= 0 ? note.track === bassTrack : note.midi < 60;

    ctx.fillStyle = noteColor(isBass, 0.85);
    ctx.beginPath();
    ctx.roundRect(barX, yTop, barW, barHeight, radius);
    ctx.fill();

    // Glow for currently-playing notes
    if (activeKeys.has(note.midi)) {
      ctx.shadowColor = ACTIVE_KEY_COLOR;
      ctx.shadowBlur = 12;
      ctx.fillStyle = noteColor(isBass, 1);
      ctx.beginPath();
      ctx.roundRect(barX, yTop, barW, barHeight, radius);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Label
    if (barHeight > 14 && barW > 18) {
      const label = midiToNoteName(note.midi);
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.font = `bold ${Math.min(11, barW * 0.45)}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, pos.centre, yTop + barHeight / 2, barW - 4);
    }
  }

  // ── Hit line ───────────────────────────────────────────────────
  ctx.fillStyle = HIT_LINE_COLOR;
  ctx.fillRect(0, hitY - 1, W, 2);

  // ── Piano keyboard ─────────────────────────────────────────────
  let wi = 0;
  for (let m = lo; m <= hi; m++) {
    if (isBlackKey(m)) continue;
    const x = wi * whiteKeyWidth;
    const active = activeKeys.has(m);

    ctx.fillStyle = active ? ACTIVE_KEY_COLOR : WHITE_KEY_COLOR;
    ctx.fillRect(x, hitY, whiteKeyWidth, kbHeight);

    ctx.strokeStyle = KEY_BORDER_COLOR;
    ctx.lineWidth = 1;
    ctx.strokeRect(x, hitY, whiteKeyWidth, kbHeight);

    if (whiteKeyWidth > 14) {
      const label = midiToNoteName(m);
      ctx.fillStyle = active ? "rgba(255,255,255,0.9)" : "rgba(100,100,120,0.5)";
      ctx.font = `${Math.min(10, whiteKeyWidth * 0.35)}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText(label, x + whiteKeyWidth / 2, hitY + kbHeight - 4, whiteKeyWidth - 2);
    }
    wi++;
  }

  // Black keys on top
  for (let m = lo; m <= hi; m++) {
    if (!isBlackKey(m)) continue;
    const pos = keyPosition(m, lo, hi, whiteCount, W);
    const bkHeight = kbHeight * BLACK_KEY_HEIGHT_RATIO;
    const active = activeKeys.has(m);

    ctx.fillStyle = active ? ACTIVE_KEY_COLOR : BLACK_KEY_COLOR;
    ctx.beginPath();
    ctx.roundRect(pos.x, hitY, pos.w, bkHeight, [0, 0, 3, 3]);
    ctx.fill();

    if (pos.w > 14) {
      const label = midiToNoteName(m);
      ctx.fillStyle = active ? "rgba(255,255,255,0.95)" : "rgba(200,200,220,0.6)";
      ctx.font = `${Math.min(9, pos.w * 0.38)}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText(label, pos.centre, hitY + bkHeight - 3, pos.w - 2);
    }
  }

  // ── Time overlay ───────────────────────────────────────────────
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.font = "12px system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(`${formatTime(currentTime)} / ${formatTime(duration)}`, 8, 8);
}
