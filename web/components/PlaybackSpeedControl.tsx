"use client";

import { useState, useEffect, useCallback } from "react";

// ── Constants ─────────────────────────────────────────────────────────

const SPEED_PRESETS = [0.1, 0.25, 0.5, 0.75, 1, 1.5, 2] as const;

// ── Props ─────────────────────────────────────────────────────────────

interface PlaybackSpeedControlProps {
  playbackSpeed: number;
  setPlaybackSpeed: (speed: number) => void;
  originalBpm: number;
}

// ── Component ─────────────────────────────────────────────────────────

export function PlaybackSpeedControl({
  playbackSpeed,
  setPlaybackSpeed,
  originalBpm,
}: PlaybackSpeedControlProps) {
  // Derived BPM kept in local state so the user can type freely
  const [bpmInput, setBpmInput] = useState(() =>
    String(Math.round(playbackSpeed * originalBpm)),
  );

  // Sync BPM input when speed changes externally (e.g. preset click)
  useEffect(() => {
    setBpmInput(String(Math.round(playbackSpeed * originalBpm)));
  }, [playbackSpeed, originalBpm]);

  const handlePresetClick = useCallback(
    (preset: number) => {
      setPlaybackSpeed(preset);
    },
    [setPlaybackSpeed],
  );

  const handleBpmChange = useCallback(
    (raw: string) => {
      setBpmInput(raw);
      const parsed = Number(raw);
      if (!Number.isFinite(parsed) || parsed <= 0 || originalBpm <= 0) return;
      setPlaybackSpeed(parsed / originalBpm);
    },
    [originalBpm, setPlaybackSpeed],
  );

  // On blur, clamp / sanitise the BPM input
  const handleBpmBlur = useCallback(() => {
    const parsed = Number(bpmInput);
    if (!Number.isFinite(parsed) || parsed <= 0 || originalBpm <= 0) {
      // Reset to current speed's BPM
      setBpmInput(String(Math.round(playbackSpeed * originalBpm)));
      return;
    }
    const clamped = Math.max(1, Math.round(parsed));
    setBpmInput(String(clamped));
    setPlaybackSpeed(clamped / originalBpm);
  }, [bpmInput, playbackSpeed, originalBpm, setPlaybackSpeed]);

  // Check if the current speed matches a preset (within small epsilon)
  const activePreset = SPEED_PRESETS.find(
    (p) => Math.abs(p - playbackSpeed) < 0.005,
  );

  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {/* Speed preset pills */}
      <div className="flex items-center gap-1 rounded-full border border-pink-200 bg-white overflow-hidden text-xs font-medium">
        {SPEED_PRESETS.map((preset) => (
          <button
            key={preset}
            onClick={() => handlePresetClick(preset)}
            className={`px-2.5 py-1.5 transition ${
              activePreset === preset
                ? "bg-pink-400 text-white"
                : "text-pink-400 hover:bg-pink-50"
            }`}
          >
            {preset}×
          </button>
        ))}
      </div>

      {/* BPM input */}
      <div className="flex items-center gap-1.5 text-xs">
        <label htmlFor="bpm-input" className="text-slate-400 select-none">
          BPM
        </label>
        <input
          id="bpm-input"
          type="number"
          min={1}
          step={1}
          value={bpmInput}
          onChange={(e) => handleBpmChange(e.target.value)}
          onBlur={handleBpmBlur}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          className="w-16 border border-pink-100 rounded-full px-2.5 py-1.5 text-center text-xs text-[#2D3142] bg-white outline-none focus:border-pink-300 tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
      </div>
    </div>
  );
}
