import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { usePianoCoach } from "../hooks/usePianoCoach";

const S = {
  wrap: { fontFamily: "'DM Serif Display', Georgia, serif", background: "linear-gradient(160deg, #0f0f18 0%, #141420 100%)", border: "1px solid #2a2a40", borderRadius: "16px", padding: "28px 32px", maxWidth: "560px", color: "#e8e4dc", position: "relative", overflow: "hidden" },
  shimmer: { position: "absolute", inset: 0, background: "radial-gradient(ellipse at 20% 0%, rgba(201,168,76,0.07) 0%, transparent 60%)", pointerEvents: "none" },
  heading: { fontSize: "22px", fontWeight: 400, letterSpacing: "-0.3px", color: "#c9a84c", marginBottom: "4px" },
  sub: { fontSize: "13px", color: "#6b6880", fontFamily: "'DM Mono', monospace", marginBottom: "20px" },
  label: { fontSize: "12px", color: "#6b6880", fontFamily: "'DM Mono', monospace", marginBottom: "6px" },
  select: { width: "100%", background: "#1a1a26", border: "1px solid #2a2a40", borderRadius: "8px", color: "#e8e4dc", padding: "9px 12px", fontSize: "13px", fontFamily: "'DM Mono', monospace", outline: "none", cursor: "pointer", marginBottom: "14px" },
  divider: { borderColor: "#2a2a40", margin: "18px 0" },
  btn: (variant, disabled) => ({ display: "inline-flex", alignItems: "center", gap: "7px", padding: "10px 20px", borderRadius: "8px", fontSize: "13px", fontFamily: "'DM Mono', monospace", fontWeight: 500, cursor: disabled ? "not-allowed" : "pointer", border: "none", transition: "all 0.15s ease", opacity: disabled ? 0.4 : 1, ...(variant === "primary" ? { background: "#c9a84c", color: "#0a0a0f" } : variant === "danger" ? { background: "#3a1a1a", color: "#e06060", border: "1px solid #5a2a2a" } : { background: "transparent", color: "#6b6880", border: "1px solid #2a2a40" }) }),
  recorder: { background: "#0d0d18", border: "1px solid #2a2a40", borderRadius: "10px", padding: "16px", marginBottom: "14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" },
  dot: (active) => ({ width: "10px", height: "10px", borderRadius: "50%", background: active ? "#e05555" : "#2a2a40", boxShadow: active ? "0 0 8px #e05555" : "none", animation: active ? "pulse 1s infinite" : "none", flexShrink: 0 }),
  accuracy: (pct) => ({ display: "inline-block", padding: "3px 10px", borderRadius: "20px", fontSize: "12px", fontFamily: "'DM Mono', monospace", background: pct >= 80 ? "#0f2a1a" : pct >= 50 ? "#2a1f0f" : "#2a0f0f", color: pct >= 80 ? "#5de0a0" : pct >= 50 ? "#e0a050" : "#e05555", border: `1px solid ${pct >= 80 ? "#1a5a30" : pct >= 50 ? "#5a3a10" : "#5a1a1a"}`, marginBottom: "12px" }),
  feedback: { background: "linear-gradient(135deg, #12121e 0%, #0f0f1a 100%)", border: "1px solid #2a2a40", borderLeft: "3px solid #c9a84c", borderRadius: "10px", padding: "18px 20px", fontSize: "14px", lineHeight: "1.7", color: "#ccc8be", whiteSpace: "pre-wrap", marginTop: "16px" },
  textarea: { width: "100%", background: "#1a1a26", border: "1px solid #2a2a40", borderRadius: "8px", color: "#e8e4dc", padding: "10px 12px", fontSize: "13px", fontFamily: "'DM Mono', monospace", resize: "vertical", outline: "none", marginBottom: "12px", minHeight: "64px" },
  error: { background: "#1a0f0f", border: "1px solid #5a2a2a", borderRadius: "8px", padding: "12px 14px", color: "#e06060", fontSize: "13px", fontFamily: "'DM Mono', monospace", marginTop: "12px" },
  spinner: { display: "inline-block", width: "14px", height: "14px", border: "2px solid #c9a84c44", borderTop: "2px solid #c9a84c", borderRadius: "50%", animation: "spin 0.7s linear infinite" },
};

const keyframes = `
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
  @keyframes spin  { to{transform:rotate(360deg)} }
  @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Mono:wght@400;500&display=swap');
`;

export default function PianoCoach({ className, style, onFeedback }) {
  const [userContext, setUserContext] = useState("");
  const [showContext, setShowContext] = useState(false);
  const [lastComparison, setLastComparison] = useState(null);

  const { status, midiDevices, activeDevice, setActiveDevice, scores, selectedScore, setSelectedScore, loadingScore, referenceNotes, recordedNotes, feedback, error, startRecording, stopRecording, getFeedback, reset } = usePianoCoach({
    onFeedback: (text, comparison) => { setLastComparison(comparison); onFeedback?.(text, comparison); },
  });

  const isRecording = status === "recording";
  const hasStopped = status === "done_recording";
  const isFetching = status === "fetching";
  const isDone = status === "done";
  const noDevices = midiDevices.length === 0;
  const canRecord = selectedScore && referenceNotes && !loadingScore && !noDevices;

  return (
    <>
      <style>{keyframes}</style>
      <div style={{ ...S.wrap, ...style }} className={className}>
        <div style={S.shimmer} />
        <div style={S.heading}>Piano Coach</div>
        <div style={S.sub}>MIDI · Supabase · Claude</div>

        {/* Score selector */}
        <div>
          <div style={S.label}>SELECT SCORE</div>
          <select style={S.select} value={selectedScore?.id ?? ""} onChange={(e) => { const score = scores.find((s) => String(s.id) === e.target.value); setSelectedScore(score ?? null); reset(); }} disabled={isRecording}>
            <option value="">— choose a piece —</option>
            {scores.map((s) => <option key={s.id} value={s.id}>{s.title}{s.composer ? ` — ${s.composer}` : ""}</option>)}
          </select>
          {loadingScore && <div style={{ fontSize: "12px", color: "#6b6880", fontFamily: "'DM Mono', monospace", marginTop: "-8px", marginBottom: "12px" }}><span style={S.spinner} /> Loading score…</div>}
          {selectedScore && referenceNotes && !loadingScore && <div style={{ fontSize: "12px", color: "#5de0a0", fontFamily: "'DM Mono', monospace", marginTop: "-8px", marginBottom: "12px" }}>✓ {referenceNotes.length} notes loaded</div>}
        </div>

        <hr style={S.divider} />

        {/* MIDI device */}
        <div style={{ marginBottom: "16px" }}>
          <div style={S.label}>MIDI INPUT DEVICE</div>
          {noDevices ? (
            <div style={{ ...S.error, marginTop: 0 }}>No MIDI devices detected. Connect a keyboard and refresh.</div>
          ) : (
            <select style={S.select} value={activeDevice ?? ""} onChange={(e) => setActiveDevice(e.target.value)} disabled={isRecording}>
              {midiDevices.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          )}
        </div>

        {/* Recording */}
        <div style={S.recorder}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={S.dot(isRecording)} />
            <span style={{ fontSize: "13px", fontFamily: "'DM Mono', monospace" }}>
              {isRecording ? "Recording…" : hasStopped || isDone ? `${recordedNotes.length} notes captured` : canRecord ? "Ready to record" : "Select a score to begin"}
            </span>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            {!isRecording && !hasStopped && !isDone && <button style={S.btn("primary", !canRecord)} onClick={startRecording} disabled={!canRecord}>● Record</button>}
            {isRecording && <button style={S.btn("danger", false)} onClick={stopRecording}>■ Stop</button>}
            {(hasStopped || isDone) && <button style={S.btn("ghost", false)} onClick={reset}>↺ New</button>}
          </div>
        </div>

        {/* Post-recording */}
        {(hasStopped || isDone) && (
          <div>
            {lastComparison && <div style={S.accuracy(lastComparison.accuracy)}>{lastComparison.accuracy}% accuracy</div>}
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
              <div style={S.label}>OPTIONAL: ADD CONTEXT FOR CLAUDE</div>
              <button style={{ ...S.btn("ghost", false), padding: "2px 8px", fontSize: "11px" }} onClick={() => setShowContext((v) => !v)}>{showContext ? "hide" : "add note"}</button>
            </div>
            {showContext && <textarea style={S.textarea} placeholder="e.g. 'Focusing on the left hand arpeggios in the second movement'" value={userContext} onChange={(e) => setUserContext(e.target.value)} />}
            <button style={{ ...S.btn("primary", isFetching || isDone), width: "100%", justifyContent: "center" }} onClick={() => getFeedback(userContext)} disabled={isFetching || isDone}>
              {isFetching ? <><span style={S.spinner} /> Analysing with Claude…</> : isDone ? "✓ Feedback ready" : "Get AI Feedback →"}
            </button>
          </div>
        )}

        {feedback && <div style={S.feedback}><ReactMarkdown>{feedback}</ReactMarkdown></div>}
        {error && <div style={S.error}>⚠ {error}</div>}
      </div>
    </>
  );
}
