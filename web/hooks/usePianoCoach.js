import { useState, useEffect, useRef, useCallback } from "react";
import { Midi } from "@tonejs/midi";

const NOTE_NAMES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
function midiNoteToName(midi) {
  const octave = Math.floor(midi / 12) - 1;
  return `${NOTE_NAMES[midi % 12]}${octave}`;
}

function extractReferenceNotes(midi) {
  const notes = [];
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

function comparePerformance(played, reference) {
  const refByMidi = {};
  for (const n of reference) {
    if (!refByMidi[n.midi]) refByMidi[n.midi] = [];
    refByMidi[n.midi].push(n);
  }
  const playedByMidi = {};
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
  const timingErrors = [];
  const commonMidis = [...refMidis].filter((m) => playedMidis.has(m));
  for (const midi of commonMidis) {
    const refNotes = refByMidi[midi];
    const playedNotes = playedByMidi[midi];
    const count = Math.min(refNotes.length, playedNotes.length);
    for (let i = 0; i < count; i++) {
      const expectedMs = refNotes[i].timeMs - refStartMs;
      const actualMs = playedNotes[i].offsetMs - playedStartMs;
      const diffMs = actualMs - expectedMs;
      if (Math.abs(diffMs) > 150) {
        timingErrors.push({ note: midiNoteToName(midi), diffMs, direction: diffMs > 0 ? "late" : "early" });
      }
    }
  }
  const correctCount = reference.filter((n) => playedMidis.has(n.midi)).length;
  const accuracy = Math.round((correctCount / reference.length) * 100);
  return { missingNotes, extraNotes, timingErrors, accuracy };
}

function buildPrompt(played, reference, comparison, scoreTitle, userContext) {
  const { missingNotes, extraNotes, timingErrors, accuracy } = comparison;
  return `You are an encouraging but precise piano coach. A student just finished playing "${scoreTitle}".

Performance accuracy: ${accuracy}% of reference notes played correctly.
Notes missing (in score but not played): ${missingNotes.length ? missingNotes.join(", ") : "none"}
Extra notes (played but not in score): ${extraNotes.length ? extraNotes.join(", ") : "none"}
Timing errors (> 150ms off): ${timingErrors.length ? timingErrors.map((e) => `${e.note} was ${Math.abs(e.diffMs)}ms ${e.direction}`).join(", ") : "none detected"}
Average velocity (dynamics): ${Math.round(played.reduce((s, n) => s + n.velocity, 0) / played.length)}/127
Total notes played: ${played.length} (reference has ${reference.length})
${userContext ? `\nStudent note: ${userContext}` : ""}

Give concise, specific feedback in 3 short paragraphs:
1. Note accuracy — which sections or specific notes need attention
2. Timing & rhythm observations
3. One concrete thing to focus on in the next practice session

Be warm but precise. Use musical terminology naturally.`;
}

export function usePianoCoach({ onFeedback } = {}) {
  const [status, setStatus] = useState("idle");
  const [midiDevices, setMidiDevices] = useState([]);
  const [activeDevice, setActiveDevice] = useState(null);
  const [scores, setScores] = useState([]);
  const [selectedScore, setSelectedScore] = useState(null);
  const [referenceNotes, setReferenceNotes] = useState(null);
  const [loadingScore, setLoadingScore] = useState(false);
  const [recordedNotes, setRecordedNotes] = useState([]);
  const [feedback, setFeedback] = useState(null);
  const [error, setError] = useState(null);

  const noteOnMap = useRef({});
  const capturedEvents = useRef([]);
  const isRecording = useRef(false);

  useEffect(() => {
    fetch("/api/scores")
      .then((r) => r.json())
      .then((data) => setScores(Array.isArray(data) ? data : []))
      .catch(() => setError("Failed to load scores from database."));
  }, []);

  useEffect(() => {
    if (!selectedScore) return;
    setLoadingScore(true);
    setReferenceNotes(null);
    setError(null);
    fetch(`/api/scores/${selectedScore.id}`)
      .then((r) => r.json())
      .then((data) => {
        const binary = atob(data.midi_base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const midi = new Midi(bytes.buffer);
        setReferenceNotes(extractReferenceNotes(midi));
      })
      .catch(() => setError("Failed to load MIDI file."))
      .finally(() => setLoadingScore(false));
  }, [selectedScore]);

  useEffect(() => {
    if (!navigator.requestMIDIAccess) { setError("Web MIDI API not supported."); return; }
    let midiAccess;
    navigator.requestMIDIAccess().then((access) => {
      midiAccess = access;
      refreshDevices(access);
      access.onstatechange = () => refreshDevices(access);
    }).catch(() => setError("MIDI access denied."));
    return () => { if (midiAccess) for (const i of midiAccess.inputs.values()) i.onmidimessage = null; };
  }, []);

  function refreshDevices(access) {
    const devices = Array.from(access.inputs.values()).map((i) => ({ id: i.id, name: i.name, ref: i }));
    setMidiDevices(devices);
    if (devices.length > 0) setActiveDevice((prev) => prev ?? devices[0].id);
  }

  useEffect(() => {
    if (!activeDevice || !midiDevices.length) return;
    midiDevices.forEach((d) => { d.ref.onmidimessage = null; });
    const device = midiDevices.find((d) => d.id === activeDevice);
    if (!device) return;
    device.ref.onmidimessage = (msg) => {
      if (!isRecording.current) return;
      const [status, midi, velocity] = msg.data;
      const type = status & 0xf0;
      if (type === 0x90 && velocity > 0) {
        noteOnMap.current[midi] = { time: performance.now(), velocity };
      } else if (type === 0x80 || (type === 0x90 && velocity === 0)) {
        const on = noteOnMap.current[midi];
        if (on) {
          const startTime = capturedEvents.current[0]?.time ?? on.time;
          capturedEvents.current.push({ midi, velocity: on.velocity, time: on.time, offsetMs: Math.round(on.time - startTime), duration: performance.now() - on.time });
          delete noteOnMap.current[midi];
        }
      }
    };
  }, [activeDevice, midiDevices]);

  const startRecording = useCallback(() => {
    capturedEvents.current = []; noteOnMap.current = {}; isRecording.current = true;
    setRecordedNotes([]); setFeedback(null); setError(null); setStatus("recording");
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
    if (!events.length) { setError("No notes recorded."); return; }
    if (!referenceNotes) { setError("No reference score loaded."); return; }
    const comparison = comparePerformance(events, referenceNotes);
    const prompt = buildPrompt(events, referenceNotes, comparison, selectedScore.title, userContext);
    setStatus("fetching"); setError(null);
    try {
      const response = await fetch("/api/piano-feedback", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      if (!response.ok) throw new Error(`API error ${response.status}`);
      const data = await response.json();
      const text = (data.text ?? "").trim();
      setFeedback(text); setStatus("done");
      onFeedback?.(text, comparison);
    } catch (err) { setError(err.message); setStatus("error"); }
  }, [referenceNotes, selectedScore, onFeedback]);

  const reset = useCallback(() => {
    capturedEvents.current = []; noteOnMap.current = {}; isRecording.current = false;
    setRecordedNotes([]); setFeedback(null); setError(null); setStatus("idle");
  }, []);

  return { status, midiDevices, activeDevice, setActiveDevice, scores, selectedScore, setSelectedScore, loadingScore, referenceNotes, recordedNotes, feedback, error, startRecording, stopRecording, getFeedback, reset };
}
