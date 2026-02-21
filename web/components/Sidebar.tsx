"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="w-64 flex flex-col justify-between py-8 px-5 shrink-0"
      style={{ background: "rgba(255,255,255,0.15)", backdropFilter: "blur(12px)", borderRight: "1px solid rgba(255,255,255,0.3)" }}
    >
      {/* Logo */}
      <div>
        <div className="flex items-center gap-2 mb-10 px-2">
          <span className="text-2xl">✦</span>
          <span
            className="text-white text-xl font-bold"
            style={{ fontFamily: "'Dancing Script', cursive" }}
          >
            Sakura Sonata
          </span>
        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-3">
          <Link
            href="/dashboard"
            className={`rounded-2xl px-5 py-3 text-center transition-all duration-200 font-medium
              ${pathname === "/dashboard"
                ? "bg-white text-pink-500 shadow-md"
                : "bg-white/60 text-pink-400 hover:bg-white/80"
              }`}
            style={{ fontFamily: "'Dancing Script', cursive", fontSize: "1.1rem" }}
          >
            My Sonatas
          </Link>

          <Link
            href="/dashboard/new"
            className="rounded-2xl px-5 py-3 text-center bg-white/60 text-pink-400 hover:bg-white/80 transition-all duration-200 font-medium flex items-center justify-center gap-2"
            style={{ fontFamily: "'Dancing Script', cursive", fontSize: "1.1rem" }}
          >
            <span>🎵</span>
            New Composition
          </Link>
        </nav>
      </div>

      {/* Back button */}
      <button
        className="w-10 h-10 rounded-full bg-white/60 flex items-center justify-center text-pink-400 hover:bg-white transition-all duration-200 hover:text-pink-600"
        onClick={() => window.history.back()}
      >
        ←
      </button>
    </aside>
  );
}
