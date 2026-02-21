import { useState, useEffect, useRef, useCallback } from "react";

// --- MIDI note number to name helper ---
const NOTE_NAMES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
function midiNoteToName(midi) {
  const octave = Math.floor(midi / 12) - 1;
  return `${NOTE_NAMES[midi % 12]}${octave}`;
}

// --- Quantise timing to nearest 16th note (ms) for readability ---
function summarisePerformance(events) {
  if (!events.length) return null;

  const startTime = events[0].time;
  const notes = events.map((e) => ({
    note: midiNoteToName(e.midi),
    midi: e.midi,
    velocity: e.velocity,
    offsetMs: Math.round(e.time - startTime),
    durationMs: Math.round(e.duration),
  }));

  const avgVelocity = Math.round(
    notes.reduce((s, n) => s + n.velocity, 0) / notes.length
  );

  // Detect large timing gaps (possible hesitations)
  const gaps = [];
  for (let i = 1; i < notes.length; i++) {
    const gap = notes[i].offsetMs - notes[i - 1].offsetMs;
    if (gap > 600) gaps.push({ afterNote: notes[i - 1].note, gapMs: gap });
  }

  return { notes, avgVelocity, gaps, totalDurationMs: notes.at(-1)?.offsetMs ?? 0 };
}

// --- Build the prompt sent to Claude ---
function buildPrompt(summary, userContext) {
  return `You are an encouraging but precise piano coach. A student just finished playing.

Performance data:
- Total notes played: ${summary.notes.length}
- Average velocity (dynamics): ${summary.avgVelocity}/127
- Total duration: ${(summary.totalDurationMs / 1000).toFixed(1)}s
- Hesitations (gaps > 600ms): ${
    summary.gaps.length
      ? summary.gaps.map((g) => `after ${g.afterNote} (${g.gapMs}ms)`).join(", ")
      : "none detected"
  }
- Note sequence: ${summary.notes.map((n) => `${n.note}(vel:${n.velocity},dur:${n.durationMs}ms)`).join(" → ")}
${userContext ? `\nStudent note: ${userContext}` : ""}

Give concise, specific feedback in 3 short paragraphs:
1. Timing & rhythm observations
2. Dynamics & expression
3. One concrete thing to work on next practice

Be warm but precise. Use musical terminology naturally.`;
}

// ─────────────────────────────────────────────
export function usePianoCoach({ onFeedback } = {}) {
  const [status, setStatus] = useState("idle"); // idle | waiting_midi | recording | fetching | done | error
  const [midiDevices, setMidiDevices] = useState([]);
  const [activeDevice, setActiveDevice] = useState(null);
  const [recordedNotes, setRecordedNotes] = useState([]);
  const [feedback, setFeedback] = useState(null);
  const [error, setError] = useState(null);

  // Refs so event handlers always see current values
  const noteOnMap = useRef({}); // midi -> { time, velocity }
  const capturedEvents = useRef([]);
  const isRecording = useRef(false);

  // ── MIDI Setup ──────────────────────────────
  useEffect(() => {
    if (!navigator.requestMIDIAccess) {
      setError("Web MIDI API not supported in this browser.");
      return;
    }

    let midiAccess;

    navigator.requestMIDIAccess().then((access) => {
      midiAccess = access;
      refreshDevices(access);

      access.onstatechange = () => refreshDevices(access);
    }).catch(() => {
      setError("MIDI access denied. Please allow MIDI in your browser settings.");
    });

    return () => {
      if (midiAccess) {
        for (const input of midiAccess.inputs.values()) {
          input.onmidimessage = null;
        }
      }
    };
  }, []);

  function refreshDevices(access) {
    const devices = Array.from(access.inputs.values()).map((i) => ({
      id: i.id,
      name: i.name,
      ref: i,
    }));
    setMidiDevices(devices);

    // Auto-select first device
    if (devices.length > 0) {
      setActiveDevice((prev) => prev ?? devices[0].id);
      setStatus((prev) => (prev === "idle" ? "waiting_midi" : prev));
    }
  }

  // ── Attach MIDI listener to selected device ──
  useEffect(() => {
    if (!activeDevice || !midiDevices.length) return;

    // Remove old listeners
    midiDevices.forEach((d) => { d.ref.onmidimessage = null; });

    const device = midiDevices.find((d) => d.id === activeDevice);
    if (!device) return;

    device.ref.onmidimessage = (msg) => {
      if (!isRecording.current) return;

      const [status, midi, velocity] = msg.data;
      const type = status & 0xf0;

      if (type === 0x90 && velocity > 0) {
        // Note On
        noteOnMap.current[midi] = { time: performance.now(), velocity };
      } else if (type === 0x80 || (type === 0x90 && velocity === 0)) {
        // Note Off
        const on = noteOnMap.current[midi];
        if (on) {
          capturedEvents.current.push({
            midi,
            velocity: on.velocity,
            time: on.time,
            duration: performance.now() - on.time,
          });
          delete noteOnMap.current[midi];
        }
      }
    };
  }, [activeDevice, midiDevices]);

  // ── Controls ─────────────────────────────────
  const startRecording = useCallback(() => {
    capturedEvents.current = [];
    noteOnMap.current = {};
    isRecording.current = true;
    setRecordedNotes([]);
    setFeedback(null);
    setError(null);
    setStatus("recording");
  }, []);

  const stopRecording = useCallback(() => {
    isRecording.current = false;
    const events = [...capturedEvents.current];
    setRecordedNotes(events);
    setStatus(events.length > 0 ? "done_recording" : "idle");
    return events;
  }, []);

  const getFeedback = useCallback(async (userContext = "") => {
    const events = capturedEvents.current;
    if (!events.length) {
      setError("No notes recorded.");
      return;
    }

    const summary = summarisePerformance(events);
    if (!summary) return;

    setStatus("fetching");
    setError(null);

    try {
      const response = await fetch("/api/piano-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: buildPrompt(summary, userContext) }),
      });

      if (!response.ok) throw new Error(`API error ${response.status}`);

      const data = await response.json();
      const text = data.content?.map((b) => b.text).join("") ?? "";
      setFeedback(text);
      setStatus("done");
      onFeedback?.(text, summary);
    } catch (err) {
      setError(err.message);
      setStatus("error");
    }
  }, [onFeedback]);

  const reset = useCallback(() => {
    capturedEvents.current = [];
    noteOnMap.current = {};
    isRecording.current = false;
    setRecordedNotes([]);
    setFeedback(null);
    setError(null);
    setStatus(midiDevices.length ? "waiting_midi" : "idle");
  }, [midiDevices.length]);

  return {
    status,
    midiDevices,
    activeDevice,
    setActiveDevice,
    recordedNotes,
    feedback,
    error,
    startRecording,
    stopRecording,
    getFeedback,
    reset,
  };
}
