import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

export const runtime = "nodejs";

type PracticeSummary = {
  pieceTitle: string;
  mode: "discrete" | "continuous";
  totalSteps: number;

  attempts: number;
  hits: number;
  wrongs: number;
  misses: number;
  accuracyPct: number;

  topWrong: { midi: number; note: string; count: number }[];
  topMissed: { midi: number; note: string; count: number }[];
  hotspots: { step: number; fails: number }[];
};

function buildPrompt(summary: PracticeSummary) {
  return `
You are a supportive piano teacher.

Write 120–180 words of feedback based on the student's practice summary.
Requirements:
- Start with one positive observation.
- Mention the top 1–2 specific recurring issues (notes or hotspots).
- Give exactly 3 actionable practice tips as bullet points.
- Be friendly and encouraging, not harsh.
- Don't mention "JSON", "data", or "API".

Practice summary:
${JSON.stringify(summary, null, 2)}
`.trim();
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const summary = body?.summary as PracticeSummary | undefined;

    if (!summary || typeof summary !== "object") {
      return NextResponse.json({ error: "Missing summary" }, { status: 400 });
    }

    const ai = new GoogleGenAI({}); // reads GEMINI_API_KEY from env :contentReference[oaicite:2]{index=2}
    const prompt = buildPrompt(summary);

    const resp = await ai.models.generateContent({
      // Model naming varies; this is a current example from Google docs. :contentReference[oaicite:3]{index=3}
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    const text = (resp.text ?? "").trim();
    return NextResponse.json({ text });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}