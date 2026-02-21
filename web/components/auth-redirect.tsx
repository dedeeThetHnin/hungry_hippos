import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

/**
 * Server component that checks if a user is logged in and redirects to /dashboard.
 * Must be wrapped in <Suspense> since it accesses cookies (runtime data).
 */
export async function AuthRedirect() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    redirect("/dashboard");
  }
  return null;
}
