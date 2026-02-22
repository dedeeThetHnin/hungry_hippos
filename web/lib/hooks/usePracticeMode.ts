"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { Midi } from "@tonejs/midi";
import * as Tone from "tone";
import type { PianoPlayer } from "@/lib/piano";
import type { NoteEvent } from "@/lib/hooks/useMidiPlayer";
import type { PracticeLogEntry } from "@/lib/piano/midi-helpers";

// ── Types ─────────────────────────────────────────────────────────────

/** A "step" groups simultaneous notes (chords) that the user must play. */
export interface PracticeStep {
  /** Index of this step in the sequence */
  index: number;
  /** Time in the MIDI file (seconds) when these notes start */
  time: number;
  /** Set of MIDI note numbers expected at this step */
  midis: Set<number>;
  /** Full note events (for audio playback) */
  notes: NoteEvent[];
}

export type PracticeStatus =
  | "idle"          // waiting for user to click Start
  | "playing"       // actively practicing — clock advances on correct input
  | "waiting"       // wrong note was played, waiting for correct note(s)
  | "complete";     // reached the end of the piece

export interface PracticeModeState {
  status: PracticeStatus;
  /** Current position in the piece (seconds) — drives falling notes canvas */
  practiceTime: number;
  /** Current step index the user is on */
  currentStepIndex: number;
  /** Total number of steps */
  totalSteps: number;
  /** MIDI numbers the user needs to press right now */
  expectedMidis: Set<number>;
  /** MIDI numbers the user has correctly pressed in the current step so far */
  satisfiedMidis: Set<number>;
  /** Last wrong note the user pressed (null if no error) */
  wrongNote: number | null;
  /** Connected MIDI input devices */
  midiDevices: { id: string; name: string; ref: MIDIInput }[];
  /** Currently selected device id */
  activeDevice: string | null;
  /** Session log for AI feedback */
  sessionLog: PracticeLogEntry[];
  /** Whether the piece is fully completed */
  isComplete: boolean;
  /** Error message */
  error: string | null;
  /** MIDI notes currently being held down by the user */
  heldNotes: Set<number>;
}

export interface PracticeModeControls {
  start: () => void;
  reset: () => void;
  setActiveDevice: (id: string) => void;
}

// ── Step builder ──────────────────────────────────────────────────────

const CHORD_TOLERANCE_SEC = 0.03; // 30ms — notes within this window = same step

function buildSteps(allNotes: NoteEvent[]): PracticeStep[] {
  if (allNotes.length === 0) return [];

  // Sort by time, then by midi for stability
  const sorted = [...allNotes].sort((a, b) => a.time - b.time || a.midi - b.midi);

  const steps: PracticeStep[] = [];
  let currentGroup: NoteEvent[] = [sorted[0]];
  let groupTime = sorted[0].time;

  for (let i = 1; i < sorted.length; i++) {
    const note = sorted[i];
    if (note.time - groupTime <= CHORD_TOLERANCE_SEC) {
      currentGroup.push(note);
    } else {
      // Flush previous group
      steps.push({
        index: steps.length,
        time: groupTime,
        midis: new Set(currentGroup.map((n) => n.midi)),
        notes: currentGroup,
      });
      currentGroup = [note];
      groupTime = note.time;
    }
  }
  // Flush last group
  steps.push({
    index: steps.length,
    time: groupTime,
    midis: new Set(currentGroup.map((n) => n.midi)),
    notes: currentGroup,
  });

  return steps;
}

// ── Hook ──────────────────────────────────────────────────────────────

export function usePracticeMode(
  midiRef: React.RefObject<Midi | null>,
  pianoRef: React.RefObject<PianoPlayer | null>,
  getAllNotes: () => NoteEvent[],
) {
  // ── State ───────────────────────────────────────────────────────
  const [status, setStatus] = useState<PracticeStatus>("idle");
  const [practiceTime, setPracticeTime] = useState(0);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [expectedMidis, setExpectedMidis] = useState<Set<number>>(new Set());
  const [satisfiedMidis, setSatisfiedMidis] = useState<Set<number>>(new Set());
  const [wrongNote, setWrongNote] = useState<number | null>(null);
  const [midiDevices, setMidiDevices] = useState<{ id: string; name: string; ref: MIDIInput }[]>([]);
  const [activeDevice, setActiveDevice] = useState<string | null>(null);
  const [sessionLog, setSessionLog] = useState<PracticeLogEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [heldNotes, setHeldNotes] = useState<Set<number>>(new Set());

  // ── Refs (for use in MIDI callback without stale closures) ──────
  const stepsRef = useRef<PracticeStep[]>([]);
  const stepIndexRef = useRef(0);
  const statusRef = useRef<PracticeStatus>("idle");
  const satisfiedRef = useRef<Set<number>>(new Set());
  const sessionLogRef = useRef<PracticeLogEntry[]>([]);
  const sessionStartRef = useRef(0);
  const heldNotesRef = useRef<Set<number>>(new Set());

  // Keep refs in sync with state
  useEffect(() => { statusRef.current = status; }, [status]);

  // ── Build steps when MIDI data is available ─────────────────────
  const steps = useCallback(() => {
    const notes = getAllNotes();
    if (notes.length === 0) return [];
    return buildSteps(notes);
  }, [getAllNotes]);

  // ── MIDI device setup ───────────────────────────────────────────
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.requestMIDIAccess) {
      setError("Web MIDI API not supported in this browser.");
      return;
    }

    let access: MIDIAccess;
    navigator.requestMIDIAccess()
      .then((a) => {
        access = a;
        refreshDevices(a);
        a.onstatechange = () => refreshDevices(a);
      })
      .catch(() => setError("MIDI access denied."));

    return () => {
      if (access) {
        for (const i of access.inputs.values()) i.onmidimessage = null;
      }
    };
  }, []);

  function refreshDevices(access: MIDIAccess) {
    const devices = Array.from(access.inputs.values()).map((i) => ({
      id: i.id,
      name: i.name ?? "Unknown Device",
      ref: i as MIDIInput,
    }));
    setMidiDevices(devices);
    if (devices.length > 0) {
      setActiveDevice((prev) => prev ?? devices[0].id);
    }
  }

  // ── Play reference notes through the piano ──────────────────────
  const playStepAudio = useCallback(
    (step: PracticeStep) => {
      const piano = pianoRef.current;
      if (!piano) return;
      Tone.start(); // ensure audio context is running
      for (const note of step.notes) {
        piano.start({
          note: note.name,
          duration: note.duration,
          velocity: note.velocity,
        });
      }
    },
    [pianoRef],
  );

  // ── Advance to next step ────────────────────────────────────────
  const advanceStep = useCallback(
    (currentSteps: PracticeStep[]) => {
      const nextIdx = stepIndexRef.current + 1;
      if (nextIdx >= currentSteps.length) {
        // Piece complete!
        setStatus("complete");
        statusRef.current = "complete";
        setCurrentStepIndex(nextIdx);
        return;
      }

      stepIndexRef.current = nextIdx;
      setCurrentStepIndex(nextIdx);

      const nextStep = currentSteps[nextIdx];
      setPracticeTime(nextStep.time);
      setExpectedMidis(new Set(nextStep.midis));
      setSatisfiedMidis(new Set());
      satisfiedRef.current = new Set();
      setWrongNote(null);
      setStatus("playing");
      statusRef.current = "playing";
    },
    [],
  );

  // ── Attach MIDI input listener ──────────────────────────────────
  useEffect(() => {
    if (!activeDevice || !midiDevices.length) return;

    // Clear previous listeners
    midiDevices.forEach((d) => { d.ref.onmidimessage = null; });

    const device = midiDevices.find((d) => d.id === activeDevice);
    if (!device) return;

    device.ref.onmidimessage = (msg: MIDIMessageEvent) => {
      const st = statusRef.current;
      if (st !== "playing" && st !== "waiting") return;

      const data = msg.data;
      if (!data || data.length < 3) return;
      const [s, midi, velocity] = data;
      const type = s & 0xf0;

      // Note-on
      if (type === 0x90 && velocity > 0) {
        // Track held notes
        const newHeld = new Set(heldNotesRef.current);
        newHeld.add(midi);
        heldNotesRef.current = newHeld;
        setHeldNotes(new Set(newHeld));

        const currentSteps = stepsRef.current;
        const idx = stepIndexRef.current;
        if (idx >= currentSteps.length) return;

        const step = currentSteps[idx];
        const expected = step.midis;
        const logEntry: PracticeLogEntry = {
          stepIndex: idx,
          expectedMidis: [...expected],
          playedMidi: midi,
          correct: expected.has(midi),
          timestamp: performance.now() - sessionStartRef.current,
        };
        sessionLogRef.current = [...sessionLogRef.current, logEntry];
        setSessionLog([...sessionLogRef.current]);

        if (expected.has(midi)) {
          // Correct note!
          const newSatisfied = new Set(satisfiedRef.current);
          newSatisfied.add(midi);
          satisfiedRef.current = newSatisfied;
          setSatisfiedMidis(new Set(newSatisfied));
          setWrongNote(null);

          // Check if all notes in step are satisfied
          const allSatisfied = [...expected].every((m) => newSatisfied.has(m));
          if (allSatisfied) {
            // Play the reference audio for this step
            playStepAudio(step);
            // Advance to next step
            advanceStep(currentSteps);
          } else {
            // Still waiting for more notes in this chord
            setStatus("playing");
            statusRef.current = "playing";
          }
        } else {
          // Wrong note!
          setWrongNote(midi);
          setStatus("waiting");
          statusRef.current = "waiting";
          // Clear wrong note highlight after a short delay
          setTimeout(() => {
            setWrongNote((prev) => (prev === midi ? null : prev));
          }, 800);
        }
      }

      // Note-off
      if (type === 0x80 || (type === 0x90 && velocity === 0)) {
        const newHeld = new Set(heldNotesRef.current);
        newHeld.delete(midi);
        heldNotesRef.current = newHeld;
        setHeldNotes(new Set(newHeld));
      }
    };

    return () => {
      device.ref.onmidimessage = null;
    };
  }, [activeDevice, midiDevices, playStepAudio, advanceStep]);

  // ── Start practice ──────────────────────────────────────────────
  const start = useCallback(() => {
    const allSteps = steps();
    if (allSteps.length === 0) {
      setError("No notes in this score.");
      return;
    }

    // Stop any Tone.Transport playback that may be running
    const transport = Tone.getTransport();
    transport.pause();

    stepsRef.current = allSteps;
    stepIndexRef.current = 0;
    sessionStartRef.current = performance.now();
    sessionLogRef.current = [];
    satisfiedRef.current = new Set();
    heldNotesRef.current = new Set();

    const firstStep = allSteps[0];
    setPracticeTime(firstStep.time);
    setCurrentStepIndex(0);
    setExpectedMidis(new Set(firstStep.midis));
    setSatisfiedMidis(new Set());
    setWrongNote(null);
    setSessionLog([]);
    setError(null);
    setHeldNotes(new Set());
    setStatus("playing");
    statusRef.current = "playing";
  }, [steps]);

  // ── Reset ───────────────────────────────────────────────────────
  const reset = useCallback(() => {
    stepsRef.current = [];
    stepIndexRef.current = 0;
    satisfiedRef.current = new Set();
    sessionLogRef.current = [];
    heldNotesRef.current = new Set();

    setPracticeTime(0);
    setCurrentStepIndex(0);
    setExpectedMidis(new Set());
    setSatisfiedMidis(new Set());
    setWrongNote(null);
    setSessionLog([]);
    setError(null);
    setHeldNotes(new Set());
    setStatus("idle");
    statusRef.current = "idle";
  }, []);

  return {
    state: {
      status,
      practiceTime,
      currentStepIndex,
      totalSteps: stepsRef.current.length,
      expectedMidis,
      satisfiedMidis,
      wrongNote,
      midiDevices,
      activeDevice,
      sessionLog,
      isComplete: status === "complete",
      error,
      heldNotes,
    } satisfies PracticeModeState,
    controls: {
      start,
      reset,
      setActiveDevice,
    } satisfies PracticeModeControls,
    stepsRef,
  };
}
