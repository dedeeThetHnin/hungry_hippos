// pages/api/scores.js
// Returns a list of available MIDI scores from Supabase
// Expected table structure:
//   scores: { id, title, composer, midi_data (bytea/blob) }

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // service role key — never expose to client
);

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();

  // Fetch metadata only (no midi_data blob) for the list
  const { data, error } = await supabase
    .from("scores")
    .select("id, title, composer")
    .order("title");

  if (error) {
    console.error("Supabase error:", error);
    return res.status(500).json({ error: error.message });
  }

  res.status(200).json(data);
}
