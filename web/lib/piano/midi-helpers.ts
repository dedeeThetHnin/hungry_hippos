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

/** Entry in the practice-mode session log. */
export type PracticeLogEntry = {
  stepIndex: number;
  expectedMidis: number[];
  playedMidi: number;
  correct: boolean;
  timestamp: number; // ms since session start
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
