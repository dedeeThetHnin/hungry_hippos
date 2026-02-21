"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Sidebar from "@/components/Sidebar";

type Score = {
  id: string;
  title: string | null;
  composer: string | null;
  status: string | null;
  created_at: string | null;
};

export default function DashboardPage() {
  const [scores, setScores] = useState<Score[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchScores = async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("scores")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching scores:", error);
      } else {
        setScores(data || []);
      }
      setLoading(false);
    };

    fetchScores();
  }, []);

  return (
    <div className="flex h-screen w-screen overflow-hidden font-inter bg-sakura-bg">
      <Sidebar />

      <main className="flex-1 p-10 overflow-y-auto">
        <div className="mb-8">
          <h1 className="text-5xl font-bold text-sakura-text-pink mb-2">
            My Sonatas
          </h1>
          <p className="text-sakura-dark/50 text-lg">
            Your collection of music compositions
          </p>
        </div>

        {loading ? (
          <div className="text-sakura-dark/60 text-lg">
            Loading your sonatas...
          </div>
        ) : scores.length === 0 ? (
          <div className="text-sakura-dark/60 text-lg">
            No compositions yet. Upload one to get started!
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-6">
            {scores.map((score) => (
              <div
                key={score.id}
                className="rounded-2xl bg-white/80 backdrop-blur-sm p-6 cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl hover:bg-white"
                style={{ boxShadow: "0 4px 24px rgba(217, 108, 142, 0.12)" }}
              >
                <div className="flex flex-col h-32 justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-sakura-text-pink">
                      {score.title || "Untitled"}
                    </h3>
                    <p className="text-sakura-dark/50 text-sm">
                      {score.composer || "Unknown composer"}
                    </p>
                  </div>
                  <div className="flex justify-between items-center">
                    <p className="text-sakura-dark/40 text-xs">
                      {score.created_at
                        ? new Date(score.created_at).toLocaleDateString()
                        : ""}
                    </p>
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        score.status === "done"
                          ? "bg-green-100 text-green-500"
                          : score.status === "error"
                          ? "bg-red-100 text-red-400"
                          : "bg-pink-100 text-pink-400"
                      }`}
                    >
                      {score.status || "pending"}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

    </div>
  );
}
