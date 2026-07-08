const PLACEHOLDER_VALUES = new Set([
  "",
  "https://your-project.supabase.co",
  "your-anon-key",
  "replace-with-your-supabase-anon-key",
  "your-publishable-or-anon-key",
  "your-supabase-anon-key",
]);

export function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  const configured = Boolean(url && key && !PLACEHOLDER_VALUES.has(url) && !PLACEHOLDER_VALUES.has(key));
  return { url, key, configured };
}

export function supabaseNotConfiguredMessage() {
  return "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local, then restart npm run dev.";
}
