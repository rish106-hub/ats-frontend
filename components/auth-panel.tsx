"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Loader2, ShieldCheck } from "lucide-react";
import { MieruLogo } from "@/components/mieru-logo";
import { safeLocalRedirectPath } from "@/lib/redirect";
import { createClient } from "@/lib/supabase/client";
import { getSupabaseConfig, supabaseNotConfiguredMessage } from "@/lib/supabase/config";

type Mode = "login" | "signup";

export function AuthPanel({ mode }: { mode: Mode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeLocalRedirectPath(searchParams.get("next"), "/app");
  const supabaseConfig = getSupabaseConfig();
  const supabaseReady = supabaseConfig.configured;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [company, setCompany] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(searchParams.get("error") === "supabase_not_configured" ? supabaseNotConfiguredMessage() : "");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    if (!supabaseReady) {
      setError(supabaseNotConfiguredMessage());
      setLoading(false);
      return;
    }
    try {
      const supabase = createClient();
      if (mode === "login") {
        const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
        if (authError) throw authError;
        router.replace(next);
        router.refresh();
        return;
      }

      const origin = window.location.origin;
      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${origin}/auth/callback`,
          data: {
            full_name: fullName,
            company,
          },
        },
      });
      if (authError) throw authError;
      if (data.session) {
        router.replace("/onboarding");
        router.refresh();
      } else {
        setMessage("Check your email to confirm the account, then return to Mieru to finish onboarding.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const isSignup = mode === "signup";

  return (
    <main className="min-h-screen bg-[#f5f2ea] text-[#151411]">
      <div className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_480px]">
        <section className="flex min-h-[42vh] flex-col justify-between border-b border-[#ded8cc] bg-[#151411] p-6 text-white lg:min-h-screen lg:border-b-0 lg:border-r lg:p-10">
          <MieruLogo inverse />
          <div className="max-w-2xl py-12 lg:py-0">
            <p className="text-xs font-bold uppercase tracking-[.2em] text-[#c7b18b]">Evidence-visible shortlisting</p>
            <h1 className="mt-4 max-w-xl text-4xl font-black tracking-tight sm:text-5xl">
              Calibrate the role before the resume pile takes over.
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-6 text-[#d6d0c5]">
              Mieru turns a job brief, recruiter preferences, and resume evidence into a controlled shortlist workspace.
            </p>
          </div>
          <div className="grid gap-3 text-sm text-[#d6d0c5] sm:grid-cols-3 lg:grid-cols-1">
            {["Grounded evidence trails", "Private recruiter notes", "Transparent rubric control"].map((item) => (
              <div key={item} className="flex items-center gap-2">
                <ShieldCheck size={15} className="text-[#c7b18b]" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="flex items-center justify-center p-5 sm:p-8">
          <div className="w-full max-w-md rounded-xl border border-[#ded8cc] bg-white p-5 shadow-sm sm:p-6">
            <p className="text-xs font-bold uppercase tracking-[.18em] text-[#9b6a2f]">
              {isSignup ? "Create workspace" : "Welcome back"}
            </p>
            <h2 className="mt-2 text-2xl font-black tracking-tight">
              {isSignup ? "Start Mieru onboarding" : "Log in to Mieru"}
            </h2>
            <p className="mt-2 text-sm leading-5 text-[#645d52]">
              {isSignup
                ? "Create your account, then add your company and hiring workflow details."
                : "Open your recruiter workspace and continue from your last role."}
            </p>

            {!supabaseReady && (
              <div className="mt-5 rounded-lg border border-[#fedf89] bg-[#fffaeb] p-3 text-sm text-[#7a2e0e]">
                <p className="font-black">Supabase keys needed</p>
                <p className="mt-1 leading-5">Set these in <span className="font-bold">.env.local</span>, then restart <span className="font-bold">npm run dev</span>:</p>
                <pre className="mt-2 overflow-x-auto rounded-md bg-white/70 p-2 text-xs">NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co{"\n"}NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key</pre>
              </div>
            )}

            <form onSubmit={onSubmit} className="mt-5 space-y-3">
              {isSignup && (
                <>
                  <label className="block text-sm font-semibold text-[#2f2a22]">
                    Full name
                    <input
                      value={fullName}
                      onChange={(event) => setFullName(event.target.value)}
                      className="mt-1 min-h-10 w-full rounded-lg border border-[#d8d1c3] bg-[#fbfaf7] px-3 py-2 text-sm leading-5 outline-none focus:border-[#151411]"
                      placeholder="Recruiter name"
                    />
                  </label>
                  <label className="block text-sm font-semibold text-[#2f2a22]">
                    Company
                    <input
                      value={company}
                      onChange={(event) => setCompany(event.target.value)}
                      className="mt-1 min-h-10 w-full rounded-lg border border-[#d8d1c3] bg-[#fbfaf7] px-3 py-2 text-sm leading-5 outline-none focus:border-[#151411]"
                      placeholder="Company name"
                    />
                  </label>
                </>
              )}
              <label className="block text-sm font-semibold text-[#2f2a22]">
                Work email
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="mt-1 min-h-10 w-full rounded-lg border border-[#d8d1c3] bg-[#fbfaf7] px-3 py-2 text-sm leading-5 outline-none focus:border-[#151411]"
                  placeholder="name@company.com"
                />
              </label>
              <label className="block text-sm font-semibold text-[#2f2a22]">
                Password
                <input
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="mt-1 min-h-10 w-full rounded-lg border border-[#d8d1c3] bg-[#fbfaf7] px-3 py-2 text-sm leading-5 outline-none focus:border-[#151411]"
                  placeholder="Minimum 8 characters"
                />
              </label>

              {error && <p className="rounded-lg border border-[#fecdca] bg-[#fef3f2] px-3 py-2 text-sm text-[#b42318]">{error}</p>}
              {message && <p className="rounded-lg border border-[#abefc6] bg-[#ecfdf3] px-3 py-2 text-sm text-[#027a48]">{message}</p>}

              <button
                type="submit"
                disabled={loading || !supabaseReady}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#151411] px-4 py-2 text-sm font-black leading-5 text-white transition hover:bg-[#2a2823] disabled:opacity-60"
              >
                {loading ? <Loader2 size={15} className="animate-spin" /> : null}
                {isSignup ? "Create account" : "Log in"}
                {!loading ? <ArrowRight size={15} /> : null}
              </button>
            </form>

            <div className="mt-5 border-t border-[#eee8dc] pt-4 text-sm text-[#645d52]">
              {isSignup ? (
                <span>
                  Already have an account? <Link className="font-bold text-[#151411]" href="/login">Log in</Link>
                </span>
              ) : (
                <span>
                  New to Mieru? <Link className="font-bold text-[#151411]" href="/signup">Create account</Link>
                </span>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
