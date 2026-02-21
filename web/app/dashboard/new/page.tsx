"use client";

import { useMemo, useRef, useState } from "react";
import { SakuraBackground } from "@/components/SakuraBackground";
import Link from "next/link";
import { Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ChevronLeft } from "lucide-react";

const BUCKET = "sheet-music";
const SCORES = "scores";

export default function NewCompositionPage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [status, setStatus] = useState<string>("");
  const supabase = useMemo(() => createClient(), []);

  const uploadFile = async (file: File) => {
    try {
      setStatus("Uploading...");

      // Only allow MIDI (adjust if you want mp3/wav too)
      const name = file.name.toLowerCase();
      const isMidi =
        file.type === "audio/midi" ||
        name.endsWith(".mid") ||
        name.endsWith(".midi");
      if (!isMidi) {
        setStatus("Please upload a MIDI file (.mid or .midi).");
        return;
      }

      // size limit 50MB
      const maxBytes = 50 * 1024 * 1024;
      if (file.size > maxBytes) {
        setStatus("File too large (max 50MB).");
        return;
      }

      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();

      if (userErr || !user) {
        setStatus("You must be logged in to upload.");
        return;
      }

      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${user.id}/uploads/${crypto.randomUUID()}-${safeName}`;

      const { data, error } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, {
          contentType: "audio/midi",
          upsert: false,
        });

      if (error) {
        console.log("Upload error:", error);
        setStatus(`Upload failed: ${error.message}`);
        return;
      }

      const { data: signed } = await supabase.storage
        .from(BUCKET)
        .getPublicUrl(data.path);

      const url = signed.publicUrl;

      const { error: scoreErr } = await supabase.from(SCORES).insert({
        id: crypto.randomUUID(),
        user_id: user.id,
        title: safeName,
        file_url: url,
      });

      if (scoreErr) {
        console.log("Score database upload error:", scoreErr);
        setStatus("Score database upload error");
        return;
      }

      setStatus(`Uploaded successfully`);
    } catch (e: any) {
      setStatus(`Upload error: ${e?.message ?? "Unknown error"}`);
    }
  };

  return (
    <div className="relative min-h-screen w-full bg-[#FFF6EB] flex flex-col items-center justify-center overflow-hidden p-6">
      <div className="absolute inset-0 z-0 pointer-events-none">
        <SakuraBackground />
      </div>

      {/* Back Button */}
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 mb-8 text-slate-400 hover:text-pink-400 transition-colors font-medium text-sm group"
      >
        <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
        Back to My Sonatas
      </Link>

      <div className="z-10 flex flex-col items-center w-full max-w-2xl text-center space-y-6">
        <h1 className="text-4xl font-serif text-[#2D3142]">New Composition</h1>
        <p className="text-slate-500">Drop your MIDI file to begin</p>

        {/* Hidden file input for click-to-upload */}
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept=".mid,.midi,audio/midi"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) uploadFile(file);
            e.currentTarget.value = ""; // allow selecting same file again
          }}
        />

        <div
          role="button"
          tabIndex={0}
          className="w-full border-2 border-dashed border-pink-200 rounded-[2.5rem] bg-white/60 backdrop-blur-md p-16 flex flex-col items-center gap-4 transition-all hover:bg-white/80 cursor-pointer group outline-none focus:ring-2 focus:ring-pink-200"
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const file = e.dataTransfer.files?.[0];
            if (file) uploadFile(file);
          }}
        >
          <div className="p-4 bg-pink-50 rounded-full text-pink-400 group-hover:scale-110 transition-transform">
            <Upload className="w-10 h-10" />
          </div>
          <p className="text-[#2D3142] font-medium text-lg">
            Drag & drop or click to upload
          </p>
          <span className="text-sm text-slate-400">MIDI • Max 50MB</span>
        </div>

        {status && (
          <pre className="whitespace-pre-wrap text-left bg-white/70 border border-pink-100 p-4 rounded-xl w-full">
            {status}
          </pre>
        )}
      </div>
    </div>
  );
}
