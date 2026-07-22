import { createBrowserClient } from "@supabase/ssr";

/** Browser client — session lives in cookies, shared with the server client below. */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
