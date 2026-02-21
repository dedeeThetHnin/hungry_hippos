"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Sidebar from "@/components/Sidebar";
import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { SakuraBackground } from "@/components/SakuraBackground";

const BUCKET = "sheet-music";

type Score = {
  id: string;
  title: string | null;
  file_url: string | null; // can be PATH or old PUBLIC URL
  created_at: string | null;
  user_id?: string | null;
};

function toStoragePath(fileUrlOrPath: string) {
  if (!fileUrlOrPath.startsWith("http")) return fileUrlOrPath;

  const publicMarker = `/storage/v1/object/public/${BUCKET}/`;

  let idx = fileUrlOrPath.indexOf(publicMarker);
  if (idx >= 0) return fileUrlOrPath.slice(idx + publicMarker.length);

  return "";
}

export default function DashboardPage() {
  const [scores, setScores] = useState<Score[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const fetchScores = async () => {
      const supabase = createClient();

      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();

      if (userErr || !user) {
        setScores([]);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("scores")
        .select("id,title,file_url,created_at,user_id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) console.error("Error fetching scores:", error);
      else setScores(data ?? []);

      setLoading(false);
    };

    fetchScores();
  }, []);

  const handleDelete = async (score: Score) => {
    try {
      setDeletingId(score.id);
      const supabase = createClient();

      if (!score.file_url) {
        alert("This composition has no file path stored.");
        return;
      }

      const storagePath = toStoragePath(score.file_url);

      if (!storagePath) {
        alert(
          "Could not extract a storage path from file_url. Make sure file_url is either a storage path or a Supabase storage public URL.",
        );
        console.error("Bad file_url:", score.file_url);
        return;
      }

      const { error: storageErr } = await supabase.storage
        .from(BUCKET)
        .remove([storagePath]);

      if (storageErr) {
        console.error("Storage delete failed:", storageErr);
        alert(`Failed to delete file from storage: ${storageErr.message}`);
        return;
      }

      const { error: dbErr } = await supabase
        .from("scores")
        .delete()
        .eq("id", score.id);

      if (dbErr) {
        console.error("DB delete failed:", dbErr);
        alert(`Deleted file, but failed to delete DB row: ${dbErr.message}`);
        return;
      }

      setScores((prev) => prev.filter((s) => s.id !== score.id));
    } catch (err) {
      console.error("Delete failed:", err);
      alert("Failed to delete. Check console for details.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="relative flex h-screen w-screen overflow-hidden font-inter bg-sakura-bg">
      {/* Sakura petals background (behind everything) */}
      <SakuraBackground />

      {/* Foreground content */}
      <div className="relative z-10 flex h-full w-full overflow-hidden">
        <Sidebar />

        <main className="flex-1 overflow-y-auto px-6 py-10 sm:px-10">
          {/* Header (no dashboard pill, no glow) */}
          <div className="mb-10">
            <h1 className="text-4xl sm:text-5xl font-bold leading-tight tracking-tight text-sakura-text-pink">
              My Sonatas
            </h1>
            <p className="mt-2 text-base sm:text-lg text-sakura-dark/55">
              Your collection of music compositions
            </p>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-sakura-pink/15 bg-white/55 p-8 backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <div className="h-3 w-3 animate-pulse rounded-full bg-sakura-pink/70" />
                <div className="text-sakura-dark/60 text-lg">
                  Loading your sonatas...
                </div>
              </div>
            </div>
          ) : scores.length === 0 ? (
            <div className="rounded-2xl border border-sakura-pink/15 bg-white/55 p-10 text-center backdrop-blur-sm">
              <div className="mx-auto mb-4 h-12 w-12 rounded-2xl bg-sakura-pink/10" />
              <div className="text-sakura-text-pink font-semibold text-lg">
                No compositions yet
              </div>
              <div className="mt-1 text-sakura-dark/55">
                Upload one to get started!
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              {scores.map((score) => (
                <div
                  key={score.id}
                  className="group cursor-pointer relative overflow-hidden rounded-2xl border border-sakura-pink/15 bg-white/70 p-6 backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/90 hover:shadow-2xl"
                  style={{
                    boxShadow: "0 6px 30px rgba(217, 108, 142, 0.10)",
                  }}
                  onClick={() => {
                    router.push(`/tutorial/${score.id}`);
                  }}
                >
                  <button
                    type="button"
                    className="absolute top-4 right-4 z-10 rounded-full border border-sakura-pink/15 bg-white/70 p-2 text-sakura-text-pink/75 shadow-sm backdrop-blur-sm transition hover:bg-white hover:text-sakura-text-pink hover:shadow-md disabled:opacity-50"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(score);
                    }}
                    disabled={deletingId === score.id}
                    aria-label="Delete composition"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>

                  <div className="flex h-32 flex-col justify-between">
                    <div className="pr-10">
                      <h3 className="text-lg font-semibold text-sakura-text-pink">
                        {score.title?.trim() ? score.title : "Untitled"}
                      </h3>
                    </div>

                    <div className="flex items-center justify-between">
                      <p className="text-xs text-sakura-dark/45">
                        {score.created_at
                          ? new Date(score.created_at).toLocaleDateString()
                          : ""}
                      </p>

                      {deletingId === score.id ? (
                        <span className="text-xs text-sakura-dark/45">
                          Deleting…
                        </span>
                      ) : (
                        <span className="text-xs font-medium text-sakura-text-pink/70 transition group-hover:text-sakura-text-pink">
                          Open →
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
