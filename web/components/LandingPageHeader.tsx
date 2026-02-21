import Link from "next/link";

export function LandingPageHeader() {
  return (
    <header className="w-full flex justify-center px-4 pt-6">
      <div className="w-full max-w-5xl flex items-center justify-between rounded-full bg-white/70 backdrop-blur-sm px-6 py-3 shadow-sm">
        {/* Logo */}
        <Link href="/" className="font-fasthand text-2xl text-sakura-text-pink select-none">
          Sakura Sonata
        </Link>

        {/* Auth Buttons */}
        <div className="flex items-center gap-3">
          <Link
            href="/auth/login"
            className="rounded-full border border-sakura-pink px-5 py-2 text-sm font-medium text-sakura-pink transition-colors hover:bg-sakura-pink/10"
          >
            Sign In
          </Link>
          <Link
            href="/auth/sign-up"
            className="rounded-full bg-sakura-pink px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-sakura-pink/90 shadow-sm"
          >
            Sign Up
          </Link>
        </div>
      </div>
    </header>
  );
}
