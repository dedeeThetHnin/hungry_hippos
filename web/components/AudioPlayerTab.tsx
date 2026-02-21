"use client";

import { useRef, useCallback, useState } from "react";
import { Play, Pause, Square, RotateCcw, RotateCw } from "lucide-react";
import type { MidiPlayerState, MidiPlayerControls } from "@/lib/hooks/useMidiPlayer";

interface AudioPlayerTabProps {
  state: MidiPlayerState;
  controls: MidiPlayerControls;
}

export function AudioPlayerTab({ state, controls }: AudioPlayerTabProps) {
  const { isPlaying, progress, duration, activeNotes, loadState } = state;
  const { togglePlayback, stopPlayback, seekTo, skip, formatTime } = controls;
  const barRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const seekFromPointer = useCallback(
    (clientX: number) => {
      const bar = barRef.current;
      if (!bar || duration <= 0) return;
      const rect = bar.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      seekTo(ratio * duration);
    },
    [duration, seekTo]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      setIsDragging(true);
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      seekFromPointer(e.clientX);
    },
    [seekFromPointer]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging) return;
      seekFromPointer(e.clientX);
    },
    [isDragging, seekFromPointer]
  );

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  if (loadState !== "ready") return null;

  return (
    <div className="space-y-6">
      {/* Scrubbing progress bar */}
      <div className="space-y-2">
        <div
          ref={barRef}
          className="relative w-full h-3 bg-pink-100 rounded-full overflow-hidden cursor-pointer group"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          <div
            className="h-full bg-gradient-to-r from-pink-300 to-pink-400 rounded-full transition-[width] duration-75"
            style={{
              width: `${duration > 0 ? (progress / duration) * 100 : 0}%`,
            }}
          />
          {/* Thumb indicator */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white border-2 border-pink-400 rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
            style={{
              left: `calc(${duration > 0 ? (progress / duration) * 100 : 0}% - 8px)`,
            }}
          />
        </div>
        <div className="flex justify-between text-xs text-slate-400">
          <span>{formatTime(progress)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Buttons */}
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={() => skip(-5)}
          className="flex items-center justify-center w-10 h-10 rounded-full bg-white border border-pink-200 text-pink-400 hover:bg-pink-50 transition-colors"
          aria-label="Rewind 5 seconds"
          title="Rewind 5s"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
        <button
          onClick={togglePlayback}
          className="flex items-center justify-center w-14 h-14 rounded-full bg-pink-400 hover:bg-pink-500 text-white transition-colors shadow-lg hover:shadow-xl"
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? (
            <Pause className="w-6 h-6" />
          ) : (
            <Play className="w-6 h-6 ml-0.5" />
          )}
        </button>
        <button
          onClick={() => skip(5)}
          className="flex items-center justify-center w-10 h-10 rounded-full bg-white border border-pink-200 text-pink-400 hover:bg-pink-50 transition-colors"
          aria-label="Forward 5 seconds"
          title="Forward 5s"
        >
          <RotateCw className="w-4 h-4" />
        </button>
        <button
          onClick={stopPlayback}
          className="flex items-center justify-center w-10 h-10 rounded-full bg-white border border-pink-200 text-pink-400 hover:bg-pink-50 transition-colors"
          aria-label="Stop"
        >
          <Square className="w-4 h-4" />
        </button>
      </div>

      {/* Active notes display */}
      {activeNotes.length > 0 && (
        <div className="flex flex-wrap justify-center gap-2">
          {activeNotes.map((note) => (
            <span
              key={note}
              className="px-3 py-1 bg-pink-100 text-pink-600 text-xs font-medium rounded-full animate-pulse"
            >
              {note}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
