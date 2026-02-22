"use client";

import { useEffect, useRef, useCallback, useMemo, useState } from "react";
import { Play, RotateCcw, Sparkles, Loader2, ChevronDown, ChevronUp, SkipForward } from "lucide-react";
import type {
  MidiPlayerState,
  MidiPlayerControls,
  MidiPlayerRefs,
  NoteEvent,
} from "@/lib/hooks/useMidiPlayer";
import { usePracticeMode } from "@/lib/hooks/usePracticeMode";
// NOTE: keep your existing import — we won’t change practice logic.
// If you still want to use it elsewhere, leave it.
// import { buildPracticePrompt } from "@/lib/piano/midi-helpers";
import type { FlowingJudgment } from "@/lib/piano/midi-helpers";
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
  EXPECTED_KEY_COLOR,
  WRONG_KEY_COLOR,
} from "@/lib/piano/canvas-utils";

// ── Constants ─────────────────────────────────────────────────────────

const LOOK_AHEAD = 4;
const KEYBOARD_HEIGHT_RATIO = 0.15;
const BLACK_KEY_HEIGHT_RATIO = 0.6;
const MIN_BAR_PX = 6;

// Judgment display constants
const JUDGMENT_DURATION_MS = 1200;
const JUDGMENT_FLOAT_PX = 40;

// ── Props ─────────────────────────────────────────────────────────────

interface PracticeTabProps {
  state: MidiPlayerState;
  controls: MidiPlayerControls;
  refs: MidiPlayerRefs;
  isFullscreen?: boolean;
  pianoSwitcher?: React.ReactNode;
}

// ── In-memory summary (no DB) ─────────────────────────────────────────
// This does NOT change your practice logic at all — it only summarizes
// whatever is already in `sessionLog` for Gemini.
type PracticeSummary = {
  pieceTitle: string;
  mode: "discrete" | "continuous" | "flowing";
  totalSteps: number;

  attempts: number;
  hits: number;
  wrongs: number;
  accuracyPct: number;

  // If your sessionLog includes per-event info, we’ll pick it up.
  // Otherwise these will just be empty arrays.
  topWrong: { midi: number; note: string; count: number }[];
  topMissed: { midi: number; note: string; count: number }[];
  hotspots: { step: number; fails: number }[];
};

function buildPracticeSummary(args: {
  sessionLog: any[];
  totalSteps: number;
  pieceTitle: string;
  mode: "discrete" | "continuous" | "flowing";
}): PracticeSummary {
  const { sessionLog, totalSteps, pieceTitle, mode } = args;

  // We keep this very defensive so it works with your existing sessionLog shape.
  // If you later add fields like { step, expected, played, wrong, missed }, the summary gets richer.
  const wrongByMidi = new Map<number, number>();
  const missedByMidi = new Map<number, number>();
  const failsByStep = new Map<number, number>();

  let hits = 0;
  let wrongs = 0;

  for (const e of sessionLog) {
    const correct = !!e?.correct;
    if (correct) {
      hits++;
      continue;
    }
    wrongs++;

    // hotspot steps (if present)
    if (typeof e?.step === "number") {
      const step = e.step as number;
      failsByStep.set(step, (failsByStep.get(step) ?? 0) + 1);
    }

    // wrong notes (if present)
    const wrongList: number[] =
      (Array.isArray(e?.wrong) && e.wrong) ||
      (Array.isArray(e?.wrongMidis) && e.wrongMidis) ||
      (Array.isArray(e?.played) && Array.isArray(e?.expected)
        ? (e.played as number[]).filter(
            (m) => !(e.expected as number[]).includes(m),
          )
        : []);

    for (const w of wrongList) {
      wrongByMidi.set(w, (wrongByMidi.get(w) ?? 0) + 1);
    }

    // missed notes (if present)
    const missedList: number[] =
      (Array.isArray(e?.missed) && e.missed) ||
      (Array.isArray(e?.missedMidis) && e.missedMidis) ||
      [];

    for (const m of missedList) {
      missedByMidi.set(m, (missedByMidi.get(m) ?? 0) + 1);
    }
  }

  const attempts = sessionLog.length;
  const accuracyPct = attempts > 0 ? Math.round((hits / attempts) * 100) : 0;

  const topN = (m: Map<number, number>) =>
    [...m.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([midi, count]) => ({ midi, note: midiToNoteName(midi), count }));

  const hotspots = [...failsByStep.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([step, fails]) => ({ step, fails }));

  return {
    pieceTitle,
    mode,
    totalSteps,
    attempts,
    hits,
    wrongs,
    accuracyPct,
    topWrong: topN(wrongByMidi),
    topMissed: topN(missedByMidi),
    hotspots,
  };
}

// ── Component ─────────────────────────────────────────────────────────

export function PracticeTab({
  state,
  controls,
  refs,
  isFullscreen = false,
  pianoSwitcher,
}: PracticeTabProps) {
  const { loadState, duration } = state;
  const { formatTime, getAllNotes, stopPlayback, togglePlayback, seekTo } = controls;
  const { midiRef, pianoRef } = refs;

  const layoutInfoRef = useRef<{ W: number; hitY: number; lo: number; hi: number; whiteCount: number } | null>(null);

  const {
    state: practiceState,
    controls: practiceControls,
    stepsRef,
    practiceTimeRef,
    judgmentsRef,
    flowingAllNotesRef,
    flowingMatchedRef,
  } = usePracticeMode(midiRef, pianoRef, getAllNotes, layoutInfoRef);

  const {
    status,
    practiceMode,
    practiceTime,
    currentStepIndex,
    totalSteps,
    expectedMidis,
    satisfiedMidis,
    wrongNote,
    midiDevices,
    activeDevice,
    sessionLog,
    isComplete,
    error,
    heldNotes,
    showSkipButton,
    flowingTotalNotes,
  } = practiceState;

  const { start, reset, skipStep, setActiveDevice, setPracticeMode } = practiceControls;

  // ── AI Feedback state (added; does not affect practice logic) ───────
  const [feedbackText, setFeedbackText] = useState<string | null>(null);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);

  // ── Canvas refs ─────────────────────────────────────────────────
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number>(0);
  const notesCache = useRef<NoteEvent[]>([]);

  // ── Bass track detection (same as FallingNotesTab) ──────────────
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

  // ── Layout computation ──────────────────────────────────────────
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

  const expectedMidisRef = useRef(expectedMidis);
  useEffect(() => {
    expectedMidisRef.current = expectedMidis;
  }, [expectedMidis]);

  const satisfiedMidisRef = useRef(satisfiedMidis);
  useEffect(() => {
    satisfiedMidisRef.current = satisfiedMidis;
  }, [satisfiedMidis]);

  const wrongNoteRef = useRef(wrongNote);
  useEffect(() => {
    wrongNoteRef.current = wrongNote;
  }, [wrongNote]);

  const statusRef = useRef(status);
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const heldNotesRef = useRef(heldNotes);
  useEffect(() => { heldNotesRef.current = heldNotes; }, [heldNotes]);

  const practiceModeRef = useRef(practiceMode);
  useEffect(() => { practiceModeRef.current = practiceMode; }, [practiceMode]);

  // ── Resize observer ─────────────────────────────────────────────
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

  // ── Stop regular playback when practice starts ──────────────────
  const handleStart = useCallback(async () => {
    stopPlayback();
    start();

    // In flowing mode, start MIDI audio playback so the user can hear
    // the reference piece while they play along.
    if (practiceMode === "flowing") {
      await togglePlayback();
      const allNotes = getAllNotes();
      if (allNotes.length > 0) {
        const sorted = [...allNotes].sort((a, b) => a.time - b.time);
        const startOffset = Math.max(0, sorted[0].time - 2);
        seekTo(startOffset);
      }
    }

    // Feedback UI reset (does not affect practice logic)
    setFeedbackText(null);
    setFeedbackError(null);
    setShowFeedback(false);
  }, [stopPlayback, start, practiceMode, togglePlayback, getAllNotes, seekTo]);

  // ── Stop audio when resetting ───────────────────────────────────
  const handleReset = useCallback(() => {
    reset();
    stopPlayback();
  }, [reset, stopPlayback]);

  // ── AI Feedback (added; does not affect practice logic) ──────────
  const getFeedback = useCallback(async () => {
    if (sessionLog.length === 0) return;

    setFeedbackLoading(true);
    setFeedbackError(null);

    try {
      const summary = buildPracticeSummary({
        sessionLog,
        totalSteps,
        pieceTitle: state.title || "this piece",
        mode: practiceMode,
      });
      const res = await fetch("/api/piano-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ summary }),
      });

      if (!res.ok) throw new Error(`API error ${res.status}`);

      const data: { text?: string } = await res.json();
      const text = (data.text ?? "").trim();
      setFeedbackText(text || "No feedback returned.");
      setShowFeedback(true);
    } catch (e: unknown) {
      setFeedbackError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setFeedbackLoading(false);
    }
  }, [sessionLog, totalSteps, flowingTotalNotes, practiceMode, state.title]);

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
    const hitY = playAreaHeight;

    layoutInfoRef.current = { W, hitY, lo: layout.lo, hi: layout.hi, whiteCount: layout.whiteCount };

    // Use practice clock instead of Tone.Transport
    const currentTime = practiceTimeRef.current;
    const curExpected = expectedMidisRef.current;
    const curSatisfied = satisfiedMidisRef.current;
    const curWrongNote = wrongNoteRef.current;
    const curStatus = statusRef.current;
    const curHeld = heldNotesRef.current;
    const curMode = practiceModeRef.current;
    const isFlowing = curMode === "flowing";

    // Clear
    ctx.fillStyle = CANVAS_BG;
    ctx.fillRect(0, 0, W, H);

    const { lo, hi, whiteCount } = layout;
    const whiteKeyWidth = W / whiteCount;
    const pxPerSec = playAreaHeight / LOOK_AHEAD;

    // ── Draw falling note bars ────────────────────────────────────
    const notes = notesCache.current;
    const activeKeys = new Set<number>();

    for (const note of notes) {
      const noteEnd = note.time + note.duration;

      const yBottom = hitY - (note.time - currentTime) * pxPerSec;
      const yTop = hitY - (noteEnd - currentTime) * pxPerSec;
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

      // Determine note color — highlight expected notes at the hit line (not in flowing mode)
      let fillAlpha = 0.85;
      let isExpectedNote = false;
      if (!isFlowing && curExpected.has(note.midi) && Math.abs(note.time - currentTime) < 0.05) {
        isExpectedNote = true;
        fillAlpha = 1;
      }

      ctx.fillStyle = noteColor(isBass, fillAlpha);
      ctx.beginPath();
      ctx.roundRect(barX, yTop, barW, barHeight, radius);
      ctx.fill();

      // Glow for active/expected notes
      if (activeKeys.has(note.midi) || isExpectedNote) {
        ctx.shadowColor = isExpectedNote
          ? EXPECTED_KEY_COLOR
          : ACTIVE_KEY_COLOR;
        ctx.shadowBlur = isExpectedNote ? 16 : 12;
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

    // ── Hit line ──────────────────────────────────────────────────
    const hitLineColor = !isFlowing && curStatus === "waiting"
      ? "rgba(239,68,68,0.6)"
      : HIT_LINE_COLOR;
    ctx.fillStyle = hitLineColor;
    ctx.fillRect(0, hitY - 1, W, 2);

    // ── Draw piano keyboard ───────────────────────────────────────

    // White keys
    let wi = 0;
    for (let m = lo; m <= hi; m++) {
      if (isBlackKey(m)) continue;
      const x = wi * whiteKeyWidth;

      // Determine key colour
      let keyColor = WHITE_KEY_COLOR;
      if (isFlowing) {
        // Flowing mode: just show held notes, no expected/wrong colouring
        if (curHeld.has(m)) {
          keyColor = ACTIVE_KEY_COLOR;
        } else if (activeKeys.has(m)) {
          keyColor = "#FFD6E8"; // faint pink for notes at hit line
        }
      } else {
        if (curWrongNote === m) {
          keyColor = WRONG_KEY_COLOR;
        } else if (curExpected.has(m) && !curSatisfied.has(m)) {
          keyColor = EXPECTED_KEY_COLOR;
        } else if (curSatisfied.has(m)) {
          keyColor = ACTIVE_KEY_COLOR;
        } else if (curHeld.has(m)) {
          keyColor = "#FFB3D9"; // light pink for held but not expected
        } else if (activeKeys.has(m)) {
          keyColor = ACTIVE_KEY_COLOR;
        }
      }

      ctx.fillStyle = keyColor;
      ctx.fillRect(x, hitY, whiteKeyWidth, kbHeight);

      ctx.strokeStyle = KEY_BORDER_COLOR;
      ctx.lineWidth = 1;
      ctx.strokeRect(x, hitY, whiteKeyWidth, kbHeight);

      if (whiteKeyWidth > 14) {
        const label = midiToNoteName(m);
        const isHighlighted = keyColor !== WHITE_KEY_COLOR;
        ctx.fillStyle = isHighlighted
          ? "rgba(255,255,255,0.9)"
          : "rgba(100,100,120,0.5)";
        ctx.font = `${Math.min(10, whiteKeyWidth * 0.35)}px system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.fillText(
          label,
          x + whiteKeyWidth / 2,
          hitY + kbHeight - 4,
          whiteKeyWidth - 2,
        );
      }
      wi++;
    }

    // Black keys
    for (let m = lo; m <= hi; m++) {
      if (!isBlackKey(m)) continue;
      const pos = keyPosition(m, lo, hi, whiteCount, W);
      const bkHeight = kbHeight * BLACK_KEY_HEIGHT_RATIO;

      let keyColor = BLACK_KEY_COLOR;
      if (isFlowing) {
        if (curHeld.has(m)) {
          keyColor = ACTIVE_KEY_COLOR;
        } else if (activeKeys.has(m)) {
          keyColor = "#CC5C8A";
        }
      } else {
        if (curWrongNote === m) {
          keyColor = WRONG_KEY_COLOR;
        } else if (curExpected.has(m) && !curSatisfied.has(m)) {
          keyColor = EXPECTED_KEY_COLOR;
        } else if (curSatisfied.has(m)) {
          keyColor = ACTIVE_KEY_COLOR;
        } else if (curHeld.has(m)) {
          keyColor = "#CC5C8A";
        } else if (activeKeys.has(m)) {
          keyColor = ACTIVE_KEY_COLOR;
        }
      }

      ctx.fillStyle = keyColor;
      ctx.beginPath();
      ctx.roundRect(pos.x, hitY, pos.w, bkHeight, [0, 0, 3, 3]);
      ctx.fill();

      if (pos.w > 14) {
        const label = midiToNoteName(m);
        const isHighlighted = keyColor !== BLACK_KEY_COLOR;
        ctx.fillStyle = isHighlighted
          ? "rgba(255,255,255,0.95)"
          : "rgba(200,200,220,0.6)";
        ctx.font = `${Math.min(9, pos.w * 0.38)}px system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.fillText(label, pos.centre, hitY + bkHeight - 3, pos.w - 2);
      }
    }

    // ── Flowing mode: judgment popups ─────────────────────────────
    if (isFlowing && judgmentsRef.current.length > 0) {
      const now = performance.now();
      const activeJudgments: FlowingJudgment[] = [];

      for (const j of judgmentsRef.current) {
        const age = now - j.createdAt;
        if (age > JUDGMENT_DURATION_MS) continue;
        activeJudgments.push(j);

        const progress = age / JUDGMENT_DURATION_MS;
        const alpha = 1 - progress;
        const floatOffset = progress * JUDGMENT_FLOAT_PX;

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = j.color;
        ctx.font = "bold 16px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";

        // Draw text shadow for readability
        ctx.shadowColor = "rgba(0,0,0,0.5)";
        ctx.shadowBlur = 4;
        ctx.fillText(j.text, j.x, j.y - floatOffset);
        ctx.shadowBlur = 0;
        ctx.restore();
      }

      // Prune expired judgments
      judgmentsRef.current = activeJudgments;
    }

    // ── Status overlay ────────────────────────────────────────────
    if (!isFlowing && curStatus === "waiting") {
      ctx.fillStyle = "rgba(239, 68, 68, 0.12)";
      ctx.fillRect(0, 0, W, playAreaHeight);

      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.font = "bold 14px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("Play the highlighted notes ↓", W / 2, 30);
    }

    if (curStatus === "idle") {
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.fillRect(0, 0, W, H);

      ctx.fillStyle = "rgba(255,255,255,0.8)";
      ctx.font = "bold 16px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("Press Start to begin practicing", W / 2, H / 2);
    }

    if (curStatus === "complete") {
      ctx.fillStyle = "rgba(0,0,0,0.4)";
      ctx.fillRect(0, 0, W, H);

      ctx.fillStyle = "#4ADE80";
      ctx.font = "bold 20px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("✓ Piece Complete!", W / 2, H / 2 - 12);

      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.font = "14px system-ui, sans-serif";
      ctx.fillText("Get AI Feedback or Reset to try again", W / 2, H / 2 + 16);
    }

    // ── Time overlay ──────────────────────────────────────────────
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(`${formatTime(currentTime)} / ${formatTime(duration)}`, 8, 8);
  }, [layout, bassTrack, duration, formatTime, practiceTimeRef]);

  // ── Animation frame loop ────────────────────────────────────────
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

  // ── Compute stats ───────────────────────────────────────────────
  const isFlowingMode = practiceMode === "flowing";

  // Flowing mode stats
  const flowingCorrect = sessionLog.filter((e) => e.rating && e.rating !== "miss" && e.correct).length;
  const flowingMissed = sessionLog.filter((e) => e.rating === "miss").length;
  const flowingExtra = sessionLog.filter((e) => e.rating === undefined && !e.correct).length;
  const flowingAccuracy = flowingTotalNotes > 0
    ? Math.round((flowingCorrect / flowingTotalNotes) * 100)
    : 0;
  const ratingCounts = { perfect: 0, great: 0, okay: 0, poor: 0 };
  for (const e of sessionLog) {
    if (e.rating && e.rating !== "miss" && e.rating in ratingCounts) {
      ratingCounts[e.rating as keyof typeof ratingCounts]++;
    }
  }

  // Discrete/continuous mode stats
  const progressPct = totalSteps > 0 ? Math.round((currentStepIndex / totalSteps) * 100) : 0;
  const correctCount = sessionLog.filter((e) => e.correct).length;
  const wrongCount = sessionLog.filter((e) => !e.correct).length;
  const accuracy =
    sessionLog.length > 0
      ? Math.round((correctCount / sessionLog.length) * 100)
      : 0;

  return (
    <div
      className={`${
        isFullscreen
          ? "absolute inset-0 flex flex-col gap-3 overflow-hidden"
          : "space-y-4"
      }`}
    >
      {/* Canvas */}
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

        {/* Start overlay */}
        {status === "idle" && (
          <button
            onClick={handleStart}
            className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/30 transition-colors group"
            aria-label="Start Practice"
          >
            <div className="w-16 h-16 rounded-full bg-green-400/90 group-hover:bg-green-500 flex items-center justify-center shadow-xl transition-colors">
              <Play className="w-7 h-7 text-white ml-1" />
            </div>
          </button>
        )}
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center justify-center gap-3 shrink-0">
        {/* Start / Reset */}
        {status === "idle" ? (
          <button
            onClick={handleStart}
            disabled={midiDevices.length === 0}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-green-500 hover:bg-green-600 text-white text-sm font-medium transition disabled:opacity-40"
          >
            <Play className="w-4 h-4" />
            Start
          </button>
        ) : (
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-white border border-pink-200 text-pink-500 hover:bg-pink-50 text-sm font-medium transition"
          >
            <RotateCcw className="w-4 h-4" />
            Reset
          </button>
        )}

        {/* MIDI device selector */}
        {midiDevices.length > 0 ? (
          <select
            className="border border-pink-100 rounded-full px-3 py-2 text-xs text-[#2D3142] bg-white outline-none focus:border-pink-300 max-w-[180px]"
            value={activeDevice ?? ""}
            onChange={(e) => setActiveDevice(e.target.value)}
          >
            {midiDevices.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-xs text-red-400">No MIDI device</span>
        )}

        {/* Skip step (escape hatch) — not shown in flowing mode */}
        {!isFlowingMode && showSkipButton && status !== "idle" && status !== "complete" && (
          <button
            onClick={skipStep}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-400 hover:bg-amber-500 text-white text-xs font-medium transition animate-in fade-in duration-300"
          >
            <SkipForward className="w-3.5 h-3.5" />
            Skip
          </button>
        )}

        {/* Mode toggle: Flowing / Continuous / Discrete */}
        <div className="flex rounded-full border border-pink-200 bg-white overflow-hidden text-xs font-medium">
          <button
            onClick={() => setPracticeMode("flowing")}
            className={`px-3 py-1.5 transition ${
              practiceMode === "flowing"
                ? "bg-pink-400 text-white"
                : "text-pink-400 hover:bg-pink-50"
            }`}
          >
            Flowing
          </button>
          <button
            onClick={() => setPracticeMode("continuous")}
            className={`px-3 py-1.5 transition ${
              practiceMode === "continuous"
                ? "bg-pink-400 text-white"
                : "text-pink-400 hover:bg-pink-50"
            }`}
          >
            Continuous
          </button>
          <button
            onClick={() => setPracticeMode("discrete")}
            className={`px-3 py-1.5 transition ${
              practiceMode === "discrete"
                ? "bg-pink-400 text-white"
                : "text-pink-400 hover:bg-pink-50"
            }`}
          >
            Discrete
          </button>
        </div>

        {/* Progress — discrete/continuous */}
        {!isFlowingMode && status !== "idle" && (
          <span className="text-xs text-slate-400 tabular-nums">
            Step {Math.min(currentStepIndex + 1, totalSteps)}/{totalSteps} (
            {progressPct}%)
          </span>
        )}

        {/* Accuracy badge — depends on mode */}
        {isFlowingMode && sessionLog.length > 0 && (
          <span
            className={`text-xs font-medium rounded-full px-3 py-1 border ${
              flowingAccuracy >= 80
                ? "text-green-600 bg-green-50 border-green-200"
                : flowingAccuracy >= 50
                  ? "text-amber-600 bg-amber-50 border-amber-200"
                  : "text-red-500 bg-red-50 border-red-200"
            }`}
          >
            {flowingAccuracy}% · {ratingCounts.perfect}P {ratingCounts.great}G {ratingCounts.okay}O {ratingCounts.poor}B {flowingMissed}M
          </span>
        )}

        {!isFlowingMode && sessionLog.length > 0 && (
          <span
            className={`text-xs font-medium rounded-full px-3 py-1 border ${
              accuracy >= 80
                ? "text-green-600 bg-green-50 border-green-200"
                : accuracy >= 50
                  ? "text-amber-600 bg-amber-50 border-amber-200"
                  : "text-red-500 bg-red-50 border-red-200"
            }`}
          >
            {accuracy}% · {correctCount}✓ {wrongCount}✗
          </span>
        )}

        {/* AI Feedback button (added) */}
        {sessionLog.length > 0 && (
          <button
            onClick={getFeedback}
            disabled={feedbackLoading}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-pink-400 hover:bg-pink-500 text-white text-sm font-medium transition disabled:opacity-60"
          >
            {feedbackLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            AI Feedback
          </button>
        )}

        {/* Time display */}
        <span className="text-xs text-slate-400 tabular-nums min-w-[4rem] text-right">
          {formatTime(practiceTime)} / {formatTime(duration)}
        </span>

        {pianoSwitcher && <div className="ml-1">{pianoSwitcher}</div>}
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-red-500 text-sm text-center">
          ⚠ {error}
        </div>
      )}

      {/* AI Feedback panel (added) */}
      {(feedbackText || feedbackError) && (
        <div className="rounded-2xl border border-pink-100 bg-pink-50/60 overflow-hidden">
          <button
            onClick={() => setShowFeedback((prev) => !prev)}
            className="w-full flex items-center justify-between px-5 py-3 text-sm font-medium text-pink-600 hover:bg-pink-50 transition"
          >
            <span className="flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              AI Feedback
            </span>
            {showFeedback ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>

          {showFeedback && (
            <div className="px-5 pb-4">
              {feedbackError ? (
                <p className="text-red-500 text-sm">⚠ {feedbackError}</p>
              ) : (
                <p className="text-[#2D3142]/80 text-sm leading-relaxed whitespace-pre-wrap">
                  {feedbackText}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
