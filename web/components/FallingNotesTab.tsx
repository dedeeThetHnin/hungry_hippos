"use client";

import { useEffect, useRef, useCallback, useMemo, useState } from "react";
import { Play, Pause, Square, RotateCcw, RotateCw, Download, X } from "lucide-react";
import * as Tone from "tone";
import type { Midi } from "@tonejs/midi";
import type {
  MidiPlayerState,
  MidiPlayerControls,
  NoteEvent,
} from "@/lib/hooks/useMidiPlayer";
import type { PianoPlayerFactory } from "@/lib/piano";
import { splendidPiano } from "@/lib/piano";
import {
  isBlackKey,
  buildKeyLayout,
} from "@/lib/piano/canvas-utils";
import { drawFallingNotesFrame } from "@/lib/piano/draw-frame";
import { useVideoExport } from "@/lib/hooks/useVideoExport";

// ── Component ─────────────────────────────────────────────────────────

interface FallingNotesTabProps {
  state: MidiPlayerState;
  controls: MidiPlayerControls;
  isFullscreen?: boolean;
  pianoSwitcher?: React.ReactNode;
  playbackSpeed?: number;
  /** Required for video export – ref to the parsed Midi object */
  midiRef?: React.RefObject<Midi | null>;
  /** Required for video export – factory to create piano for offline audio rendering */
  pianoFactory?: PianoPlayerFactory;
}

const LARGE_FILE_THRESHOLD_SECS = 120; // 2 minutes

export function FallingNotesTab({ state, controls, isFullscreen = false, pianoSwitcher, playbackSpeed = 1, midiRef, pianoFactory = splendidPiano }: FallingNotesTabProps) {
  const { isPlaying, loadState, duration, progress } = state;
  const { togglePlayback, stopPlayback, seekTo, skip, formatTime, getAllNotes } = controls;
  const progressBarRef = useRef<HTMLDivElement | null>(null);
  const [isScrubbing, setIsScrubbing] = useState(false);

  const isLargeFile = duration > LARGE_FILE_THRESHOLD_SECS;

  // Video export
  const { exportVideo, exportProgress, isExporting, exportError, cancelExport } = useVideoExport();

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number>(0);
  const notesCache = useRef<NoteEvent[]>([]);

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

    minMidi = Math.max(21, minMidi - 2);
    maxMidi = Math.min(108, maxMidi + 2);

    while (isBlackKey(minMidi)) minMidi--;
    while (isBlackKey(maxMidi)) maxMidi++;

    const kb = buildKeyLayout(minMidi, maxMidi);
    return { ...kb, minMidi, maxMidi };
  }, [getAllNotes]);

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

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !layout) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const W = canvas.width / dpr;
    const H = canvas.height / dpr;

    const currentTime = Tone.getTransport().seconds * playbackSpeed;

    drawFallingNotesFrame(ctx, W, H, currentTime, {
      notes: notesCache.current,
      layout,
      bassTrack,
      duration,
      formatTime,
    });
  }, [layout, bassTrack, duration, formatTime, playbackSpeed]);

  const handleExportVideo = useCallback(() => {
    if (!layout || isExporting) return;
    stopPlayback();

    exportVideo({
      notes: notesCache.current,
      layout,
      bassTrack,
      duration,
      playbackSpeed,
      formatTime,
      midiRef: midiRef!,
      pianoFactory,
      title: state.title,
      bpm: state.bpm,
    });
  }, [layout, bassTrack, duration, playbackSpeed, formatTime, midiRef, pianoFactory, isExporting, exportVideo, stopPlayback, state.title, state.bpm]);

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
        <canvas ref={canvasRef} className="block w-full h-full" />

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

      {/* Controls */}
      <div className="flex items-center justify-center gap-3 shrink-0 flex-wrap">
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

        {/* Progress bar */}
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
              style={{ width: `${duration > 0 ? (progress / duration) * 100 : 0}%` }}
            />
          </div>
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white border-2 border-pink-400 rounded-full shadow opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
            style={{ left: `calc(${duration > 0 ? (progress / duration) * 100 : 0}% - 6px)` }}
          />
        </div>
        <span className="text-xs text-slate-400 tabular-nums min-w-[4rem] text-right">
          {formatTime(progress)} / {formatTime(duration)}
        </span>

        {/* Export Video button */}
        {midiRef && (
          <div className="flex flex-col items-end gap-1 ml-2">
            {isExporting ? (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 rounded-full bg-pink-50 border border-pink-200 px-3 py-1.5 text-xs text-pink-600 min-w-[7rem]">
                  <Download className="w-3.5 h-3.5 animate-pulse" />
                  <span>Exporting {exportProgress ?? 0}%</span>
                </div>
                <button
                  onClick={cancelExport}
                  className="flex items-center justify-center w-7 h-7 rounded-full bg-white border border-pink-200 text-pink-400 hover:bg-pink-50 transition-colors"
                  aria-label="Cancel export"
                  title="Cancel export"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <div className="relative group">
                <button
                  onClick={handleExportVideo}
                  className="flex items-center gap-1.5 rounded-full bg-white border border-pink-200 text-pink-400 hover:bg-pink-50 hover:text-pink-600 transition-colors px-3 py-1.5 text-xs"
                  aria-label="Export video"
                  title={isLargeFile ? undefined : "Export falling notes as video"}
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Export Video</span>
                </button>
                {isLargeFile && (
                  <div className="absolute bottom-full right-0 mb-2 hidden group-hover:block z-50">
                    <div className="rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-xs px-3 py-2 whitespace-nowrap shadow-md">
                      ⚠ This piece is long — export may take several minutes.
                    </div>
                  </div>
                )}
              </div>
            )}
            {exportError && (
              <span className="text-xs text-red-500 text-right" title={exportError}>Export failed</span>
            )}
          </div>
        )}

        {pianoSwitcher && <div className="ml-1">{pianoSwitcher}</div>}
      </div>
    </div>
  );
}
