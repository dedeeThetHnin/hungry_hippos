"use client";

import { Suspense } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Loader2, Music, Piano } from "lucide-react";
import { SakuraBackground } from "@/components/SakuraBackground";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AudioPlayerTab } from "@/components/AudioPlayerTab";
import { FallingNotesTab } from "@/components/FallingNotesTab";
import { useMidiPlayer } from "@/lib/hooks/useMidiPlayer";

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
  const { state, controls } = useMidiPlayer(id);
  const { loadState, error, title, bpm, noteCount, trackCount, duration } = state;
  const { formatTime } = controls;

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

        {/* Tabs */}
        {loadState === "ready" && (
          <Tabs defaultValue="falling-notes" className="w-full">
            <TabsList className="w-full justify-center bg-pink-50/80 border border-pink-100 rounded-xl p-1">
              <TabsTrigger
                value="falling-notes"
                className="flex-1 gap-1.5 rounded-lg data-[state=active]:bg-white data-[state=active]:text-pink-600 data-[state=active]:shadow-sm text-slate-500 transition-all text-sm"
              >
                <Piano className="w-4 h-4" />
                Falling Notes
              </TabsTrigger>
              <TabsTrigger
                value="audio-player"
                className="flex-1 gap-1.5 rounded-lg data-[state=active]:bg-white data-[state=active]:text-pink-600 data-[state=active]:shadow-sm text-slate-500 transition-all text-sm"
              >
                <Music className="w-4 h-4" />
                Audio Player
              </TabsTrigger>
            </TabsList>

            <TabsContent value="falling-notes" className="mt-6">
              <FallingNotesTab state={state} controls={controls} />
            </TabsContent>

            <TabsContent value="audio-player" className="mt-6">
              <AudioPlayerTab state={state} controls={controls} />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}
