// pages/api/scores/[id].js
// Returns the raw MIDI blob for a single score as base64
// The client uses this to parse the MIDI with @tonejs/midi

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();

  const { id } = req.query;

  const { data, error } = await supabase
    .from("scores")
    .select("id, title, composer, midi_data")
    .eq("id", id)
    .single();

  if (error || !data) {
    return res.status(404).json({ error: "Score not found" });
  }

  // midi_data comes back as a Buffer from Supabase bytea columns.
  // Convert to base64 so it's safe to send over JSON.
  const base64 = Buffer.from(data.midi_data).toString("base64");

  res.status(200).json({
    id: data.id,
    title: data.title,
    composer: data.composer,
    midi_base64: base64,
  });
}
