"use client";

import { useEffect, useRef, useCallback, useMemo, useState } from "react";
import { Play, Pause, Square, RotateCcw, RotateCw } from "lucide-react";
import * as Tone from "tone";
import type {
  MidiPlayerState,
  MidiPlayerControls,
  NoteEvent,
} from "@/lib/hooks/useMidiPlayer";
import {
  isBlackKey,
  buildKeyLayout,
  keyPosition,
  midiToNoteName,
  noteColor,
  ACTIVE_KEY_COLOR,
  WHITE_KEY_COLOR,
  BLACK_KEY_COLOR,
  KEY_BORDER_COLOR,
  CANVAS_BG,
  HIT_LINE_COLOR,
} from "@/lib/piano/canvas-utils";

// ── Component ─────────────────────────────────────────────────────────

interface FallingNotesTabProps {
  state: MidiPlayerState;
  controls: MidiPlayerControls;
  isFullscreen?: boolean;
  pianoSwitcher?: React.ReactNode;
}

export function FallingNotesTab({ state, controls, isFullscreen = false, pianoSwitcher }: FallingNotesTabProps) {
  const { isPlaying, loadState, duration, progress } = state;
  const { togglePlayback, stopPlayback, seekTo, skip, formatTime, getAllNotes } = controls;
  const progressBarRef = useRef<HTMLDivElement | null>(null);
  const [isScrubbing, setIsScrubbing] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number>(0);
  const notesCache = useRef<NoteEvent[]>([]);

  // How many seconds of upcoming notes are visible above the hit line
  const LOOK_AHEAD = 4; // seconds visible above hit‑line
  const KEYBOARD_HEIGHT_RATIO = 0.15; // keyboard is 15% of canvas height
  const BLACK_KEY_HEIGHT_RATIO = 0.6; // black keys are 60% of white key height
  const MIN_BAR_PX = 6; // minimum height so tiny notes are still visible

  // Determine which track is the bass track by comparing average pitch per track.
  // In typical piano MIDI files, the bass (left hand) track has lower average pitch.
  const bassTrack = useMemo(() => {
    const notes = getAllNotes();
    if (notes.length === 0) return -1;

    const trackPitchSums = new Map<number, { sum: number; count: number }>();
    for (const n of notes) {
      const entry = trackPitchSums.get(n.track) ?? { sum: 0, count: 0 };
      entry.sum += n.midi;
      entry.count++;
      trackPitchSums.set(n.track, entry);
    }

    // If only one track, fall back to -1 (will use pitch threshold)
    if (trackPitchSums.size < 2) return -1;

    let lowestAvg = Infinity;
    let lowestTrack = -1;
    for (const [track, { sum, count }] of trackPitchSums) {
      const avg = sum / count;
      if (avg < lowestAvg) {
        lowestAvg = avg;
        lowestTrack = track;
      }
    }
    return lowestTrack;
  }, [getAllNotes]);

  // Precompute note data when available
  const layout = useMemo(() => {
    const notes = getAllNotes();
    notesCache.current = notes;
    if (notes.length === 0) return null;

    let minMidi = 127;
    let maxMidi = 0;
    for (const n of notes) {
      if (n.midi < minMidi) minMidi = n.midi;
      if (n.midi > maxMidi) maxMidi = n.midi;
    }

    // Pad by a few semitones so edge notes don't sit right at the boundary
    minMidi = Math.max(21, minMidi - 2);
    maxMidi = Math.min(108, maxMidi + 2);

    // Expand to nearest white key boundaries
    while (isBlackKey(minMidi)) minMidi--;
    while (isBlackKey(maxMidi)) maxMidi++;

    const kb = buildKeyLayout(minMidi, maxMidi);
    return { ...kb, minMidi, maxMidi };
  }, [getAllNotes]);

  // ── Scrubbing helpers ───────────────────────────────────────────────
  const seekFromPointer = useCallback(
    (clientX: number) => {
      const bar = progressBarRef.current;
      if (!bar || duration <= 0) return;
      const rect = bar.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      seekTo(ratio * duration);
    },
    [duration, seekTo]
  );

  const handleBarPointerDown = useCallback(
    (e: React.PointerEvent) => {
      setIsScrubbing(true);
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      seekFromPointer(e.clientX);
    },
    [seekFromPointer]
  );

  const handleBarPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isScrubbing) return;
      seekFromPointer(e.clientX);
    },
    [isScrubbing, seekFromPointer]
  );

  const handleBarPointerUp = useCallback(() => {
    setIsScrubbing(false);
  }, []);

  // ── Resize observer ─────────────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(container);
    resize();

    return () => observer.disconnect();
  }, []);

  // ── Render loop ─────────────────────────────────────────────────

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !layout) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const W = canvas.width / dpr;
    const H = canvas.height / dpr;

    const kbHeight = H * KEYBOARD_HEIGHT_RATIO;
    const playAreaHeight = H - kbHeight;
    const hitY = playAreaHeight; // y where notes "land" on the keyboard

    const currentTime = Tone.getTransport().seconds;

    // Clear
    ctx.fillStyle = CANVAS_BG;
    ctx.fillRect(0, 0, W, H);

    const { lo, hi, whiteCount } = layout;
    const whiteKeyWidth = W / whiteCount;

    // Pixels per second in the falling area
    const pxPerSec = playAreaHeight / LOOK_AHEAD;

    // ── Draw falling note bars ────────────────────────────────────
    const notes = notesCache.current;
    // Also collect which midi keys are currently active for keyboard highlighting
    const activeKeys = new Set<number>();

    for (const note of notes) {
      const noteEnd = note.time + note.duration;
      // Only draw notes that are within visible time window
      // A note is visible if its bottom edge is above the top of the canvas
      // and its top edge is below the hit line
      const barTopTime = note.time;
      const barBottomTime = noteEnd;

      // Convert time to Y: at currentTime, the hit-line is at hitY
      // Notes in the future are above (smaller Y), notes in the past are below (larger Y)
      const barTopY = hitY - (barTopTime - currentTime) * pxPerSec;
      const barBottomY = hitY - (barBottomTime - currentTime) * pxPerSec;

      // barBottomY is the top of the visual bar (earlier time = higher up)
      // barTopY is the bottom of the visual bar (later time, so note.time is the start)
      // Wait — let me reconsider: note.time is when the note starts, noteEnd is when it ends
      // Start (note.time) should appear at the bottom of the bar (hitting the keyboard)
      // End (noteEnd) should appear at the top of the bar
      // Y position: hitY when time == currentTime, and above for future times
      const yBottom = hitY - (note.time - currentTime) * pxPerSec;
      const yTop = hitY - (noteEnd - currentTime) * pxPerSec;

      // Cull notes fully off screen
      if (yBottom < 0 || yTop > H) continue;

      const barHeight = Math.max(MIN_BAR_PX, yBottom - yTop);

      // Check if note is currently playing (for key highlighting)
      if (currentTime >= note.time && currentTime < noteEnd) {
        activeKeys.add(note.midi);
      }

      // Get horizontal position from keyboard layout
      const pos = keyPosition(note.midi, lo, hi, whiteCount, W);

      // Draw the bar
      const barX = pos.x + 1; // 1px inset
      const barW = pos.w - 2; // 2px gap between adjacent bars
      const radius = Math.min(4, barW / 2, barHeight / 2);

      // Determine bass/treble: use track info if multi-track, else pitch threshold
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

      // Label — only if bar is tall enough to fit text
      if (barHeight > 14 && barW > 18) {
        const label = midiToNoteName(note.midi);
        ctx.fillStyle = "rgba(255,255,255,0.9)";
        ctx.font = `bold ${Math.min(11, barW * 0.45)}px system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(label, pos.centre, yTop + barHeight / 2, barW - 4);
      }
    }

    // ── Hit line ──────────────────────────────────────────────────
    ctx.fillStyle = HIT_LINE_COLOR;
    ctx.fillRect(0, hitY - 1, W, 2);

    // ── Draw piano keyboard ───────────────────────────────────────

    // White keys first
    let wi = 0;
    for (let m = lo; m <= hi; m++) {
      if (isBlackKey(m)) continue;
      const x = wi * whiteKeyWidth;
      const active = activeKeys.has(m);

      ctx.fillStyle = active ? ACTIVE_KEY_COLOR : WHITE_KEY_COLOR;
      ctx.fillRect(x, hitY, whiteKeyWidth, kbHeight);

      // Border
      ctx.strokeStyle = KEY_BORDER_COLOR;
      ctx.lineWidth = 1;
      ctx.strokeRect(x, hitY, whiteKeyWidth, kbHeight);

      // Label on white key
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

      // Label on black key
      if (pos.w > 14) {
        const label = midiToNoteName(m);
        ctx.fillStyle = active ? "rgba(255,255,255,0.95)" : "rgba(200,200,220,0.6)";
        ctx.font = `${Math.min(9, pos.w * 0.38)}px system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.fillText(label, pos.centre, hitY + bkHeight - 3, pos.w - 2);
      }
    }

    // ── Progress / time overlay ──────────────────────────────────
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(
      `${formatTime(currentTime)} / ${formatTime(duration)}`,
      8,
      8
    );
  }, [layout, bassTrack, duration, formatTime, LOOK_AHEAD, KEYBOARD_HEIGHT_RATIO, BLACK_KEY_HEIGHT_RATIO, MIN_BAR_PX]);

  // Animation frame loop — runs whenever the component is mounted
  useEffect(() => {
    let running = true;

    function tick() {
      if (!running) return;
      draw();
      rafRef.current = requestAnimationFrame(tick);
    }

    tick();
    return () => {
      running = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, [draw]);

  if (loadState !== "ready") return null;

  return (
    <div
      className={`${
        isFullscreen
          ? "absolute inset-0 flex flex-col gap-3 overflow-hidden"
          : "space-y-4"
      }`}
    >
      {/* Canvas container */}
      <div
        ref={containerRef}
        className={`relative w-full overflow-hidden ${
          isFullscreen
            ? "flex-1 min-h-0 rounded-lg border border-pink-200/20"
            : "rounded-2xl border border-pink-200/40"
        }`}
        style={isFullscreen ? undefined : { height: "min(60vh, 520px)" }}
      >
        <canvas
          ref={canvasRef}
          className="block w-full h-full"
        />

        {/* Play/pause overlay when paused & at start */}
        {!isPlaying && progress === 0 && (
          <button
            onClick={togglePlayback}
            className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/30 transition-colors group"
            aria-label="Play"
          >
            <div className="w-16 h-16 rounded-full bg-pink-400/90 group-hover:bg-pink-500 flex items-center justify-center shadow-xl transition-colors">
              <Play className="w-7 h-7 text-white ml-1" />
            </div>
          </button>
        )}
      </div>

      {/* Controls below canvas */}
      <div className="flex items-center justify-center gap-3 shrink-0">
        <button
          onClick={() => skip(-5)}
          className="flex items-center justify-center w-9 h-9 rounded-full bg-white border border-pink-200 text-pink-400 hover:bg-pink-50 transition-colors"
          aria-label="Rewind 5 seconds"
          title="Rewind 5s"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={togglePlayback}
          className="flex items-center justify-center w-12 h-12 rounded-full bg-pink-400 hover:bg-pink-500 text-white transition-colors shadow-lg hover:shadow-xl"
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? (
            <Pause className="w-5 h-5" />
          ) : (
            <Play className="w-5 h-5 ml-0.5" />
          )}
        </button>
        <button
          onClick={() => skip(5)}
          className="flex items-center justify-center w-9 h-9 rounded-full bg-white border border-pink-200 text-pink-400 hover:bg-pink-50 transition-colors"
          aria-label="Forward 5 seconds"
          title="Forward 5s"
        >
          <RotateCw className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={stopPlayback}
          className="flex items-center justify-center w-9 h-9 rounded-full bg-white border border-pink-200 text-pink-400 hover:bg-pink-50 transition-colors"
          aria-label="Stop"
        >
          <Square className="w-3.5 h-3.5" />
        </button>

        {/* Scrubbing mini progress bar */}
        <div
          ref={progressBarRef}
          className="flex-1 max-w-xs relative cursor-pointer group"
          onPointerDown={handleBarPointerDown}
          onPointerMove={handleBarPointerMove}
          onPointerUp={handleBarPointerUp}
          onPointerCancel={handleBarPointerUp}
        >
          <div className="w-full h-2 bg-pink-100 rounded-full overflow-hidden group-hover:h-2.5 transition-all">
            <div
              className="h-full bg-gradient-to-r from-pink-300 to-pink-400 rounded-full transition-[width] duration-75"
              style={{
                width: `${duration > 0 ? (progress / duration) * 100 : 0}%`,
              }}
            />
          </div>
          {/* Thumb */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white border-2 border-pink-400 rounded-full shadow opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
            style={{
              left: `calc(${duration > 0 ? (progress / duration) * 100 : 0}% - 6px)`,
            }}
          />
        </div>
        <span className="text-xs text-slate-400 tabular-nums min-w-[4rem] text-right">
          {formatTime(progress)} / {formatTime(duration)}
        </span>
        {pianoSwitcher && <div className="ml-1">{pianoSwitcher}</div>}
      </div>
    </div>
  );
}
