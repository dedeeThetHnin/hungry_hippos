"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Midi } from "@tonejs/midi";
import * as Tone from "tone";

export type LoadState = "loading" | "ready" | "error";

export interface NoteEvent {
  time: number;
  duration: number;
  midi: number;
  name: string;
  velocity: number;
}

export interface MidiPlayerState {
  loadState: LoadState;
  error: string;
  title: string;
  isPlaying: boolean;
  progress: number;
  duration: number;
  bpm: number;
  noteCount: number;
  trackCount: number;
  activeNotes: string[];
}

export interface MidiPlayerControls {
  togglePlayback: () => Promise<void>;
  stopPlayback: () => void;
  seekTo: (time: number) => void;
  skip: (seconds: number) => void;
  formatTime: (seconds: number) => string;
  getAllNotes: () => NoteEvent[];
}

export interface MidiPlayerRefs {
  midiRef: React.RefObject<Midi | null>;
  samplerRef: React.RefObject<Tone.Sampler | null>;
}

export function useMidiPlayer(id: string | undefined) {
  const supabase = useMemo(() => createClient(), []);

  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bpm, setBpm] = useState(120);
  const [noteCount, setNoteCount] = useState(0);
  const [trackCount, setTrackCount] = useState(0);
  const [activeNotes, setActiveNotes] = useState<string[]>([]);

  const samplerRef = useRef<Tone.Sampler | null>(null);
  const partsRef = useRef<Tone.Part[]>([]);
  const progressInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const midiRef = useRef<Midi | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      stopPlayback();
      samplerRef.current?.dispose();
      partsRef.current.forEach((p) => p.dispose());
      Tone.getTransport().cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch score and MIDI file on mount
  useEffect(() => {
    if (!id) return;

    async function load() {
      try {
        const { data, error: dbErr } = await supabase
          .from("scores")
          .select("file_url, title")
          .eq("id", id)
          .single();

        if (dbErr || !data) {
          setError("Score not found.");
          setLoadState("error");
          return;
        }

        setTitle(data.title ?? "Untitled");

        const res = await fetch(data.file_url);
        if (!res.ok) {
          setError("Failed to download MIDI file.");
          setLoadState("error");
          return;
        }

        const arrayBuf = await res.arrayBuffer();
        const midi = new Midi(arrayBuf);
        midiRef.current = midi;

        const tempos = midi.header.tempos;
        if (tempos.length > 0) {
          setBpm(Math.round(tempos[0].bpm));
        }

        let totalNotes = 0;
        let maxEnd = 0;
        midi.tracks.forEach((track) => {
          totalNotes += track.notes.length;
          track.notes.forEach((n) => {
            const end = n.time + n.duration;
            if (end > maxEnd) maxEnd = end;
          });
        });

        setNoteCount(totalNotes);
        setTrackCount(midi.tracks.filter((t) => t.notes.length > 0).length);
        setDuration(maxEnd);

        const sampler = new Tone.Sampler({
          urls: {
            A0: "A0.mp3",
            C1: "C1.mp3",
            "D#1": "Ds1.mp3",
            "F#1": "Fs1.mp3",
            A1: "A1.mp3",
            C2: "C2.mp3",
            "D#2": "Ds2.mp3",
            "F#2": "Fs2.mp3",
            A2: "A2.mp3",
            C3: "C3.mp3",
            "D#3": "Ds3.mp3",
            "F#3": "Fs3.mp3",
            A3: "A3.mp3",
            C4: "C4.mp3",
            "D#4": "Ds4.mp3",
            "F#4": "Fs4.mp3",
            A4: "A4.mp3",
            C5: "C5.mp3",
            "D#5": "Ds5.mp3",
            "F#5": "Fs5.mp3",
            A5: "A5.mp3",
            C6: "C6.mp3",
            "D#6": "Ds6.mp3",
            "F#6": "Fs6.mp3",
            A6: "A6.mp3",
            C7: "C7.mp3",
            "D#7": "Ds7.mp3",
            "F#7": "Fs7.mp3",
            A7: "A7.mp3",
            C8: "C8.mp3",
          },
          release: 1,
          baseUrl: "https://tonejs.github.io/audio/salamander/",
          onload: () => {
            setLoadState("ready");
          },
          onerror: () => {
            setError("Failed to load piano samples.");
            setLoadState("error");
          },
        }).toDestination();

        samplerRef.current = sampler;
      } catch (e: any) {
        setError(e?.message ?? "Failed to load tutorial.");
        setLoadState("error");
      }
    }

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const stopPlayback = useCallback(() => {
    const transport = Tone.getTransport();
    transport.stop();
    transport.cancel();
    transport.position = 0;
    partsRef.current.forEach((p) => p.dispose());
    partsRef.current = [];
    setIsPlaying(false);
    setProgress(0);
    setActiveNotes([]);
    if (progressInterval.current) {
      clearInterval(progressInterval.current);
      progressInterval.current = null;
    }
  }, []);

  function startProgressTracking() {
    if (progressInterval.current) clearInterval(progressInterval.current);
    progressInterval.current = setInterval(() => {
      const transport = Tone.getTransport();
      setProgress(transport.seconds);
    }, 100);
  }

  /**
   * Re-schedule all MIDI parts from a given time offset.
   * The transport should be stopped/paused before calling this.
   */
  function rescheduleFrom(time: number) {
    const midi = midiRef.current;
    const sampler = samplerRef.current;
    if (!midi || !sampler) return;

    const transport = Tone.getTransport();
    transport.cancel();
    partsRef.current.forEach((p) => p.dispose());
    partsRef.current = [];

    midi.tracks.forEach((track) => {
      if (track.notes.length === 0) return;

      const part = new Tone.Part(
        (t, note: { name: string; duration: number; velocity: number }) => {
          sampler.triggerAttackRelease(
            note.name,
            note.duration,
            t,
            note.velocity
          );
          setActiveNotes((prev) => [...new Set([...prev, note.name])]);
          setTimeout(() => {
            setActiveNotes((prev) => prev.filter((n) => n !== note.name));
          }, note.duration * 1000);
        },
        track.notes.map((n) => ({
          time: n.time,
          name: n.name,
          duration: n.duration,
          velocity: n.velocity,
        }))
      );

      part.start(0);
      partsRef.current.push(part);
    });

    transport.schedule(() => {
      stopPlayback();
    }, duration + 1);
  }

  const seekTo = useCallback(
    (time: number) => {
      const clamped = Math.max(0, Math.min(time, duration));
      const transport = Tone.getTransport();
      const wasPlaying = transport.state === "started";

      // Release any ringing notes
      samplerRef.current?.releaseAll();
      setActiveNotes([]);

      transport.pause();
      rescheduleFrom(clamped);
      transport.seconds = clamped;
      setProgress(clamped);

      if (wasPlaying) {
        transport.start();
        startProgressTracking();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [duration, stopPlayback]
  );

  const skip = useCallback(
    (seconds: number) => {
      const transport = Tone.getTransport();
      const newTime = transport.seconds + seconds;
      seekTo(newTime);
    },
    [seekTo]
  );

  const togglePlayback = useCallback(async () => {
    const transport = Tone.getTransport();

    if (isPlaying) {
      transport.pause();
      setIsPlaying(false);
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
        progressInterval.current = null;
      }
      return;
    }

    await Tone.start();

    const midi = midiRef.current;
    const sampler = samplerRef.current;
    if (!midi || !sampler) return;

    if (transport.state === "paused") {
      transport.start();
      setIsPlaying(true);
      startProgressTracking();
      return;
    }

    transport.cancel();
    partsRef.current.forEach((p) => p.dispose());
    partsRef.current = [];
    transport.position = 0;

    midi.tracks.forEach((track) => {
      if (track.notes.length === 0) return;

      const part = new Tone.Part(
        (time, note: { name: string; duration: number; velocity: number }) => {
          sampler.triggerAttackRelease(
            note.name,
            note.duration,
            time,
            note.velocity
          );
          setActiveNotes((prev) => [...new Set([...prev, note.name])]);
          setTimeout(() => {
            setActiveNotes((prev) => prev.filter((n) => n !== note.name));
          }, note.duration * 1000);
        },
        track.notes.map((n) => ({
          time: n.time,
          name: n.name,
          duration: n.duration,
          velocity: n.velocity,
        }))
      );

      part.start(0);
      partsRef.current.push(part);
    });

    transport.schedule(() => {
      stopPlayback();
    }, duration + 1);

    transport.start();
    setIsPlaying(true);
    startProgressTracking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, duration, stopPlayback]);

  const formatTime = useCallback((seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  }, []);

  const getAllNotes = useCallback((): NoteEvent[] => {
    const midi = midiRef.current;
    if (!midi) return [];
    const notes: NoteEvent[] = [];
    midi.tracks.forEach((track) => {
      track.notes.forEach((n) => {
        notes.push({
          time: n.time,
          duration: n.duration,
          midi: n.midi,
          name: n.name,
          velocity: n.velocity,
        });
      });
    });
    return notes;
  }, []);

  return {
    state: {
      loadState,
      error,
      title,
      isPlaying,
      progress,
      duration,
      bpm,
      noteCount,
      trackCount,
      activeNotes,
    },
    controls: {
      togglePlayback,
      stopPlayback,
      seekTo,
      skip,
      formatTime,
      getAllNotes,
    },
    refs: {
      midiRef,
      samplerRef,
    },
  };
}
