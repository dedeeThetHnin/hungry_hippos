import { Suspense } from "react";
import { LoginForm } from "@/components/login-form";
import { SakuraBackground } from "@/components/SakuraBackground";
import { AuthRedirect } from "@/components/auth-redirect";

export default function LoginPage() {
  return (
    <>
      <Suspense fallback={null}>
        <AuthRedirect />
      </Suspense>
      {/* Forced 'light' class here ensures dark-mode settings don't flip your colors */ }
      <main className="light min-h-screen w-full bg-[#FFF6EB] flex items-center justify-center relative overflow-hidden p-4">
        
        {/* Sakura petals floating in the background layer */}
        <div className="absolute inset-0 z-0">
          <SakuraBackground />
        </div>

        {/* The Login Form sitting on the foreground layer */}
        <div className="z-10 w-full max-w-[400px]">
          <LoginForm />
        </div>
        
      </main>
    </>
  );
}