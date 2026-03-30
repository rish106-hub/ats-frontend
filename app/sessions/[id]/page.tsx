"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, type Session } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { FieldMatchTable } from "@/components/field-match-table";

// ── types ──────────────────────────────────────────────────────────────────

type Step = "jd" | "resumes" | "preview" | "results";

function stepFromStatus(s: Session): Step {
  if (s.status === "completed") return "results";
  if (s.status === "preview_active") return "preview";
  if (s.status === "resumes_uploaded" || s.status === "jd_analyzed") return "resumes";
  return "jd";
}

// ── main page ──────────────────────────────────────────────────────────────

export default function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState<Step>("jd");

  // form state
  const [jdText, setJdText] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [includeText, setIncludeText] = useState("");
  const [excludeText, setExcludeText] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    const s = await api.getSession(id);
    setSession(s);
    setStep(stepFromStatus(s));
    if (s.jd_text) setJdText(s.jd_text);
    return s;
  }, [id]);

  useEffect(() => {
    refresh().catch(() => setError("Session not found.")).finally(() => setLoading(false));
  }, [refresh]);

  async function run<T>(fn: () => Promise<T>): Promise<T | undefined> {
    setBusy(true);
    setError("");
    try {
      const result = await fn();
      await refresh();
      return result;
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // ── step handlers ──────────────────────────────────────────────────────

  function handleAnalyzeJD() {
    run(() => api.analyzeJD(id, jdText, apiKey || undefined));
  }

  function handleUploadResumes() {
    if (!files.length) { setError("Select at least one PDF."); return; }
    run(() => api.uploadResumes(id, files, apiKey || undefined));
  }

  function handleStartPreview() {
    run(() => api.startPreview(id, apiKey || undefined));
  }

  function handleRefine() {
    run(() => api.refinePreview(id, includeText, excludeText, apiKey || undefined)).then(() => {
      setIncludeText("");
      setExcludeText("");
    });
  }

  function handleAccept() {
    run(() => api.accept(id, apiKey || undefined));
  }

  // ── render ─────────────────────────────────────────────────────────────

  if (loading) return <Shell><p className="text-zinc-500 p-8">Loading…</p></Shell>;
  if (!session) return <Shell><p className="text-red-400 p-8">{error || "Session not found."}</p></Shell>;

  const jd = session.jd_analysis as Record<string, unknown> | null;
  const config = session.synthesized_config as Record<string, unknown> | null;
  const tokens = (session.token_totals as Record<string, unknown>)?._total_tokens as number | undefined;

  return (
    <Shell>
      {/* header */}
      <div className="border-b border-zinc-800 px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push("/")} className="text-zinc-500 hover:text-zinc-300 text-sm">
            ← Sessions
          </button>
          <Separator orientation="vertical" className="h-4 bg-zinc-700" />
          <span className="text-zinc-100 text-sm font-medium">
            {jd ? String(jd.role ?? "Session") : "New session"}
          </span>
        </div>
        <div className="flex items-center gap-4">
          {tokens ? <span className="text-zinc-500 text-xs font-mono">{tokens.toLocaleString()} tokens</span> : null}
          <span className="text-xs text-zinc-400">Iteration {session.preview_iteration_count}</span>
        </div>
      </div>

      {/* step nav */}
      <StepNav current={step} session={session} />

      <div className="p-8 max-w-5xl mx-auto space-y-6">
        {/* api key input (always visible if not set via env) */}
        <div className="flex items-center gap-3">
          <Input
            type="password"
            placeholder="Gemini API key (or set GOOGLE_API_KEY on backend)"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="bg-zinc-900 border-zinc-700 text-zinc-300 text-sm max-w-sm"
          />
        </div>

        {error && (
          <div className="rounded-md bg-red-950 border border-red-800 text-red-300 px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {/* ── step 1: JD ── */}
        {step === "jd" && (
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader><CardTitle className="text-zinc-100">Step 1 — Job Description</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="Paste the full job description here…"
                value={jdText}
                onChange={(e) => setJdText(e.target.value)}
                rows={14}
                className="bg-zinc-950 border-zinc-700 text-zinc-200 text-sm resize-none"
              />
              <Button onClick={handleAnalyzeJD} disabled={busy || !jdText.trim()} className="bg-white text-zinc-950 hover:bg-zinc-200">
                {busy ? "Analyzing…" : "Analyze JD"}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* ── step 2: resumes ── */}
        {(step === "resumes" || (step === "preview" && !session.preview_field_results)) && (
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader><CardTitle className="text-zinc-100">Step 2 — Upload Resumes</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {jd && <CriteriaSummary jd={jd} />}
              <div
                className="border-2 border-dashed border-zinc-700 rounded-lg p-8 text-center cursor-pointer hover:border-zinc-500 transition-colors"
                onClick={() => fileRef.current?.click()}
              >
                <p className="text-zinc-400 text-sm">
                  {files.length ? `${files.length} PDF${files.length > 1 ? "s" : ""} selected` : "Click to select PDF resumes"}
                </p>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf"
                  multiple
                  className="hidden"
                  onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
                />
              </div>
              <Button onClick={handleUploadResumes} disabled={busy || !files.length} className="bg-white text-zinc-950 hover:bg-zinc-200">
                {busy ? "Parsing…" : "Parse Resumes"}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* resumes uploaded confirmation */}
        {step === "resumes" && session.status === "resumes_uploaded" && (
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="pt-6">
              <p className="text-green-400 text-sm mb-4">Resumes parsed and ready.</p>
              <Button onClick={handleStartPreview} disabled={busy} className="bg-white text-zinc-950 hover:bg-zinc-200">
                {busy ? "Running preview…" : "Start Preview Loop"}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* ── step 3: preview loop ── */}
        {step === "preview" && session.preview_field_results && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-zinc-100">
                Preview — Iteration {session.preview_iteration_count}
              </h2>
              {config && (
                <p className="text-zinc-500 text-sm max-w-lg text-right">
                  {String((config as Record<string,unknown>).screening_summary ?? "")}
                </p>
              )}
            </div>

            <FieldMatchTable results={session.preview_field_results} />

            {/* synthesis notes */}
            {config && (config as Record<string, string>).synthesis_notes ? (
              <div className="text-xs text-zinc-500 border-l-2 border-zinc-700 pl-3">
                {(config as Record<string, string>).synthesis_notes}
              </div>
            ) : null}

            {/* param history */}
            {session.extra_params_history.length > 0 && (
              <details className="group">
                <summary className="text-xs text-zinc-500 cursor-pointer hover:text-zinc-300">
                  Parameters added so far ({session.extra_params_history.length})
                </summary>
                <div className="mt-2 space-y-1 pl-3">
                  {session.extra_params_history.map((p, i) => (
                    <div key={i} className="text-xs text-zinc-500">
                      <span className="text-zinc-400">Iter {p.iteration + 1}:</span>
                      {p.include && <span className="text-green-500 ml-2">+ {p.include}</span>}
                      {p.exclude && <span className="text-red-500 ml-2">− {p.exclude}</span>}
                    </div>
                  ))}
                </div>
              </details>
            )}

            <Separator className="bg-zinc-800" />

            {/* refine inputs */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Also include candidates who…</label>
                <Textarea
                  placeholder="e.g. 2+ years B2B SaaS, led a team"
                  value={includeText}
                  onChange={(e) => setIncludeText(e.target.value)}
                  rows={3}
                  className="bg-zinc-950 border-zinc-700 text-zinc-200 text-sm resize-none"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Exclude candidates who…</label>
                <Textarea
                  placeholder="e.g. only consulting background, no product experience"
                  value={excludeText}
                  onChange={(e) => setExcludeText(e.target.value)}
                  rows={3}
                  className="bg-zinc-950 border-zinc-700 text-zinc-200 text-sm resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                onClick={handleRefine}
                disabled={busy}
                className="bg-white text-zinc-950 hover:bg-zinc-200"
              >
                {busy ? "Re-evaluating…" : "Re-evaluate with updated parameters"}
              </Button>
              <Button
                onClick={handleAccept}
                disabled={busy}
                variant="outline"
                className="border-green-700 text-green-400 hover:bg-green-950"
              >
                {busy ? "Running full evaluation…" : "Accept & Run Full Evaluation"}
              </Button>
            </div>
          </div>
        )}

        {/* ── step 4: full results ── */}
        {step === "results" && session.full_results && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-zinc-100">Full Evaluation Results</h2>
              <Button variant="outline" className="border-zinc-700 text-zinc-400 text-xs" onClick={() => router.push("/")}>
                Back to sessions
              </Button>
            </div>
            <FieldMatchTable results={session.full_results} />

            {/* token breakdown */}
            <details>
              <summary className="text-xs text-zinc-500 cursor-pointer hover:text-zinc-300">Token usage breakdown</summary>
              <pre className="mt-2 text-xs text-zinc-500 bg-zinc-900 p-3 rounded-lg overflow-auto">
                {JSON.stringify(session.token_totals, null, 2)}
              </pre>
            </details>
          </div>
        )}
      </div>
    </Shell>
  );
}

// ── sub-components ─────────────────────────────────────────────────────────

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      {children}
    </div>
  );
}

function StepNav({ current, session }: { current: Step; session: Session }) {
  const steps: { key: Step; label: string }[] = [
    { key: "jd", label: "1. JD Analysis" },
    { key: "resumes", label: "2. Upload Resumes" },
    { key: "preview", label: "3. Preview Loop" },
    { key: "results", label: "4. Full Results" },
  ];
  const order: Step[] = ["jd", "resumes", "preview", "results"];

  return (
    <div className="flex gap-0 border-b border-zinc-800 bg-zinc-950">
      {steps.map(({ key, label }) => {
        const done = order.indexOf(key) < order.indexOf(current);
        const active = key === current;
        return (
          <div
            key={key}
            className={`px-6 py-3 text-sm border-b-2 transition-colors ${
              active
                ? "border-white text-white font-medium"
                : done
                ? "border-zinc-700 text-zinc-400"
                : "border-transparent text-zinc-600"
            }`}
          >
            {done ? "✓ " : ""}{label}
          </div>
        );
      })}
    </div>
  );
}

function CriteriaSummary({ jd }: { jd: Record<string, unknown> }) {
  const baseline = (jd.baseline as Record<string, unknown>) ?? {};
  const p0 = (jd.p0_signals as Array<Record<string, string>>) ?? [];
  const skills = (baseline.skills_required as string[]) ?? [];

  return (
    <div className="grid grid-cols-2 gap-4 p-4 bg-zinc-950 rounded-lg border border-zinc-800 text-xs">
      <div>
        <p className="text-zinc-400 font-medium mb-2">Baseline skills</p>
        {skills.length ? skills.map((s, i) => <p key={i} className="text-zinc-300">• {s}</p>) : <p className="text-zinc-600">None extracted</p>}
      </div>
      <div>
        <p className="text-zinc-400 font-medium mb-2">P0 signals</p>
        {p0.length ? p0.map((p, i) => <p key={i} className="text-zinc-300">• {p.signal}</p>) : <p className="text-zinc-600">None extracted</p>}
      </div>
    </div>
  );
}
