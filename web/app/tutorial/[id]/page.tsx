"use client";

import {
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Play, Pause, Square, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { SakuraBackground } from "@/components/SakuraBackground";
import { Midi } from "@tonejs/midi";
import * as Tone from "tone";

type LoadState = "loading" | "ready" | "error";

export default function TutorialPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen w-full bg-[#FFF6EB] flex items-center justify-center">
          <Loader2 className="w-10 h-10 text-pink-400 animate-spin" />
        </div>
      }
    >
      <TutorialContent />
    </Suspense>
  );
}

function TutorialContent() {
  const { id } = useParams<{ id: string }>();
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
        // 1. Fetch file_url from scores table
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

        // 2. Fetch the MIDI file
        const res = await fetch(data.file_url);
        if (!res.ok) {
          setError("Failed to download MIDI file.");
          setLoadState("error");
          return;
        }

        const arrayBuf = await res.arrayBuffer();
        const midi = new Midi(arrayBuf);
        midiRef.current = midi;

        // Extract metadata
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

        // 3. Create piano sampler
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
          baseUrl:
            "https://tonejs.github.io/audio/salamander/",
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

  const togglePlayback = useCallback(async () => {
    const transport = Tone.getTransport();

    if (isPlaying) {
      // Pause
      transport.pause();
      setIsPlaying(false);
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
        progressInterval.current = null;
      }
      return;
    }

    // Start audio context (required by browsers)
    await Tone.start();

    const midi = midiRef.current;
    const sampler = samplerRef.current;
    if (!midi || !sampler) return;

    // If transport was paused (position > 0), resume
    if (transport.state === "paused") {
      transport.start();
      setIsPlaying(true);
      startProgressTracking();
      return;
    }

    // Fresh start — schedule all notes
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
          // Update active notes for visual feedback
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

    // Auto-stop at end
    transport.schedule(() => {
      stopPlayback();
    }, duration + 1);

    transport.start();
    setIsPlaying(true);
    startProgressTracking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, duration, stopPlayback]);

  function startProgressTracking() {
    if (progressInterval.current) clearInterval(progressInterval.current);
    progressInterval.current = setInterval(() => {
      const transport = Tone.getTransport();
      setProgress(transport.seconds);
    }, 100);
  }

  function formatTime(seconds: number) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  // ─── Render ─────────────────────────────────────────────
  if (loadState === "error") {
    return (
      <div className="relative min-h-screen w-full bg-[#FFF6EB] flex flex-col items-center justify-center p-6">
        <div className="absolute inset-0 z-0 pointer-events-none">
          <SakuraBackground />
        </div>
        <div className="z-10 bg-white/70 backdrop-blur-md rounded-3xl border border-pink-100 p-10 max-w-md text-center space-y-4">
          <h1 className="text-2xl font-serif text-[#2D3142]">Error</h1>
          <p className="text-slate-500">{error}</p>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-pink-400 hover:text-pink-500 transition-colors font-medium text-sm"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen w-full bg-[#FFF6EB] flex flex-col items-center overflow-hidden p-6">
      <div className="absolute inset-0 z-0 pointer-events-none">
        <SakuraBackground />
      </div>

      {/* Header */}
      <div className="z-10 w-full max-w-3xl">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 mb-6 text-slate-400 hover:text-pink-400 transition-colors font-medium text-sm group"
        >
          <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          Back to My Sonatas
        </Link>
      </div>

      {/* Main Card */}
      <div className="z-10 w-full max-w-3xl bg-white/70 backdrop-blur-md rounded-3xl border border-pink-100 p-8 md:p-10 space-y-8">
        {/* Title & metadata */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl md:text-4xl font-serif text-[#2D3142]">
            {title || "Loading…"}
          </h1>
          {loadState === "ready" && (
            <p className="text-sm text-slate-400">
              {trackCount} track{trackCount !== 1 && "s"} · {noteCount} notes ·{" "}
              {bpm} BPM · {formatTime(duration)}
            </p>
          )}
        </div>

        {/* Loading indicator */}
        {loadState === "loading" && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="w-10 h-10 text-pink-400 animate-spin" />
            <p className="text-slate-400 text-sm">
              Loading piano samples…
            </p>
          </div>
        )}

        {/* Player controls */}
        {loadState === "ready" && (
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
        )}
      </div>
    </div>
  );
}
