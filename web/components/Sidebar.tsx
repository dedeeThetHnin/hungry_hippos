"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="w-64 flex flex-col justify-between py-8 px-5 shrink-0 bg-white/70 backdrop-blur-sm border-r border-sakura-pink/10"
    >
      {/* Logo */}
      <div>
        <div className="flex items-center gap-2 mb-10 px-2">
          <span className="text-2xl text-amber-500">✦</span>
          <span className="text-sakura-text-pink text-3xl font-fasthand">
            Sakura Sonata
          </span>
        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-3">
          <Link
            href="/dashboard"
            className={`rounded-2xl px-5 py-3 text-center transition-all duration-200 font-medium text-sm
              ${pathname === "/dashboard"
                ? "bg-sakura-pink text-white shadow-md"
                : "bg-white/60 text-sakura-dark/70 hover:bg-white/80"
              }`}
          >
            My Sonatas
          </Link>

          <Link
            href="/dashboard/new"
            className="rounded-2xl px-5 py-3 text-center bg-white/60 text-sakura-dark/70 hover:bg-white/80 transition-all duration-200 font-medium text-sm flex items-center justify-center gap-2"
          >
            <span>🎵</span>
            New Composition
          </Link>
        </nav>
      </div>

      {/* Back button */}
      <button
        className="w-10 h-10 rounded-full bg-white/60 flex items-center justify-center text-sakura-dark/50 hover:bg-white transition-all duration-200 hover:text-sakura-text-pink"
        onClick={() => window.history.back()}
      >
        ←
      </button>
    </aside>
  );
}
