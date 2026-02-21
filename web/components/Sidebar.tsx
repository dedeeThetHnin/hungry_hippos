"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutButton } from "@/components/logout-button";

export default function Sidebar() {
  const pathname = usePathname();

  const isActive = (href: string) => pathname === href;

  return (
    <aside className="relative w-72 shrink-0 border-r border-sakura-pink/15 bg-white/55 backdrop-blur-md">
      {/* subtle top tint to match landing */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-sakura-pink/12 via-white/0 to-white/0" />

      <div className="relative flex h-full flex-col justify-between px-5 py-7">
        {/* Logo */}
        <div>
          <Link
            href="/"
            className="mb-8 flex items-center gap-3 rounded-2xl border border-sakura-pink/15 bg-white/55 px-4 py-4 shadow-sm transition hover:bg-white/70"
          >
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-sakura-pink/15 text-sakura-text-pink shadow-[0_10px_30px_rgba(255,79,166,0.12)]">
              ✦
            </span>
            <div className="leading-tight">
              <div className="text-3xl font-fasthand text-[#2D3142]">
                Sakura Sonata
              </div>
            </div>
          </Link>

          {/* Nav */}
          <nav className="flex flex-col gap-2">
            <Link
              href="/dashboard"
              className={[
                "group relative flex items-center justify-between rounded-2xl border px-4 py-3 transition-all duration-200",
                isActive("/dashboard")
                  ? "border-sakura-pink/25 bg-white/80 shadow-sm"
                  : "border-transparent bg-white/35 hover:border-sakura-pink/15 hover:bg-white/60",
              ].join(" ")}
            >
              <div className="flex items-center gap-3">
                <span
                  className={[
                    "grid h-9 w-9 place-items-center rounded-xl transition",
                    isActive("/dashboard")
                      ? "bg-sakura-pink/15 text-sakura-text-pink"
                      : "bg-white/60 text-slate-500 group-hover:text-sakura-text-pink",
                  ].join(" ")}
                >
                  ♪
                </span>
                <div className="flex flex-col">
                  <span
                    className={[
                      "text-sm font-semibold transition",
                      isActive("/dashboard")
                        ? "text-sakura-text-pink"
                        : "text-slate-600 group-hover:text-sakura-text-pink",
                    ].join(" ")}
                  >
                    My Sonatas
                  </span>
                  <span className="text-[11px] text-sakura-dark/40">
                    View your library
                  </span>
                </div>
              </div>

              {/* active accent */}
              <span
                className={[
                  "h-2 w-2 rounded-full transition",
                  isActive("/dashboard")
                    ? "bg-sakura-pink shadow-[0_0_18px_rgba(255,79,166,0.55)]"
                    : "bg-transparent",
                ].join(" ")}
              />
            </Link>

            <Link
              href="/dashboard/new"
              className={[
                "group relative flex items-center justify-between rounded-2xl border px-4 py-3 transition-all duration-200",
                isActive("/dashboard/new")
                  ? "border-sakura-pink/25 bg-white/80 shadow-sm"
                  : "border-transparent bg-white/35 hover:border-sakura-pink/15 hover:bg-white/60",
              ].join(" ")}
            >
              <div className="flex items-center gap-3">
                <span
                  className={[
                    "grid h-9 w-9 place-items-center rounded-xl transition",
                    isActive("/dashboard/new")
                      ? "bg-sakura-pink/15 text-sakura-text-pink"
                      : "bg-white/60 text-slate-500 group-hover:text-sakura-text-pink",
                  ].join(" ")}
                >
                  ✿
                </span>
                <div className="flex flex-col">
                  <span
                    className={[
                      "text-sm font-semibold transition",
                      isActive("/dashboard/new")
                        ? "text-sakura-text-pink"
                        : "text-slate-600 group-hover:text-sakura-text-pink",
                    ].join(" ")}
                  >
                    New Composition
                  </span>
                  <span className="text-[11px] text-sakura-dark/40">
                    Upload a sonata
                  </span>
                </div>
              </div>

              <span
                className={[
                  "h-2 w-2 rounded-full transition",
                  isActive("/dashboard/new")
                    ? "bg-sakura-pink shadow-[0_0_18px_rgba(255,79,166,0.55)]"
                    : "bg-transparent",
                ].join(" ")}
              />
            </Link>
          </nav>
        </div>

        {/* Footer actions */}
        <div className="mt-8 flex items-center gap-3">
          <button
            className="h-10 w-10 rounded-full border border-sakura-pink/15 bg-white/60 text-sakura-dark/50 shadow-sm backdrop-blur-sm transition-all duration-200 hover:bg-white hover:text-sakura-text-pink hover:shadow-md"
            onClick={() => window.history.back()}
            aria-label="Go back"
            title="Back"
          >
            ←
          </button>

          <LogoutButton
            label="Log out"
            className="h-10 flex-1 rounded-full border border-sakura-pink/15 bg-white/60 px-4 text-sakura-dark/70 shadow-sm backdrop-blur-sm transition-all duration-200 hover:bg-white hover:text-sakura-text-pink hover:shadow-md"
          />
        </div>
      </div>
    </aside>
  );
}
