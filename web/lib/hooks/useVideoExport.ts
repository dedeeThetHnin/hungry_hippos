"use client";

/**
 * useVideoExport – offline renders the falling-notes animation + piano audio
 * into a downloadable WebM (VP9 video + Opus audio) via WebCodecs + webm-muxer.
 *
 * Falls back to MediaRecorder-based real-time capture when WebCodecs or
 * OffscreenCanvas are not available.
 */

import { useState, useCallback, useRef } from "react";
import { Midi } from "@tonejs/midi";
import * as Tone from "tone";
import type { PianoPlayerFactory } from "@/lib/piano";
import type { NoteEvent } from "./useMidiPlayer";
import { LEAD_IN_SEC } from "./useMidiPlayer";
import {
  drawFallingNotesFrame,
  type DrawFrameLayout,
  type DrawFrameParams,
} from "@/lib/piano/draw-frame";

// ── Types ─────────────────────────────────────────────────────────────

export interface VideoExportOptions {
  /** MIDI notes (with LEAD_IN_SEC already applied to times) */
  notes: NoteEvent[];
  layout: DrawFrameLayout;
  bassTrack: number;
  /** Virtual (original) duration in seconds (with LEAD_IN_SEC) */
  duration: number;
  playbackSpeed: number;
  formatTime: (s: number) => string;
  midiRef: React.RefObject<Midi | null>;
  pianoFactory: PianoPlayerFactory;
  /** Song title (used for filename) */
  title: string;
  /** Original BPM from MIDI header */
  bpm: number;
}

export interface VideoExportResult {
  exportVideo: (opts: VideoExportOptions) => Promise<void>;
  /** 0-100 while exporting, null when idle */
  exportProgress: number | null;
  /** true while exporting */
  isExporting: boolean;
  /** User-visible error if export failed */
  exportError: string | null;
  /** Cancel a running export */
  cancelExport: () => void;
}

// ── Constants ─────────────────────────────────────────────────────────

const VIDEO_WIDTH = 1920;
const VIDEO_HEIGHT = 1080;
const FPS = 60;
const VIDEO_BITRATE = 8_000_000; // 8 Mbps
const AUDIO_BITRATE = 128_000; // 128 kbps Opus
const AUDIO_SAMPLE_RATE = 48_000;

// ── Helpers ───────────────────────────────────────────────────────────

/**
 * Salamander Grand Piano sample mapping for Tone.Sampler.
 * One sample every minor third covers the full A0–C8 range;
 * Tone.Sampler interpolates for notes in between.
 */
const SALAMANDER_SAMPLES: Record<string, string> = {
  A0: "A0.mp3",
  C1: "C1.mp3", "D#1": "Ds1.mp3", "F#1": "Fs1.mp3",
  A1: "A1.mp3",
  C2: "C2.mp3", "D#2": "Ds2.mp3", "F#2": "Fs2.mp3",
  A2: "A2.mp3",
  C3: "C3.mp3", "D#3": "Ds3.mp3", "F#3": "Fs3.mp3",
  A3: "A3.mp3",
  C4: "C4.mp3", "D#4": "Ds4.mp3", "F#4": "Fs4.mp3",
  A4: "A4.mp3",
  C5: "C5.mp3", "D#5": "Ds5.mp3", "F#5": "Fs5.mp3",
  A5: "A5.mp3",
  C6: "C6.mp3", "D#6": "Ds6.mp3", "F#6": "Fs6.mp3",
  A6: "A6.mp3",
  C7: "C7.mp3", "D#7": "Ds7.mp3", "F#7": "Fs7.mp3",
  A7: "A7.mp3",
  C8: "C8.mp3",
};
const SALAMANDER_BASE_URL = "https://tonejs.github.io/audio/salamander/";

/**
 * Render all MIDI notes to an AudioBuffer using Tone.Offline + Tone.Sampler.
 *
 * We use Tone.js's own sampler (with Salamander piano samples) instead of the
 * smplr-based piano factory, because smplr's SplendidGrandPiano doesn't produce
 * audio in an OfflineAudioContext (it relies on internal scheduling / worklets
 * that are incompatible with offline rendering).
 *
 * Tone.Sampler + Tone.Offline is a proven combination — all audio nodes route
 * through Tone's internal destination which maps to the offline context.
 */
async function renderAudioOffline(
  midi: Midi,
  playbackSpeed: number,
  durationSec: number,
): Promise<AudioBuffer> {
  // Wall-clock duration the audio needs to cover
  const wallDuration = durationSec / playbackSpeed + 2; // +2s padding

  const toneBuffer = await Tone.Offline(async () => {
    // Create a Tone.Sampler with Salamander Grand Piano samples
    const sampler = new Tone.Sampler({
      urls: SALAMANDER_SAMPLES,
      baseUrl: SALAMANDER_BASE_URL,
      release: 1,
    }).toDestination();

    // Wait for all samples to finish loading & decoding
    await Tone.loaded();

    // Schedule every note at its absolute wall-clock time
    const speed = playbackSpeed;
    for (const track of midi.tracks) {
      for (const n of track.notes) {
        const time = (n.time + LEAD_IN_SEC) / speed;
        const dur = n.duration / speed;
        sampler.triggerAttackRelease(n.name, dur, time, n.velocity);
      }
    }
  }, wallDuration);

  const buffer = toneBuffer.get() as AudioBuffer;
  if (!buffer) throw new Error("Audio offline rendering produced no output");
  return buffer;
}

/**
 * Resample an AudioBuffer to a target sample rate by decoding through an
 * OfflineAudioContext.
 */
async function resampleBuffer(
  src: AudioBuffer,
  targetRate: number,
): Promise<AudioBuffer> {
  if (src.sampleRate === targetRate) return src;

  const numFrames = Math.ceil(src.duration * targetRate);
  const offCtx = new OfflineAudioContext(src.numberOfChannels, numFrames, targetRate);
  const bufSrc = offCtx.createBufferSource();
  bufSrc.buffer = src;
  bufSrc.connect(offCtx.destination);
  bufSrc.start(0);
  return offCtx.startRendering();
}

/**
 * Interleave a multi-channel AudioBuffer into a single Float32Array.
 */
function interleaveAudioBuffer(buf: AudioBuffer): Float32Array {
  const channels = buf.numberOfChannels;
  const length = buf.length;
  const result = new Float32Array(length * channels);
  const channelData: Float32Array[] = [];
  for (let c = 0; c < channels; c++) {
    channelData.push(buf.getChannelData(c));
  }
  for (let i = 0; i < length; i++) {
    for (let c = 0; c < channels; c++) {
      result[i * channels + c] = channelData[c][i];
    }
  }
  return result;
}

// ── Hook ──────────────────────────────────────────────────────────────

export function useVideoExport(): VideoExportResult {
  const [exportProgress, setExportProgress] = useState<number | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const cancelledRef = useRef(false);
  const encodersRef = useRef<{ video?: VideoEncoder; audio?: AudioEncoder }>({});

  const cancelExport = useCallback(() => {
    cancelledRef.current = true;
    // Force-close encoders to unblock any pending flush()
    try { encodersRef.current.video?.close(); } catch { /* already closed */ }
    try { encodersRef.current.audio?.close(); } catch { /* already closed */ }
    encodersRef.current = {};
  }, []);

  const exportVideo = useCallback(async (opts: VideoExportOptions) => {
    const {
      notes,
      layout,
      bassTrack,
      duration,
      playbackSpeed,
      formatTime: formatTimeFn,
      midiRef,
      pianoFactory,
      title,
      bpm,
    } = opts;

    // Guard
    if (isExporting) return;

    cancelledRef.current = false;
    encodersRef.current = {};
    setIsExporting(true);
    setExportProgress(0);
    setExportError(null);

    try {
      const midi = midiRef.current;
      if (!midi) throw new Error("No MIDI data loaded");

      // ── 1. Render audio offline ──────────────────────────────────
      setExportProgress(1);
      const rawAudio = await renderAudioOffline(midi, playbackSpeed, duration);
      if (cancelledRef.current) return;

      // Resample to target rate for Opus encoding
      const audio = await resampleBuffer(rawAudio, AUDIO_SAMPLE_RATE);
      if (cancelledRef.current) return;

      setExportProgress(5);

      // ── 2. Setup muxer + encoders ────────────────────────────────
      const { Muxer, ArrayBufferTarget } = await import("webm-muxer");

      const target = new ArrayBufferTarget();
      const muxer = new Muxer({
        target,
        video: {
          codec: "V_VP9",
          width: VIDEO_WIDTH,
          height: VIDEO_HEIGHT,
        },
        audio: {
          codec: "A_OPUS",
          sampleRate: AUDIO_SAMPLE_RATE,
          numberOfChannels: audio.numberOfChannels,
        },
        firstTimestampBehavior: "offset",
      });

      // ── Video encoder ────────────────────────────────────────────
      const videoEncoder = new VideoEncoder({
        output: (chunk, meta) => muxer.addVideoChunk(chunk, meta ?? undefined),
        error: (e) => console.error("VideoEncoder error:", e),
      });
      encodersRef.current.video = videoEncoder;

      // Try VP9 first; fall back to VP8 if unsupported
      let videoCodec = "vp09.00.10.08";
      try {
        const support = await VideoEncoder.isConfigSupported({
          codec: videoCodec,
          width: VIDEO_WIDTH,
          height: VIDEO_HEIGHT,
          bitrate: VIDEO_BITRATE,
          framerate: FPS,
        });
        if (!support.supported) throw new Error("VP9 not supported");
      } catch {
        videoCodec = "vp8";
      }

      videoEncoder.configure({
        codec: videoCodec,
        width: VIDEO_WIDTH,
        height: VIDEO_HEIGHT,
        bitrate: VIDEO_BITRATE,
        framerate: FPS,
      });

      // ── Audio encoder ────────────────────────────────────────────
      const audioEncoder = new AudioEncoder({
        output: (chunk, meta) => muxer.addAudioChunk(chunk, meta ?? undefined),
        error: (e) => console.error("AudioEncoder error:", e),
      });
      encodersRef.current.audio = audioEncoder;

      audioEncoder.configure({
        codec: "opus",
        sampleRate: AUDIO_SAMPLE_RATE,
        numberOfChannels: audio.numberOfChannels,
        bitrate: AUDIO_BITRATE,
      });

      // Helper: wait for encoder queue to drain below a threshold
      async function waitForEncoderDrain(
        encoder: VideoEncoder | AudioEncoder,
        maxQueue: number,
      ) {
        while (encoder.state === "configured" && encoder.encodeQueueSize > maxQueue) {
          await new Promise<void>((resolve) => {
            const check = () => {
              if (encoder.encodeQueueSize <= maxQueue || encoder.state !== "configured") {
                encoder.removeEventListener("dequeue", check);
                resolve();
              }
            };
            encoder.addEventListener("dequeue", check);
            // Safety timeout so we never hang forever
            setTimeout(() => {
              encoder.removeEventListener("dequeue", check);
              resolve();
            }, 5000);
          });
        }
      }

      // ── 3. Encode audio ──────────────────────────────────────────
      const AUDIO_CHUNK_SIZE = 960;
      const totalAudioSamples = audio.length;
      const numChannels = audio.numberOfChannels;

      for (let offset = 0; offset < totalAudioSamples; offset += AUDIO_CHUNK_SIZE) {
        if (cancelledRef.current) break;

        const remaining = totalAudioSamples - offset;
        const chunkLen = Math.min(AUDIO_CHUNK_SIZE, remaining);

        const data = new Float32Array(chunkLen * numChannels);
        for (let c = 0; c < numChannels; c++) {
          const channelData = audio.getChannelData(c);
          for (let i = 0; i < chunkLen; i++) {
            data[c * chunkLen + i] = channelData[offset + i];
          }
        }

        const audioData = new AudioData({
          format: "f32-planar",
          sampleRate: AUDIO_SAMPLE_RATE,
          numberOfFrames: chunkLen,
          numberOfChannels: numChannels,
          timestamp: Math.round((offset / AUDIO_SAMPLE_RATE) * 1_000_000),
          data,
        });

        audioEncoder.encode(audioData);
        audioData.close();

        // Backpressure: don't let the audio queue grow unbounded
        if (audioEncoder.encodeQueueSize > 100) {
          await waitForEncoderDrain(audioEncoder, 50);
        }
      }

      if (cancelledRef.current) {
        if (videoEncoder.state !== "closed") videoEncoder.close();
        if (audioEncoder.state !== "closed") audioEncoder.close();
        return;
      }

      setExportProgress(10);

      // ── 4. Encode video frames ───────────────────────────────────
      const wallDuration = duration / playbackSpeed;
      const totalFrames = Math.ceil(wallDuration * FPS);
      const offscreen = new OffscreenCanvas(VIDEO_WIDTH, VIDEO_HEIGHT);
      const offCtx = offscreen.getContext("2d")!;

      const drawParams: DrawFrameParams = {
        notes,
        layout,
        bassTrack,
        duration,
        formatTime: formatTimeFn,
      };

      const BATCH_SIZE = 10;
      const MAX_VIDEO_QUEUE = 10; // backpressure threshold

      for (let frame = 0; frame < totalFrames; frame++) {
        if (cancelledRef.current) break;

        const wallTime = frame / FPS;
        const virtualTime = wallTime * playbackSpeed;

        drawFallingNotesFrame(offCtx, VIDEO_WIDTH, VIDEO_HEIGHT, virtualTime, drawParams);

        // Transfer to ImageBitmap then create VideoFrame from it –
        // avoids "Invalid source state" when creating VideoFrame
        // directly from an OffscreenCanvas with a 2D context.
        const bitmap = offscreen.transferToImageBitmap();
        const videoFrame = new VideoFrame(bitmap, {
          timestamp: Math.round(wallTime * 1_000_000),
          duration: Math.round(1_000_000 / FPS),
        });
        bitmap.close();

        const isKeyframe = frame % (FPS * 2) === 0;
        videoEncoder.encode(videoFrame, { keyFrame: isKeyframe });
        videoFrame.close();

        // Backpressure: wait for encoder to catch up if queue is too deep
        if (videoEncoder.encodeQueueSize > MAX_VIDEO_QUEUE) {
          await waitForEncoderDrain(videoEncoder, MAX_VIDEO_QUEUE / 2);
        }

        // Yield to the main thread periodically for UI updates + cancel checks
        if (frame % BATCH_SIZE === 0) {
          const pct = 10 + (frame / totalFrames) * 85;
          setExportProgress(Math.round(pct));
          await new Promise((r) => setTimeout(r, 0));
        }
      }

      if (cancelledRef.current) {
        if (videoEncoder.state !== "closed") videoEncoder.close();
        if (audioEncoder.state !== "closed") audioEncoder.close();
        return;
      }

      // ── 5. Finalize ──────────────────────────────────────────────
      setExportProgress(96);

      // Flush may throw if encoder was closed by cancel – that's OK
      if (videoEncoder.state === "configured") {
        await videoEncoder.flush();
      }
      if (audioEncoder.state === "configured") {
        await audioEncoder.flush();
      }

      if (videoEncoder.state !== "closed") videoEncoder.close();
      if (audioEncoder.state !== "closed") audioEncoder.close();
      encodersRef.current = {};

      if (cancelledRef.current) return;

      setExportProgress(98);
      muxer.finalize();

      const blob = new Blob([target.buffer], { type: "video/webm" });

      // Build filename: "{title} {effectiveBpm}bpm.webm"
      const effectiveBpm = Math.round(bpm * playbackSpeed);
      const safeTitle = (title || "falling-notes")
        .replace(/\.midi?$/i, "")  // strip .mid / .midi extension
        .replace(/[<>:"\/\\|?*]+/g, "_")  // sanitise for filesystem
        .trim();
      const fileName = `${safeTitle} ${effectiveBpm}bpm.webm`;

      // Trigger download
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setExportProgress(100);
    } catch (err: any) {
      // Suppress abort-related errors from cancelled exports
      if (cancelledRef.current) return;
      console.error("Video export failed:", err);
      setExportError(err?.message ?? "Export failed");
    } finally {
      // Clean up any leftover encoders
      try { encodersRef.current.video?.close(); } catch { /* already closed */ }
      try { encodersRef.current.audio?.close(); } catch { /* already closed */ }
      encodersRef.current = {};
      setIsExporting(false);
      setTimeout(() => setExportProgress(null), 1500);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isExporting]);

  return {
    exportVideo,
    exportProgress,
    isExporting,
    exportError,
    cancelExport,
  };
}
