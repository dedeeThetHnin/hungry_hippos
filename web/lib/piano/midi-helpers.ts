// ── Shared MIDI analysis / AI-feedback helpers ────────────────────────
// Extracted from PracticeModal so they can be reused by PracticeTab.

import type { Midi } from "@tonejs/midi";

// ── Types ─────────────────────────────────────────────────────────────

export type CapturedNote = {
  midi: number;
  velocity: number;
  time: number;
  offsetMs: number;
  duration: number;
};

export type ReferenceNote = {
  midi: number;
  note: string;
  timeMs: number;
  durationMs: number;
  velocity: number;
};

export type Comparison = {
  missingNotes: string[];
  extraNotes: string[];
  timingErrors: { note: string; diffMs: number; direction: string }[];
  accuracy: number;
};

/** Judgment rating for flowing mode. */
export type FlowingRating = "perfect" | "great" | "okay" | "poor" | "miss";

/** Entry in the practice-mode session log. */
export type PracticeLogEntry = {
  stepIndex: number;
  expectedMidis: number[];
  playedMidi: number;
  correct: boolean;
  timestamp: number; // ms since session start
  /** Timing offset from the expected note time (ms). Negative = early, positive = late. Only set in flowing mode. */
  timingOffsetMs?: number;
  /** Judgment rating. Only set in flowing mode. */
  rating?: FlowingRating;
};

/** A judgment popup rendered on the practice canvas. */
export type FlowingJudgment = {
  text: string;
  color: string;
  x: number;       // horizontal centre (px)
  y: number;       // starting vertical position (px)
  createdAt: number; // performance.now() when created
};

// ── Helpers ───────────────────────────────────────────────────────────

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export function midiNoteToName(midi: number): string {
  return `${NOTE_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;
}

export function extractReferenceNotes(midi: Midi): ReferenceNote[] {
  const notes: ReferenceNote[] = [];
  for (const track of midi.tracks) {
    for (const note of track.notes) {
      notes.push({
        midi: note.midi,
        note: midiNoteToName(note.midi),
        timeMs: Math.round(note.time * 1000),
        durationMs: Math.round(note.duration * 1000),
        velocity: Math.round(note.velocity * 127),
      });
    }
  }
  return notes.sort((a, b) => a.timeMs - b.timeMs);
}

export function comparePerformance(played: CapturedNote[], reference: ReferenceNote[]): Comparison {
  const refByMidi: Record<number, ReferenceNote[]> = {};
  for (const n of reference) {
    if (!refByMidi[n.midi]) refByMidi[n.midi] = [];
    refByMidi[n.midi].push(n);
  }
  const playedByMidi: Record<number, CapturedNote[]> = {};
  for (const n of played) {
    if (!playedByMidi[n.midi]) playedByMidi[n.midi] = [];
    playedByMidi[n.midi].push(n);
  }

  const refMidis = new Set(reference.map((n) => n.midi));
  const playedMidis = new Set(played.map((n) => n.midi));

  const missingNotes = [...refMidis].filter((m) => !playedMidis.has(m)).map(midiNoteToName);
  const extraNotes = [...playedMidis].filter((m) => !refMidis.has(m)).map(midiNoteToName);

  const refStartMs = reference[0]?.timeMs ?? 0;
  const playedStartMs = played[0]?.offsetMs ?? 0;
  const timingErrors: Comparison["timingErrors"] = [];

  for (const midi of [...refMidis].filter((m) => playedMidis.has(m))) {
    const count = Math.min(refByMidi[midi].length, playedByMidi[midi].length);
    for (let i = 0; i < count; i++) {
      const diffMs =
        (playedByMidi[midi][i].offsetMs - playedStartMs) - (refByMidi[midi][i].timeMs - refStartMs);
      if (Math.abs(diffMs) > 150)
        timingErrors.push({ note: midiNoteToName(midi), diffMs, direction: diffMs > 0 ? "late" : "early" });
    }
  }

  const accuracy = reference.length > 0
    ? Math.round((reference.filter((n) => playedMidis.has(n.midi)).length / reference.length) * 100)
    : 0;
  return { missingNotes, extraNotes, timingErrors, accuracy };
}

export function buildPrompt(
  played: CapturedNote[],
  reference: ReferenceNote[],
  comparison: Comparison,
  title: string,
): string {
  const { missingNotes, extraNotes, timingErrors, accuracy } = comparison;
  return `You are an encouraging but precise piano coach. A student just finished playing "${title}".

Performance accuracy: ${accuracy}% of reference notes played correctly.
Notes missing: ${missingNotes.length ? missingNotes.join(", ") : "none"}
Extra notes: ${extraNotes.length ? extraNotes.join(", ") : "none"}
Timing errors (>150ms): ${timingErrors.length ? timingErrors.map((e) => `${e.note} ${Math.abs(e.diffMs)}ms ${e.direction}`).join(", ") : "none"}
Average velocity: ${played.length > 0 ? Math.round(played.reduce((s, n) => s + n.velocity, 0) / played.length) : 0}/127
Notes played: ${played.length} (score has ${reference.length})

Give feedback in 3 short paragraphs: (1) note accuracy, (2) timing & rhythm, (3) one thing to focus on next. Be warm but precise.`;
}

// ── Practice-mode specific prompt builder ──────────────────────────────

export function buildPracticePrompt(
  log: PracticeLogEntry[],
  totalSteps: number,
  title: string,
): string {
  // Detect flowing mode: entries with a rating field set
  const flowingEntries = log.filter((e) => e.rating !== undefined);
  const isFlowing = flowingEntries.length > 0;

  if (isFlowing) {
    return buildFlowingPracticePrompt(flowingEntries, totalSteps, title);
  }

  const correct = log.filter((e) => e.correct).length;
  const wrong = log.filter((e) => !e.correct).length;
  const accuracy = log.length > 0 ? Math.round((correct / log.length) * 100) : 0;

  const stepsReached = log.length > 0 ? Math.max(...log.map((e) => e.stepIndex)) + 1 : 0;
  const progressPct = totalSteps > 0 ? Math.round((stepsReached / totalSteps) * 100) : 0;

  // Find most-struggled notes
  const wrongByMidi: Record<number, number> = {};
  for (const e of log.filter((x) => !x.correct)) {
    wrongByMidi[e.playedMidi] = (wrongByMidi[e.playedMidi] ?? 0) + 1;
  }
  const topWrong = Object.entries(wrongByMidi)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([midi, count]) => `${midiNoteToName(Number(midi))} (${count}×)`);

  return `You are an encouraging but precise piano coach. A student is practising "${title}" in step-by-step mode (playback waits for correct notes before advancing).

Progress: reached step ${stepsReached} of ${totalSteps} (${progressPct}%)
Total key presses: ${log.length} (${correct} correct, ${wrong} wrong)
Accuracy: ${accuracy}%
Most common wrong notes: ${topWrong.length ? topWrong.join(", ") : "none"}

Give feedback in 3 short paragraphs: (1) accuracy assessment, (2) specific notes or passages to focus on, (3) encouragement and next steps. Be warm but precise.`;
}

/** Prompt builder for flowing mode — includes timing accuracy data. */
function buildFlowingPracticePrompt(
  log: PracticeLogEntry[],
  totalNotes: number,
  title: string,
): string {
  const ratingCounts: Record<string, number> = { perfect: 0, great: 0, okay: 0, poor: 0, miss: 0 };
  for (const e of log) {
    if (e.rating) ratingCounts[e.rating] = (ratingCounts[e.rating] ?? 0) + 1;
  }

  const played = log.filter((e) => e.rating !== "miss");
  const correct = log.filter((e) => e.correct).length;
  const accuracy = totalNotes > 0 ? Math.round((correct / totalNotes) * 100) : 0;

  const timingOffsets = played
    .filter((e) => e.timingOffsetMs !== undefined)
    .map((e) => e.timingOffsetMs!);
  const avgOffset = timingOffsets.length > 0
    ? Math.round(timingOffsets.reduce((s, v) => s + v, 0) / timingOffsets.length)
    : 0;
  const absOffsets = timingOffsets.map(Math.abs);
  const avgAbsOffset = absOffsets.length > 0
    ? Math.round(absOffsets.reduce((s, v) => s + v, 0) / absOffsets.length)
    : 0;

  const earlyCount = timingOffsets.filter((o) => o < -50).length;
  const lateCount = timingOffsets.filter((o) => o > 50).length;
  const tendency = earlyCount > lateCount * 1.5 ? "tends to play early" : lateCount > earlyCount * 1.5 ? "tends to play late" : "no strong early/late tendency";

  // Find most-struggled notes
  const wrongByMidi: Record<number, number> = {};
  for (const e of log.filter((x) => !x.correct)) {
    wrongByMidi[e.playedMidi] = (wrongByMidi[e.playedMidi] ?? 0) + 1;
  }
  const topWrong = Object.entries(wrongByMidi)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([midi, count]) => `${midiNoteToName(Number(midi))} (${count}×)`);

  return `You are an encouraging but precise piano coach. A student just finished playing "${title}" in flowing mode (notes scroll in real-time and the student plays along).

Note accuracy: ${accuracy}% (${correct} of ${totalNotes} notes matched)
Rating breakdown: ${ratingCounts.perfect} Perfect, ${ratingCounts.great} Great, ${ratingCounts.okay} Okay, ${ratingCounts.poor} Poor, ${ratingCounts.miss} Missed
Average timing offset: ${avgAbsOffset}ms (signed average: ${avgOffset > 0 ? "+" : ""}${avgOffset}ms — ${tendency})
Notes played: ${played.length}, Extra/wrong notes: ${played.filter((e) => !e.correct).length}
Most common wrong notes: ${topWrong.length ? topWrong.join(", ") : "none"}

Give feedback in 3 short paragraphs: (1) note accuracy and which notes to focus on, (2) timing & rhythm analysis — are they rushing, dragging, or inconsistent?, (3) one specific thing to practice next. Be warm but precise.`;
}
