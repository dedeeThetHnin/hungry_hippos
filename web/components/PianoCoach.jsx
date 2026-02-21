import { useState } from "react";
import { usePianoCoach } from "../hooks/usePianoCoach";

// ── Inline styles (no extra CSS file needed) ──────────────────────────────────
const S = {
  wrap: {
    fontFamily: "'DM Serif Display', Georgia, serif",
    background: "linear-gradient(160deg, #0f0f18 0%, #141420 100%)",
    border: "1px solid #2a2a40",
    borderRadius: "16px",
    padding: "28px 32px",
    maxWidth: "560px",
    color: "#e8e4dc",
    position: "relative",
    overflow: "hidden",
  },
  shimmer: {
    position: "absolute",
    inset: 0,
    background:
      "radial-gradient(ellipse at 20% 0%, rgba(201,168,76,0.07) 0%, transparent 60%)",
    pointerEvents: "none",
  },
  heading: {
    fontSize: "22px",
    fontWeight: 400,
    letterSpacing: "-0.3px",
    color: "#c9a84c",
    marginBottom: "4px",
  },
  sub: {
    fontSize: "13px",
    color: "#6b6880",
    fontFamily: "'DM Mono', monospace",
    marginBottom: "20px",
  },
  row: { display: "flex", gap: "10px", alignItems: "center", marginBottom: "14px" },
  label: { fontSize: "12px", color: "#6b6880", fontFamily: "'DM Mono', monospace", marginBottom: "6px" },
  select: {
    flex: 1,
    background: "#1a1a26",
    border: "1px solid #2a2a40",
    borderRadius: "8px",
    color: "#e8e4dc",
    padding: "9px 12px",
    fontSize: "13px",
    fontFamily: "'DM Mono', monospace",
    outline: "none",
    cursor: "pointer",
  },
  btn: (variant) => ({
    display: "inline-flex",
    alignItems: "center",
    gap: "7px",
    padding: "10px 20px",
    borderRadius: "8px",
    fontSize: "13px",
    fontFamily: "'DM Mono', monospace",
    fontWeight: 500,
    cursor: "pointer",
    border: "none",
    transition: "all 0.15s ease",
    ...(variant === "primary"
      ? { background: "#c9a84c", color: "#0a0a0f" }
      : variant === "danger"
      ? { background: "#3a1a1a", color: "#e06060", border: "1px solid #5a2a2a" }
      : variant === "ghost"
      ? { background: "transparent", color: "#6b6880", border: "1px solid #2a2a40" }
      : { background: "#1a1a26", color: "#e8e4dc", border: "1px solid #2a2a40" }),
  }),
  recorder: {
    background: "#0d0d18",
    border: "1px solid #2a2a40",
    borderRadius: "10px",
    padding: "16px",
    marginBottom: "14px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
  },
  dot: (active) => ({
    width: "10px",
    height: "10px",
    borderRadius: "50%",
    background: active ? "#e05555" : "#2a2a40",
    boxShadow: active ? "0 0 8px #e05555" : "none",
    animation: active ? "pulse 1s infinite" : "none",
    flexShrink: 0,
  }),
  noteCount: {
    fontFamily: "'DM Mono', monospace",
    fontSize: "12px",
    color: "#6b6880",
  },
  textarea: {
    width: "100%",
    background: "#1a1a26",
    border: "1px solid #2a2a40",
    borderRadius: "8px",
    color: "#e8e4dc",
    padding: "10px 12px",
    fontSize: "13px",
    fontFamily: "'DM Mono', monospace",
    resize: "vertical",
    outline: "none",
    marginBottom: "12px",
    minHeight: "64px",
  },
  feedback: {
    background: "linear-gradient(135deg, #12121e 0%, #0f0f1a 100%)",
    border: "1px solid #2a2a40",
    borderLeft: "3px solid #c9a84c",
    borderRadius: "10px",
    padding: "18px 20px",
    fontSize: "14px",
    lineHeight: "1.7",
    color: "#ccc8be",
    whiteSpace: "pre-wrap",
    marginTop: "16px",
  },
  error: {
    background: "#1a0f0f",
    border: "1px solid #5a2a2a",
    borderRadius: "8px",
    padding: "12px 14px",
    color: "#e06060",
    fontSize: "13px",
    fontFamily: "'DM Mono', monospace",
    marginTop: "12px",
  },
  spinner: {
    display: "inline-block",
    width: "14px",
    height: "14px",
    border: "2px solid #c9a84c44",
    borderTop: "2px solid #c9a84c",
    borderRadius: "50%",
    animation: "spin 0.7s linear infinite",
  },
};

const keyframes = `
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
  @keyframes spin  { to{transform:rotate(360deg)} }
  @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Mono:wght@400;500&display=swap');
`;

// ── Component ──────────────────────────────────────────────────────────────────
export default function PianoCoach({ className, style }) {
  const [userContext, setUserContext] = useState("");
  const [showContext, setShowContext] = useState(false);

  const {
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
  } = usePianoCoach();

  const isRecording = status === "recording";
  const hasStopped = status === "done_recording";
  const isFetching = status === "fetching";
  const isDone = status === "done";
  const noDevices = midiDevices.length === 0;

  return (
    <>
      <style>{keyframes}</style>
      <div style={{ ...S.wrap, ...style }} className={className}>
        <div style={S.shimmer} />

        {/* Header */}
        <div style={S.heading}>Piano Coach</div>
        <div style={S.sub}>MIDI · Magenta · Claude</div>

        {/* Device selector */}
        <div style={{ marginBottom: "16px" }}>
          <div style={S.label}>MIDI INPUT DEVICE</div>
          {noDevices ? (
            <div style={{ ...S.error, marginTop: 0 }}>
              No MIDI devices detected. Connect a keyboard and refresh.
            </div>
          ) : (
            <select
              style={S.select}
              value={activeDevice ?? ""}
              onChange={(e) => setActiveDevice(e.target.value)}
              disabled={isRecording}
            >
              {midiDevices.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          )}
        </div>

        {/* Recording strip */}
        <div style={S.recorder}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={S.dot(isRecording)} />
            <span style={{ fontSize: "13px", fontFamily: "'DM Mono', monospace" }}>
              {isRecording
                ? "Recording…"
                : hasStopped || isDone
                ? `${recordedNotes.length} notes captured`
                : "Ready"}
            </span>
          </div>

          <div style={{ display: "flex", gap: "8px" }}>
            {!isRecording && !hasStopped && !isDone && (
              <button
                style={S.btn("primary")}
                onClick={startRecording}
                disabled={noDevices}
              >
                ● Record
              </button>
            )}
            {isRecording && (
              <button style={S.btn("danger")} onClick={stopRecording}>
                ■ Stop
              </button>
            )}
            {(hasStopped || isDone) && (
              <button style={S.btn("ghost")} onClick={reset}>
                ↺ New
              </button>
            )}
          </div>
        </div>

        {/* After recording: context + feedback button */}
        {(hasStopped || isDone) && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
              <div style={S.label}>OPTIONAL: ADD CONTEXT FOR CLAUDE</div>
              <button
                style={{ ...S.btn("ghost"), padding: "2px 8px", fontSize: "11px" }}
                onClick={() => setShowContext((v) => !v)}
              >
                {showContext ? "hide" : "add note"}
              </button>
            </div>

            {showContext && (
              <textarea
                style={S.textarea}
                placeholder="e.g. 'I'm working on Chopin's Nocturne Op. 9 No. 2, focusing on the left hand arpeggios'"
                value={userContext}
                onChange={(e) => setUserContext(e.target.value)}
              />
            )}

            <button
              style={{ ...S.btn("primary"), width: "100%", justifyContent: "center" }}
              onClick={() => getFeedback(userContext)}
              disabled={isFetching || isDone}
            >
              {isFetching ? (
                <>
                  <span style={S.spinner} /> Analysing with Claude…
                </>
              ) : isDone ? (
                "✓ Feedback ready"
              ) : (
                "Get AI Feedback →"
              )}
            </button>
          </div>
        )}

        {/* Feedback */}
        {feedback && <div style={S.feedback}>{feedback}</div>}

        {/* Error */}
        {error && <div style={S.error}>⚠ {error}</div>}
      </div>
    </>
  );
}
