"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutButton } from "@/components/logout-button";

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      /* 1. Changed to bg-transparent so the #FFF6EB background shows through.
         2. Changed border color to a very soft pink (pink-100).
      */
      className="w-64 flex flex-col justify-between py-8 px-5 shrink-0 bg-transparent border-r border-pink-100"
    >
      {/* Logo */}
      <div>
        <div className="flex items-center gap-2 mb-10 px-2">
          {/* Matching the star/sparkle color to your logo theme */}
          <span className="text-2xl text-pink-400">✦</span>
          <span className="text-[#2D3142] text-3xl font-fasthand">
            Sonata
          </span>
        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-3">
          <Link
            href="/dashboard"
            className={`rounded-2xl px-5 py-3 text-center transition-all duration-200 font-medium text-sm
              ${pathname === "/dashboard"
                ? "bg-pink-200 text-[#2D3142] shadow-sm" // Matches the active tab in your login form
                : "bg-white/40 text-slate-500 hover:bg-white/60"
              }`}
          >
            My Sonatas
          </Link>

          <Link
            href="/dashboard/new"
            className={`rounded-2xl px-5 py-3 text-center transition-all duration-200 font-medium text-sm flex items-center justify-center gap-2
              ${pathname === "/dashboard/new"
                ? "bg-pink-200 text-[#2D3142] shadow-sm"
                : "bg-white/40 text-slate-500 hover:bg-white/60"
              }`}
          >
            <span>✿</span>
            New Composition
          </Link>
        </nav>
      </div>

      <div className="flex items-center gap-3">
        <button
          className="w-10 h-10 rounded-full bg-white/60 flex items-center justify-center text-sakura-dark/50 hover:bg-white transition-all duration-200 hover:text-sakura-text-pink"
          onClick={() => window.history.back()}
        >
          ←
        </button>
        <LogoutButton
          label="Log out"
          className="h-10 rounded-full bg-white/60 px-4 text-sakura-dark/70 hover:bg-white hover:text-sakura-text-pink"
        />
      </div>
    </aside>
  );
}