/***
import { LoginForm } from "@/components/login-form";

export default function Page() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <LoginForm />
      </div>
    </div>
  );
}
***/

import { LoginForm } from "@/components/login-form";
import { SakuraBackground } from "@/components/SakuraBackground";

export default function LoginPage() {
  return (
    /* Forced 'light' class here ensures dark-mode settings don't flip your colors */
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
  );
}