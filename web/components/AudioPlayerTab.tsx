"use client";

import { Play, Pause, Square } from "lucide-react";
import type { MidiPlayerState, MidiPlayerControls } from "@/lib/hooks/useMidiPlayer";

interface AudioPlayerTabProps {
  state: MidiPlayerState;
  controls: MidiPlayerControls;
}

export function AudioPlayerTab({ state, controls }: AudioPlayerTabProps) {
  const { isPlaying, progress, duration, activeNotes, loadState } = state;
  const { togglePlayback, stopPlayback, formatTime } = controls;

  if (loadState !== "ready") return null;

  return (
    <div className="space-y-6">
      {/* Progress bar */}
      <div className="space-y-2">
        <div className="w-full h-2 bg-pink-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-pink-300 to-pink-400 rounded-full transition-[width] duration-150"
            style={{
              width: `${duration > 0 ? (progress / duration) * 100 : 0}%`,
            }}
          />
        </div>
        <div className="flex justify-between text-xs text-slate-400">
          <span>{formatTime(progress)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Buttons */}
      <div className="flex items-center justify-center gap-4">
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
