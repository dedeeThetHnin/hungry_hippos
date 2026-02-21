"use client";

import { SakuraBackground } from "@/components/SakuraBackground";
import { Upload } from "lucide-react"; // Make sure lucide-react is installed

export default function NewCompositionPage() {
  return (
    /* Main wrapper with your aesthetic beige color */
    <div className="relative min-h-screen w-full bg-[#FFF6EB] flex flex-col items-center justify-center overflow-hidden p-6">
      
      {/* Layer 1: The falling petals sit behind the content */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <SakuraBackground />
      </div>

      {/* Layer 2: The Upload UI Content */}
      <div className="z-10 flex flex-col items-center w-full max-w-2xl text-center space-y-6">
        <h1 className="text-4xl font-serif text-[#2D3142]">New Composition</h1>
        <p className="text-slate-500">Drop your audio file to begin the transformation</p>
        
        {/* The Aesthetic Upload Box */}
        <div 
          className="w-full border-2 border-dashed border-pink-200 rounded-[2.5rem] bg-white/60 backdrop-blur-md p-16 flex flex-col items-center gap-4 transition-all hover:bg-white/80 cursor-pointer group"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            console.log("File dropped!"); // Logic for file upload goes here
          }}
        >
          <div className="p-4 bg-pink-50 rounded-full text-pink-400 group-hover:scale-110 transition-transform">
             <Upload className="w-10 h-10" />
          </div>
          <p className="text-[#2D3142] font-medium text-lg">Drag & drop or click to upload</p>
          <span className="text-sm text-slate-400">MP3, WAV, MIDI • Max 50MB</span>
        </div>
      </div>
    </div>
  );
}