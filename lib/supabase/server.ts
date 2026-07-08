import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseConfig, supabaseNotConfiguredMessage } from "@/lib/supabase/config";

export async function createClient() {
  const cookieStore = await cookies();
  const { url, key, configured } = getSupabaseConfig();
  if (!configured) throw new Error(supabaseNotConfiguredMessage());

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot write cookies; the proxy refreshes sessions.
        }
      },
    },
  });
}
