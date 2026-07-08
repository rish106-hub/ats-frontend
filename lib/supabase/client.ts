"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseConfig, supabaseNotConfiguredMessage } from "@/lib/supabase/config";

export function createClient() {
  const { url, key, configured } = getSupabaseConfig();
  if (!configured) throw new Error(supabaseNotConfiguredMessage());
  return createBrowserClient(url, key);
}
