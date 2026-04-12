"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, BASE, type Session, type CandidateFeedback, type InterpretResponse, type JdAnalysis, type ResumeListItem, type LessonLearned, type SkippedInfo } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { FieldMatchTable } from "@/components/field-match-table";

// ── types ──────────────────────────────────────────────────────────────────

type Step = "jd" | "resumes" | "preview" | "running" | "results";

function stepFromStatus(s: Session): Step {
  if (s.status === "completed") return "results";
  if (s.status === "running_full_eval") return "running";
  if (s.status === "preview_active") return "preview";
  if (s.status === "resumes_uploaded" || s.status === "jd_analyzed" || s.status === "rubric_ready") return "resumes";
  return "jd";
}

// ── main page ──────────────────────────────────────────────────────────────

export default function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [session, setSession] = useState<Session | null>(null);
  const [resumes, setResumes] = useState<ResumeListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState<Step>("jd");

  // form state
  const [jdText, setJdText] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [instructionsText, setInstructionsText] = useState("");
  const [exemplarPanelOpen, setExemplarPanelOpen] = useState(false);
  const [candidateFeedback, setCandidateFeedback] = useState<CandidateFeedback[]>([]);
  const [interpretPending, setInterpretPending] = useState(false);
  const [interpretResult, setInterpretResult] = useState<InterpretResponse | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    const s = await api.getSession(id);
    setSession(s);
    setStep(stepFromStatus(s));
    if (s.jd_text) setJdText(s.jd_text);
    return s;
  }, [id]);

  const refreshResumes = useCallback(() => {
    api.listResumes(id).then(setResumes).catch((e) => console.warn("[listResumes]", e));
  }, [id]);

  async function handleToggleExemplar(fileName: string, current: boolean) {
    try {
      const updated = await api.markExemplar(id, fileName, !current);
      setResumes((prev) => prev.map((r) => r.file_name === fileName ? { ...r, is_exemplar: updated.is_exemplar } : r));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function handleRubricFromExemplars() {
    await run(() => api.rubricFromExemplars(id, apiKey || undefined));
  }

  useEffect(() => {
    refresh().catch(() => setError("Session not found.")).finally(() => setLoading(false));
  }, [refresh]);

  useEffect(() => { refreshResumes(); }, [refreshResumes]);

  // Poll full-eval status while a background scoring job is running so the
  // recruiter sees live progress without having to refresh.
  useEffect(() => {
    if (!session) return;
    const isActive =
      session.status === "running_full_eval" ||
      session.full_eval_progress?.status === "running" ||
      session.full_eval_progress?.status === "queued";
    if (!isActive) return;
    const interval = setInterval(() => {
      api.getSession(id).then((s) => {
        setSession(s);
        setStep(stepFromStatus(s));
        if (s.status === "completed" || s.full_eval_progress?.status === "error") {
          clearInterval(interval);
        }
      }).catch(() => { /* swallow transient errors; next tick retries */ });
    }, 3000);
    return () => clearInterval(interval);
  }, [id, session?.status, session?.full_eval_progress?.status]);

  async function run<T>(fn: () => Promise<T>, opts?: { refreshResumesList?: boolean }): Promise<T | undefined> {
    setBusy(true);
    setError("");
    try {
      const result = await fn();
      await refresh();
      if (opts?.refreshResumesList) refreshResumes();
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
    run(() => api.uploadResumes(id, files, apiKey || undefined), { refreshResumesList: true });
  }

  function handleStartPreview() {
    run(() => api.startPreview(id, apiKey || undefined), { refreshResumesList: true });
  }

  /** Step 1: interpret the instruction — show confirmation before refining. */
  async function handleRequestRefine() {
    // If no free-form text, skip interpret and go straight to refine (feedback-only).
    if (!instructionsText.trim()) {
      doRefine();
      return;
    }
    setInterpretPending(true);
    setInterpretResult(null);
    setError("");
    try {
      const result = await api.interpretInstructions(id, instructionsText, apiKey || undefined);
      setInterpretResult(result);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setInterpretPending(false);
    }
  }

  /** Step 2: user confirmed — run the actual refine. */
  function doRefine() {
    setInterpretResult(null);
    run(
      () => api.refinePreview(id, instructionsText, candidateFeedback, apiKey || undefined),
      { refreshResumesList: true },
    ).then(() => {
      setInstructionsText("");
      setCandidateFeedback([]);
    });
  }

  /** Called when a candidate Disagree form is submitted — immediately re-evaluates. */
  function handleImmediateFeedback(fb: CandidateFeedback) {
    run(() => api.refinePreview(id, "", [fb], apiKey || undefined), { refreshResumesList: true });
  }

  function handleReload() {
    run(() => api.reloadPreview(id, apiKey || undefined), { refreshResumesList: true });
  }

  function handleAccept() {
    run(() => api.accept(id, apiKey || undefined), { refreshResumesList: true });
  }

  async function handlePatchAndReclassify(patch: { baseline_checks?: any[]; p0_weights?: any[] }) {
    setBusy(true);
    setError("");
    try {
      await api.patchRubric(id, patch, apiKey || undefined);
      // Only reclassify if preview results exist (otherwise no field_matches to re-aggregate)
      if ((session as Session).preview_field_results?.results?.length) {
        await api.reclassifyPreview(id, apiKey || undefined);
      }
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // ── render ─────────────────────────────────────────────────────────────

  if (loading) return <Shell><p className="text-zinc-500 p-8">Loading…</p></Shell>;
  if (!session) return <Shell><p className="text-red-400 p-8">{error || "Session not found."}</p></Shell>;

  const jd = session.jd_analysis;
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
            {jd?.role_context?.seniority_level && (
              <span className="ml-2 text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">
                {jd.role_context.seniority_level}
              </span>
            )}
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
        {step === "resumes" && (session.status === "resumes_uploaded" || session.status === "rubric_ready") && (
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="pt-6 space-y-4">
              {/* parse summary */}
              {(() => {
                const isExtractable = (r: ResumeListItem) => {
                  const q = r.quality as any;
                  if (!q) return true; // no quality data yet — assume fine
                  if ("text_extractable" in q) return !!q.text_extractable;
                  return !!q.readable; // fallback for old rows
                };
                const unreadable = resumes.filter(r => !isExtractable(r));
                const readable   = resumes.filter(r =>  isExtractable(r));
                return (
                  <>
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-green-400 text-sm">
                        ✓ {readable.length} resume{readable.length !== 1 ? "s" : ""} parsed successfully
                      </span>
                      {unreadable.length > 0 && (
                        <span className="text-amber-400 text-sm">
                          · {unreadable.length} could not be read
                        </span>
                      )}
                    </div>

                    {unreadable.length > 0 && (
                      <div className="rounded-lg border border-amber-800/50 bg-amber-950/20 px-4 py-3 space-y-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-400">
                          ⚠️ Unreadable PDFs — excluded from evaluation
                        </p>
                        <p className="text-xs text-zinc-500 leading-relaxed">
                          These files could not be parsed. Common cause: scanned image PDFs with no selectable text.
                          Re-upload as text-based PDFs to include them.
                        </p>
                        <div className="space-y-1">
                          {unreadable.map((r, i) => {
                            const reasons: string[] = (r.quality as any)?.reasons ?? [];
                            return (
                              <div key={i} className="flex items-start gap-2 text-xs">
                                <span className="text-amber-500 shrink-0">•</span>
                                <div className="min-w-0">
                                  <span className="text-zinc-300 font-mono">{r.file_name}</span>
                                  {reasons.length > 0 && (
                                    <span className="text-zinc-600 ml-2">— {reasons[0]}</span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}

              {/* Rubric ready banner */}
              {session.status === "rubric_ready" && (
                <div className="rounded-lg border border-yellow-700/50 bg-yellow-950/20 px-4 py-3">
                  <p className="text-sm text-yellow-300 font-medium">⭐ Rubric generated from ideal resumes</p>
                  <p className="text-xs text-zinc-400 mt-0.5">The scoring rubric was reverse-engineered from your starred examples. Click "Start Preview Loop" to evaluate candidates.</p>
                </div>
              )}

              {/* Exemplar resume list */}
              {resumes.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                    ⭐ Mark ideal resumes — generate rubric from examples
                  </p>
                  <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                    {resumes.map((r) => {
                      const q = r.quality as any;
                      const readable = q ? ("text_extractable" in q ? !!q.text_extractable : !!q.readable) : true;
                      return (
                        <div key={r.file_name} className="flex items-center justify-between gap-3 rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${readable ? "bg-green-950 text-green-400" : "bg-zinc-800 text-zinc-500"}`}>
                              {readable ? "ok" : "skip"}
                            </span>
                            <span className="text-xs text-zinc-300 font-mono truncate">{r.file_name}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <a
                              href={`${BASE}/api/sessions/${id}/resumes/${encodeURIComponent(r.file_name)}/pdf`}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="View PDF"
                              className="text-zinc-600 hover:text-zinc-300 text-xs transition-colors"
                            >
                              ↗
                            </a>
                          <button
                            onClick={() => handleToggleExemplar(r.file_name, r.is_exemplar)}
                            title={r.is_exemplar ? "Unmark as ideal" : "Mark as ideal candidate"}
                            className={`text-base transition-colors ${r.is_exemplar ? "text-yellow-400 hover:text-yellow-300" : "text-zinc-700 hover:text-zinc-400"}`}
                          >
                            ★
                          </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {(() => {
                    const exemplarCount = resumes.filter((r) => r.is_exemplar).length;
                    return exemplarCount >= 2 ? (
                      <Button
                        onClick={handleRubricFromExemplars}
                        disabled={busy}
                        variant="outline"
                        className="border-yellow-700 text-yellow-400 hover:bg-yellow-950 text-xs"
                      >
                        {busy ? "Generating rubric…" : `⭐ Generate Rubric from ${exemplarCount} Ideal Resumes`}
                      </Button>
                    ) : (
                      <p className="text-[11px] text-zinc-600">Star 2+ resumes above to unlock rubric generation from examples</p>
                    );
                  })()}
                </div>
              )}

              <div className="flex gap-3">
                <Button onClick={handleStartPreview} disabled={busy} className="bg-white text-zinc-950 hover:bg-zinc-200">
                  {busy ? "Running preview…" : "Start Preview Loop"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── step 3: preview loop ── */}
        {step === "preview" && session.preview_field_results && (
          <div className="space-y-6">
            {/* iteration header */}
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-zinc-100">
                Preview
                <span className="ml-2 text-sm font-mono bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full">
                  Iteration {session.preview_iteration_count}
                </span>
              </h2>
            </div>

            {/* synthesis notes — shown prominently when criteria changed */}
            {config && (config as Record<string, string>).synthesis_notes && (
              <div className="bg-blue-950/30 border border-blue-800/40 rounded-xl px-4 py-3 space-y-1">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-blue-400">
                  🔄 What changed this iteration
                </p>
                <p className="text-sm text-blue-200 leading-relaxed">
                  {(config as Record<string, string>).synthesis_notes}
                </p>
              </div>
            )}

            {/* lessons learned — mental model shifts from disagree feedback */}
            {config && Array.isArray((config as Record<string, unknown>).lessons_learned) &&
             ((config as Record<string, unknown>).lessons_learned as unknown[]).length > 0 && (
              <LessonsLearnedPanel lessons={(config as Record<string, unknown>).lessons_learned as LessonLearned[]} />
            )}

            {/* active rubric panel */}
            <ActiveRubricPanel config={config} onEdit={handlePatchAndReclassify} />

            {/* param history — always visible */}
            {session.extra_params_history.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                  📋 Instructions so far
                </p>
                <div className="space-y-1.5">
                  {session.extra_params_history.map((p: any, i: number) => {
                    const text = p.instructions ||
                      [p.include && `+${p.include}`, p.exclude && `−${p.exclude}`, p.update_baseline && `baseline: ${p.update_baseline}`, p.update_p0 && `P0: ${p.update_p0}`]
                        .filter(Boolean).join(" · ");
                    if (!text) return null;
                    return (
                      <div key={i} className="flex items-start gap-3 text-xs rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-2">
                        <span className="text-zinc-600 font-mono shrink-0">#{i + 1}</span>
                        <span className="text-zinc-300">{text}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* exemplar panel — collapsible, available at any preview iteration */}
            {resumes.length > 0 && (
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/50">
                <button
                  onClick={() => setExemplarPanelOpen((v) => !v)}
                  className="w-full flex items-center justify-between px-4 py-3 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <span>⭐</span>
                    <span className="font-medium">
                      Mark ideal resumes
                      {resumes.filter((r) => r.is_exemplar).length > 0 && (
                        <span className="ml-2 text-yellow-400">
                          ({resumes.filter((r) => r.is_exemplar).length} starred)
                        </span>
                      )}
                    </span>
                  </span>
                  <span className="text-zinc-600">{exemplarPanelOpen ? "▲" : "▼"}</span>
                </button>
                {exemplarPanelOpen && (
                  <div className="px-4 pb-4 space-y-2 border-t border-zinc-800">
                    <div className="space-y-1 max-h-48 overflow-y-auto pr-1 mt-3">
                      {resumes.map((r) => {
                        const q = r.quality as any;
                        const readable = q ? ("text_extractable" in q ? !!q.text_extractable : !!q.readable) : true;
                        return (
                          <div key={r.file_name} className="flex items-center justify-between gap-3 rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${readable ? "bg-green-950 text-green-400" : "bg-zinc-800 text-zinc-500"}`}>
                                {readable ? "ok" : "skip"}
                              </span>
                              <span className="text-xs text-zinc-300 font-mono truncate">{r.file_name}</span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <a
                                href={`${BASE}/api/sessions/${id}/resumes/${encodeURIComponent(r.file_name)}/pdf`}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="View PDF"
                                className="text-zinc-600 hover:text-zinc-300 text-xs transition-colors"
                              >↗</a>
                              <button
                                onClick={() => handleToggleExemplar(r.file_name, r.is_exemplar)}
                                title={r.is_exemplar ? "Unmark as ideal" : "Mark as ideal candidate"}
                                className={`text-base transition-colors ${r.is_exemplar ? "text-yellow-400 hover:text-yellow-300" : "text-zinc-700 hover:text-zinc-400"}`}
                              >★</button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {(() => {
                      const exemplarCount = resumes.filter((r) => r.is_exemplar).length;
                      return exemplarCount >= 2 ? (
                        <Button
                          onClick={handleRubricFromExemplars}
                          disabled={busy}
                          variant="outline"
                          className="border-yellow-700 text-yellow-400 hover:bg-yellow-950 text-xs"
                        >
                          {busy ? "Generating rubric…" : `⭐ Regenerate Rubric from ${exemplarCount} Ideal Resumes`}
                        </Button>
                      ) : (
                        <p className="text-[11px] text-zinc-600">Star 2+ resumes to regenerate the rubric from examples</p>
                      );
                    })()}
                  </div>
                )}
              </div>
            )}

            {/* candidate results */}
            <FieldMatchTable
              results={session.preview_field_results}
              sessionId={id}
              resumes={resumes}
              onFeedback={handleImmediateFeedback}
            />

            <Separator className="bg-zinc-800" />

            {/* refine input — single free-form box with AI confirmation */}
            <div className="space-y-2">
              <label className="text-xs text-zinc-400 font-medium">
                What should change? The AI will confirm its interpretation before updating.
              </label>
              <Textarea
                placeholder={`e.g. "Require IIT/IIM, drop the consulting requirement, raise weight for 0-to-1 builders to 40%, make B2B SaaS experience a hard filter"`}
                value={instructionsText}
                onChange={(e) => {
                  setInstructionsText(e.target.value);
                  setInterpretResult(null); // clear stale interpretation on edit
                }}
                rows={3}
                className="bg-zinc-950 border-zinc-700 focus:border-zinc-500 text-zinc-200 text-sm resize-none"
              />
            </div>

            {/* AI interpretation confirmation panel */}
            {interpretResult && (
              <div className="rounded-xl border border-blue-700/50 bg-blue-950/20 px-4 py-4 space-y-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-blue-400">
                  🤖 Here's what I'll do — please confirm
                </p>
                <p className="text-sm text-blue-100 leading-relaxed">{interpretResult.interpretation}</p>
                {interpretResult.will_do.length > 0 && (
                  <ul className="space-y-1">
                    {interpretResult.will_do.map((action, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-blue-200">
                        <span className="text-blue-500 mt-0.5 shrink-0">→</span>
                        <span>{action}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="text-sm text-blue-300 font-medium">{interpretResult.confirmation_prompt}</p>
                <div className="flex gap-3 pt-1">
                  <Button
                    onClick={doRefine}
                    disabled={busy}
                    className="bg-blue-600 hover:bg-blue-500 text-white text-sm"
                  >
                    {busy ? "Applying…" : "Yes, apply"}
                  </Button>
                  <Button
                    onClick={() => setInterpretResult(null)}
                    disabled={busy}
                    variant="outline"
                    className="border-zinc-700 text-zinc-400 hover:bg-zinc-800 text-sm"
                  >
                    Cancel / Edit
                  </Button>
                </div>
              </div>
            )}

            <div className="flex gap-3 mt-6">
              <Button
                onClick={handleRequestRefine}
                disabled={busy || interpretPending}
                className="bg-white text-zinc-950 hover:bg-zinc-200"
              >
                {interpretPending ? "Interpreting…" : busy ? "Re-evaluating…" : "Re-evaluate"}
              </Button>
              <Button
                onClick={handleReload}
                disabled={busy}
                variant="outline"
                className="border-zinc-700 text-zinc-400 hover:bg-zinc-800"
              >
                {busy ? "Loading…" : "+ Load 2 More Resumes"}
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

        {/* ── step 3.5: background eval running ── */}
        {step === "running" && (
          <FullEvalProgressPanel session={session} />
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
            {/* audit: the exact rubric + final_evaluation_prompt CALL_3 was run against */}
            <RubricAuditPanel config={session.final_config ?? session.synthesized_config} />

            <FieldMatchTable results={session.full_results} sessionId={id} resumes={resumes} />

            {/* skipped resumes — unreadable PDFs or resumes excluded by cap */}
            {session.full_results._skipped && (
              <SkippedResumesPanel skipped={session.full_results._skipped} />
            )}

            {/* token breakdown */}
            <TokenUsagePanel totals={session.token_totals || {}} />
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

function CriteriaSummary({ jd }: { jd: JdAnalysis }) {
  const oneLiner = jd.one_liner ?? null;
  const baselineSignals = jd.baseline_signals ?? [];
  const p0Signals = jd.p0_signals ?? [];
  const redFlags = jd.red_flags ?? [];
  const roleContext = jd.role_context ?? {};
  const vagueReqs = jd.vague_requirements ?? [];

  return (
    <div className="space-y-6">
      {/* Role & Context Info */}
      <div className="flex flex-wrap items-center gap-2">
        {jd.role_type && (
          <span className="text-[10px] bg-zinc-800 text-zinc-400 border border-zinc-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
            {jd.role_type}
          </span>
        )}
        {roleContext.seniority_level && (
          <span className="text-[10px] bg-blue-900/30 text-blue-300 border border-blue-800/50 px-2 py-0.5 rounded-full font-medium">
            Seniority: {roleContext.seniority_level}
          </span>
        )}
        {roleContext.archetype && (
          <span className="text-[10px] bg-purple-900/30 text-purple-300 border border-purple-800/50 px-2 py-0.5 rounded-full font-medium">
            Archetype: {roleContext.archetype}
          </span>
        )}
        {roleContext.org_stage && (
          <span className="text-[10px] bg-emerald-900/30 text-emerald-300 border border-emerald-800/50 px-2 py-0.5 rounded-full font-medium">
            Stage: {roleContext.org_stage}
          </span>
        )}
      </div>

      {/* Person One-Liner */}
      {oneLiner && (
        <div className="bg-zinc-900/50 border-l-2 border-zinc-700 px-4 py-2.5">
          <p className="text-sm italic text-zinc-400">"{oneLiner}"</p>
        </div>
      )}

      {/* Requirements Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Baseline Signals */}
        <div className="space-y-3">
          <h4 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Baseline Signals</h4>
          <div className="space-y-2">
            {baselineSignals.length ? baselineSignals.map((signal, i) => (
              <div key={i} className="flex gap-2 text-sm text-zinc-300 leading-relaxed">
                <span className="text-zinc-600 mt-0.5 select-none">•</span>
                <span>{signal}</span>
              </div>
            )) : <p className="text-xs text-zinc-600">No baseline criteria extracted.</p>}
          </div>
        </div>

        {/* P0 Signals */}
        <div className="space-y-3">
          <h4 className="text-[10px] font-bold uppercase tracking-widest text-amber-500/80">P0 Signals (High Priority)</h4>
          <div className="space-y-2">
            {p0Signals.length ? p0Signals.map((signal, i) => (
              <div key={i} className="flex gap-2 text-sm text-amber-100/90 leading-relaxed">
                <span className="text-amber-500 mt-0.5 select-none">✦</span>
                <span>{signal}</span>
              </div>
            )) : <p className="text-xs text-zinc-600">No priority signals extraction.</p>}
          </div>
        </div>
      </div>

      {/* Red Flags & Vague Reqs */}
      <div className="pt-2 flex flex-col gap-4">
        {redFlags.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-red-500/80">Red Flags</h4>
            <div className="flex flex-wrap gap-2">
              {redFlags.map((f, i) => (
                <div key={i} className="flex items-center gap-2 bg-red-950/30 border border-red-900/40 px-3 py-1.5 rounded-lg">
                  <span className="text-xs text-zinc-200">{f.flag}</span>
                  {f.risk_type && (
                    <span className="text-[9px] font-mono text-red-400/70 uppercase border-l border-red-900/50 pl-2">
                      {f.risk_type.replace(/_/g, ' ')}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {vagueReqs.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Unverifiable Phrasing</h4>
            <div className="flex flex-wrap gap-1.5">
              {vagueReqs.map((req, i) => (
                <span key={i} className="text-[10px] bg-zinc-900 text-zinc-500 border border-zinc-800 px-2 py-0.5 rounded cursor-help" title="This requirement is too vague for objective scaling.">
                  {req}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── LessonsLearnedPanel ───────────────────────────────────────────────────────
// Shows one card per lesson derived from disagree feedback. Each card surfaces:
//   - What the recruiter said (reason_given)
//   - The generalised rule Gemini derived (lesson)
//   - Exactly what changed in the rubric (rubric_change)
// This lets the recruiter verify that their mental model shift was understood
// correctly BEFORE accepting the re-scored results.

function LessonsLearnedPanel({ lessons }: { lessons: LessonLearned[] }) {
  const [open, setOpen] = useState(false);
  if (!lessons || lessons.length === 0) return null;

  const actionColor = (action?: string) => {
    if (action === "should_pass" || action === "p0_booster") return "text-emerald-400 border-emerald-800/50 bg-emerald-950/20";
    if (action === "should_fail") return "text-red-400 border-red-800/50 bg-red-950/20";
    return "text-zinc-400 border-zinc-700 bg-zinc-900/40";
  };

  const actionLabel = (action?: string) => {
    if (action === "should_pass") return "Should PASS";
    if (action === "should_fail") return "Should FAIL";
    if (action === "p0_booster") return "P0 Boost";
    return action ?? "Feedback";
  };

  return (
    <div className="border border-amber-800/40 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-amber-950/20 hover:bg-amber-950/30 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-amber-300">🧠 Mental Model Shifts</span>
          <span className="text-[10px] font-mono bg-amber-950/40 text-amber-400 border border-amber-800/50 px-2 py-0.5 rounded-full">
            {lessons.length} lesson{lessons.length > 1 ? "s" : ""} applied
          </span>
        </div>
        <span className="text-amber-600 text-xs">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="px-4 py-4 bg-zinc-950/80 border-t border-amber-800/20 space-y-4">
          <p className="text-[10px] text-zinc-500 leading-relaxed">
            Each lesson below was derived from your disagree feedback and directly updated the evaluation rubric.
            Verify that the AI understood your intent before reviewing the re-scored candidates.
          </p>
          {lessons.map((l, i) => (
            <div key={i} className="border border-zinc-800 rounded-lg overflow-hidden">
              {/* header */}
              <div className="flex items-center gap-2 px-3 py-2 bg-zinc-900 border-b border-zinc-800">
                <span className="text-[10px] font-mono text-zinc-600">#{i + 1}</span>
                {l.candidate && (
                  <span className="text-[10px] font-semibold text-zinc-400 truncate">{l.candidate}</span>
                )}
                {l.action && (
                  <span className={`text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${actionColor(l.action)}`}>
                    {actionLabel(l.action)}
                  </span>
                )}
              </div>

              <div className="px-3 py-3 space-y-3">
                {/* what the recruiter said */}
                {l.reason_given && (
                  <div className="space-y-0.5">
                    <p className="text-[9px] font-semibold uppercase tracking-wider text-zinc-600">You said</p>
                    <p className="text-xs text-zinc-400 italic leading-relaxed">"{l.reason_given}"</p>
                  </div>
                )}

                {/* the generalised lesson */}
                {l.lesson && (
                  <div className="space-y-0.5">
                    <p className="text-[9px] font-semibold uppercase tracking-wider text-amber-600">Derived rule</p>
                    <p className="text-xs text-amber-200/90 leading-relaxed">{l.lesson}</p>
                  </div>
                )}

                {/* what changed in the rubric */}
                {l.rubric_change && (
                  <div className="space-y-0.5">
                    <p className="text-[9px] font-semibold uppercase tracking-wider text-blue-600">Rubric change</p>
                    <p className="text-xs text-blue-300/80 leading-relaxed font-mono text-[10px]">{l.rubric_change}</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── ActiveRubricPanel ─────────────────────────────────────────────────────────
// Shows the current synthesized rubric (baseline checks, P0 weights, red flags)
// with interactive controls: hard/soft toggle per baseline check, weight sliders
// for P0 signals. Changes auto-save via debounce + reclassify (zero LLM cost).

type BaselineCheck = { check: string; resume_field: string; reject_if_missing: boolean };
type P0Weight = { signal: string; weight: number; resume_field: string };

function ActiveRubricPanel({
  config,
  onEdit,
}: {
  config: Record<string, unknown> | null;
  onEdit?: (patch: { baseline_checks?: BaselineCheck[]; p0_weights?: P0Weight[] }) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [localChecks, setLocalChecks] = useState<BaselineCheck[]>([]);
  const [localWeights, setLocalWeights] = useState<P0Weight[]>([]);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editingRef = useRef(false);

  // Sync local state from parent config, but skip if we're mid-debounce edit
  useEffect(() => {
    if (editingRef.current) return;
    if (!config) return;
    const rubric = (config.scoring_rubric as Record<string, unknown>) ?? {};
    setLocalChecks((rubric.baseline_checks as BaselineCheck[]) ?? []);
    setLocalWeights((rubric.p0_weights as P0Weight[]) ?? []);
  }, [config]);

  if (!config) return null;

  const rubric = (config.scoring_rubric as Record<string, unknown>) ?? {};
  const redFlagChecks = (rubric.red_flag_checks as Array<{ check: string; resume_field: string }>) ?? [];
  const screeningSummary = config.screening_summary as string | undefined;
  const finalPrompt = config.final_evaluation_prompt as string | undefined;

  const totalItems = localChecks.length + localWeights.length + redFlagChecks.length;
  if (totalItems === 0) return null;

  function scheduleSave(checks: BaselineCheck[], weights: P0Weight[]) {
    if (!onEdit) return;
    editingRef.current = true;
    setSaveStatus("idle");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSaveStatus("saving");
      try {
        await onEdit({ baseline_checks: checks, p0_weights: weights });
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 2000);
      } catch {
        setSaveStatus("idle");
      } finally {
        editingRef.current = false;
      }
    }, 600);
  }

  function toggleHardSoft(checkText: string) {
    const updated = localChecks.map((c) =>
      c.check === checkText ? { ...c, reject_if_missing: !c.reject_if_missing } : c,
    );
    setLocalChecks(updated);
    scheduleSave(updated, localWeights);
  }

  function updateWeight(idx: number, val: number) {
    const updated = localWeights.map((w, i) => (i === idx ? { ...w, weight: val } : w));
    setLocalWeights(updated);
    scheduleSave(localChecks, updated);
  }

  const hardChecks = localChecks.filter((c) => c.reject_if_missing !== false);
  const softChecks = localChecks.filter((c) => c.reject_if_missing === false);
  const totalWeight = localWeights.reduce((s, w) => s + (w.weight ?? 0), 0);

  return (
    <div className="border border-zinc-800 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-zinc-900 hover:bg-zinc-800/80 transition-colors text-left"
      >
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs font-semibold text-zinc-200">⚖️ Active Evaluation Criteria</span>
          <span className="text-[10px] font-mono bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full">
            {hardChecks.length} hard · {softChecks.length > 0 ? `${softChecks.length} relaxed · ` : ""}
            {localWeights.length} P0 · {redFlagChecks.length} flags
          </span>
          {onEdit && saveStatus === "saving" && (
            <span className="text-[10px] text-yellow-400 animate-pulse">Saving…</span>
          )}
          {onEdit && saveStatus === "saved" && (
            <span className="text-[10px] text-emerald-400">✓ Saved</span>
          )}
        </div>
        <span className="text-zinc-600 text-xs">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="px-4 py-4 bg-zinc-950/80 border-t border-zinc-800/60 space-y-5">
          {screeningSummary && (
            <p className="text-xs text-zinc-400 italic border-l-2 border-zinc-700 pl-3 leading-relaxed">
              {screeningSummary}
            </p>
          )}

          {onEdit && (
            <p className="text-[10px] text-zinc-600 italic">
              Toggle hard/soft on any baseline check, or drag a P0 weight slider — changes apply instantly (no LLM re-score needed).
            </p>
          )}

          {/* Full evaluation prompt */}
          {finalPrompt && (
            <details className="group">
              <summary className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 cursor-pointer hover:text-zinc-300 select-none">
                📝 Full Evaluation Prompt{" "}
                <span className="text-zinc-600 font-normal normal-case">(click to verify it includes your parameters)</span>
              </summary>
              <div className="mt-2 bg-zinc-900 border border-zinc-700 rounded-lg p-3 max-h-48 overflow-y-auto">
                <p className="text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap">{finalPrompt}</p>
              </div>
            </details>
          )}

          {/* Baseline checks — with hard/soft toggle */}
          {localChecks.length > 0 && (
            <div className="space-y-3">
              {hardChecks.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                    ⛔ Hard Filters{" "}
                    <span className="text-red-500 font-normal">(fail = auto reject)</span>
                  </p>
                  <div className="space-y-1.5">
                    {hardChecks.map((c) => (
                      <div
                        key={c.check}
                        className="flex items-start gap-3 text-xs bg-zinc-900/60 border border-zinc-800 rounded-lg px-3 py-2"
                      >
                        <span className="text-red-400 shrink-0 mt-0.5">⛔</span>
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <p className="text-zinc-200 leading-relaxed">{c.check}</p>
                          <p className="text-zinc-600">
                            Field: <span className="font-mono text-zinc-500">{c.resume_field}</span>
                          </p>
                        </div>
                        {onEdit && (
                          <button
                            onClick={() => toggleHardSoft(c.check)}
                            title="Make this a soft preference instead of a hard gate"
                            className="shrink-0 mt-0.5 text-[10px] bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-emerald-400 border border-zinc-700 rounded px-1.5 py-0.5 transition-colors"
                          >
                            → Soft
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {softChecks.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                    ✅ Relaxed Criteria{" "}
                    <span className="text-green-600 font-normal">(preference, not a gate)</span>
                  </p>
                  <div className="space-y-1.5">
                    {softChecks.map((c) => (
                      <div
                        key={c.check}
                        className="flex items-start gap-3 text-xs bg-green-950/20 border border-green-800/40 rounded-lg px-3 py-2"
                      >
                        <span className="text-green-500 shrink-0 mt-0.5">✅</span>
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <p className="text-zinc-300 leading-relaxed">{c.check}</p>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-zinc-600">
                              Field: <span className="font-mono text-zinc-500">{c.resume_field}</span>
                            </p>
                            <span className="text-[9px] bg-green-950/60 text-green-400 border border-green-800/50 px-1.5 py-0.5 rounded font-semibold uppercase tracking-wide">
                              Not a hard filter
                            </span>
                          </div>
                        </div>
                        {onEdit && (
                          <button
                            onClick={() => toggleHardSoft(c.check)}
                            title="Make this a hard rejection filter again"
                            className="shrink-0 mt-0.5 text-[10px] bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-red-400 border border-zinc-700 rounded px-1.5 py-0.5 transition-colors"
                          >
                            → Hard
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* P0 weights — interactive sliders */}
          {localWeights.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                  🎯 P0 Signal Weights{" "}
                  <span className="text-zinc-600 font-normal">(drag to adjust — must sum to ~100)</span>
                </p>
                <span
                  className={`text-[10px] font-mono ${
                    Math.abs(totalWeight - 100) <= 5 ? "text-zinc-600" : "text-amber-400"
                  }`}
                >
                  Σ = {totalWeight}
                </span>
              </div>
              <div className="space-y-3">
                {localWeights.map((w, i) => (
                  <div key={i} className="space-y-1">
                    <div className="flex items-center gap-2 text-xs">
                      <p className="flex-1 text-zinc-300 min-w-0 truncate">{w.signal}</p>
                      <span className="shrink-0 font-mono font-bold text-emerald-400 w-8 text-right">
                        {w.weight}
                      </span>
                    </div>
                    {onEdit ? (
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={1}
                        value={w.weight}
                        onChange={(e) => updateWeight(i, Number(e.target.value))}
                        className="w-full h-1.5 accent-emerald-500 cursor-pointer"
                      />
                    ) : (
                      <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full"
                          style={{ width: `${Math.min(w.weight, 100)}%` }}
                        />
                      </div>
                    )}
                    <p className="text-[10px] text-zinc-700 font-mono">{w.resume_field}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Red flag checks — read-only */}
          {redFlagChecks.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                🚩 Red Flag Checks{" "}
                <span className="text-zinc-600 font-normal">(deprioritise if present)</span>
              </p>
              <div className="space-y-1.5">
                {redFlagChecks.map((f, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 text-xs bg-orange-950/20 border border-orange-900/30 rounded-lg px-3 py-2"
                  >
                    <span className="text-orange-400 shrink-0 mt-0.5">⚠️</span>
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-zinc-300 leading-relaxed">{f.check}</p>
                      <p className="text-zinc-600">
                        Field: <span className="font-mono text-zinc-500">{f.resume_field}</span>
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── RubricAuditPanel ──────────────────────────────────────────────────────────
// Shows the exact rubric + final_evaluation_prompt that CALL_3 was run against
// so the recruiter can verify their updates actually propagated through synthesis.

function RubricAuditPanel({ config }: { config: any }) {
  const [open, setOpen] = useState(false);
  if (!config) return null;
  const rubric = config.scoring_rubric || {};
  const baselineChecks = rubric.baseline_checks || [];
  const p0Weights = rubric.p0_weights || [];
  const redFlags = rubric.red_flag_checks || [];
  const hardCount = baselineChecks.filter((c: any) => c?.reject_if_missing !== false).length;
  const softCount = baselineChecks.length - hardCount;

  return (
    <div className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-900/40">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-800/40 text-left"
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-zinc-200">🔍 Rubric Audit — what the model actually scored against</span>
          <span className="text-[10px] text-zinc-500">
            {hardCount} hard · {softCount} soft · {p0Weights.length} P0 · {redFlags.length} flags
          </span>
        </div>
        <span className="text-zinc-600 text-xs">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="px-4 py-4 space-y-5 border-t border-zinc-800 text-xs">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-2">Baseline Checks</p>
            {baselineChecks.length === 0 && <p className="text-zinc-600 italic">none</p>}
            {baselineChecks.map((c: any, i: number) => {
              const hard = c?.reject_if_missing !== false;
              return (
                <div key={i} className="mb-1.5 flex gap-2">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${hard ? "bg-red-950/60 text-red-300 border border-red-800/50" : "bg-blue-950/40 text-blue-300 border border-blue-800/40"}`}>
                    {hard ? "HARD" : "soft"}
                  </span>
                  <span className="text-zinc-300 leading-relaxed">{c?.check}</span>
                </div>
              );
            })}
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-2">P0 Weights</p>
            {p0Weights.length === 0 && <p className="text-zinc-600 italic">none</p>}
            {p0Weights.map((w: any, i: number) => (
              <div key={i} className="mb-1 flex gap-2">
                <span className="text-[10px] bg-emerald-950/50 text-emerald-300 border border-emerald-800/40 px-1.5 py-0.5 rounded shrink-0 font-mono">{w?.weight ?? 0}</span>
                <span className="text-zinc-300">{w?.signal}</span>
              </div>
            ))}
          </div>
          {redFlags.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-2">Red Flags</p>
              {redFlags.map((f: any, i: number) => (
                <p key={i} className="text-orange-300 mb-1">• {f?.check}</p>
              ))}
            </div>
          )}
          {config.final_evaluation_prompt && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-2">Final Evaluation Prompt (verbatim — this is what the grading model sees)</p>
              <pre className="whitespace-pre-wrap break-words bg-black/40 border border-zinc-800 rounded p-3 text-[11px] text-zinc-400 leading-relaxed max-h-96 overflow-y-auto">
                {config.final_evaluation_prompt}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── SkippedResumesPanel ───────────────────────────────────────────────────────
// Surfaces resumes that were not included in the full evaluation, and explains
// exactly why — either the PDF was unreadable, or the batch exceeded the cap.

function SkippedResumesPanel({ skipped }: { skipped: SkippedInfo }) {
  const [open, setOpen] = useState(false);

  const unreadable = skipped.unreadable ?? [];
  const sampledOut = skipped.sampled_out ?? [];
  const modelDropped = skipped.model_dropped ?? [];
  const total = unreadable.length + sampledOut.length + modelDropped.length;
  if (total === 0) return null;

  return (
    <div className="border border-zinc-700 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-zinc-900 hover:bg-zinc-800/80 transition-colors text-left"
      >
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs font-semibold text-zinc-300">⚠️ Resumes Not Evaluated</span>
          <span className="text-[10px] font-mono bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full">
            {total} skipped
            {unreadable.length > 0 && ` · ${unreadable.length} unreadable`}
            {sampledOut.length > 0 && ` · ${sampledOut.length} over cap`}
            {modelDropped.length > 0 && ` · ${modelDropped.length} dropped by model`}
          </span>
        </div>
        <span className="text-zinc-600 text-xs">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="px-4 py-4 bg-zinc-950/80 border-t border-zinc-800/60 space-y-5">
          <p className="text-xs text-zinc-500 leading-relaxed">
            These resumes were not scored in the full evaluation. See reason below.
            Fix unreadable PDFs by re-uploading a text-based PDF (not a scanned image).
            Model-dropped resumes can be retried by re-running the full evaluation.
          </p>

          {unreadable.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-red-500/80">
                🚫 Unreadable PDFs <span className="text-zinc-600 font-normal">(text extraction failed)</span>
              </p>
              <div className="space-y-1.5">
                {unreadable.map((r, i) => (
                  <div key={i} className="flex items-start gap-3 bg-red-950/20 border border-red-900/30 rounded-lg px-3 py-2.5">
                    <span className="text-red-400 shrink-0 mt-0.5 text-sm">✕</span>
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-sm text-zinc-200 font-mono truncate">{r.file_name}</p>
                      <p className="text-xs text-zinc-500 leading-relaxed">{r.reason}</p>
                      {r.quality && (
                        <p className="text-[10px] text-zinc-600 font-mono">
                          quality: {JSON.stringify(r.quality)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {modelDropped.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-orange-500/80">
                🤖 Dropped by Model <span className="text-zinc-600 font-normal">(sent to AI but missing from response)</span>
              </p>
              <div className="space-y-1.5">
                {modelDropped.map((r, i) => (
                  <div key={i} className="flex items-start gap-3 bg-orange-950/20 border border-orange-900/30 rounded-lg px-3 py-2.5">
                    <span className="text-orange-400 shrink-0 mt-0.5 text-sm">?</span>
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-sm text-zinc-200 font-mono truncate">{r.file_name}</p>
                      <p className="text-xs text-zinc-500 leading-relaxed">{r.reason}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {sampledOut.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                📦 Over Cap <span className="text-zinc-600 font-normal">(excluded by representative sampling)</span>
              </p>
              <div className="space-y-1.5">
                {sampledOut.map((r, i) => (
                  <div key={i} className="flex items-start gap-3 bg-zinc-900/60 border border-zinc-800 rounded-lg px-3 py-2.5">
                    <span className="text-zinc-500 shrink-0 mt-0.5 text-sm">–</span>
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-sm text-zinc-300 font-mono truncate">{r.file_name}</p>
                      <p className="text-xs text-zinc-500 leading-relaxed">{r.reason}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TokenUsagePanel({ totals }: { totals: Record<string, any> }) {
  if (!totals || Object.keys(totals).length === 0) return null;
  const totalTokens = totals._total_tokens || 0;
  const callEntries = Object.entries(totals).filter(([key]) => key !== "_total_tokens");

  return (
    <details className="mt-8 group">
      <summary className="text-xs font-semibold text-zinc-500 uppercase tracking-wider cursor-pointer hover:text-zinc-300 list-none flex items-center gap-2 select-none">
        <span className="text-zinc-600 group-open:rotate-90 transition-transform">▸</span>
        Token Usage Breakdown
      </summary>
      
      <div className="mt-3 p-4 bg-zinc-900 border border-zinc-800 rounded-xl space-y-4">
        <div className="grid grid-cols-2 gap-4 pb-4 border-b border-zinc-800/50">
          <div>
            <p className="text-[10px] text-zinc-500 uppercase mb-1">Total Tokens</p>
            <p className="text-lg text-emerald-400 font-mono">{totalTokens.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-[10px] text-zinc-500 uppercase mb-1">API Calls Tracked</p>
            <p className="text-lg text-zinc-200 font-mono">{callEntries.length}</p>
          </div>
        </div>

        <div className="space-y-2">
          {callEntries.map(([name, data]) => {
            const row = data as Record<string, any>;
            return (
              <div key={name} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-zinc-950/60 border border-zinc-800/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-zinc-300">{name}</span>
                  {row.latency_seconds ? (
                    <span className="text-[10px] bg-zinc-800/80 border border-zinc-700 text-zinc-400 px-2 py-0.5 rounded-full font-mono flex items-center gap-1">
                      <span className="text-emerald-500 shrink-0">⚡</span> {row.latency_seconds}s
                    </span>
                  ) : null}
                </div>
                <div className="flex items-center gap-6 text-[11px] font-mono">
                  <div className="flex flex-col items-end">
                    <span className="text-zinc-600 mb-0.5 uppercase">In</span>
                    <span className="text-zinc-400">{row.input_tokens?.toLocaleString() || 0}</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-zinc-600 mb-0.5 uppercase">Out</span>
                    <span className="text-zinc-400">{row.output_tokens?.toLocaleString() || 0}</span>
                  </div>
                  <div className="flex flex-col items-end w-16">
                    <span className="text-zinc-600 mb-0.5 uppercase">Total</span>
                    <span className="text-blue-400 font-medium text-xs">{row.total_tokens?.toLocaleString() || 0}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </details>
  );
}

function FullEvalProgressPanel({ session }: { session: Session }) {
  const progress = session.full_eval_progress || { status: "queued" as const };
  const scored = progress.scored ?? 0;
  const total = progress.total ?? 0;
  const pct = total > 0 ? Math.round((scored / total) * 100) : 0;
  const isError = progress.status === "error";

  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader>
        <CardTitle className="text-zinc-100">
          {isError
            ? "Full evaluation failed"
            : progress.status === "queued"
            ? "Queuing full evaluation…"
            : "Scoring resumes in the background"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isError && (
          <>
            <div className="text-sm text-zinc-400">
              {scored} / {total} scored ({pct}%)
            </div>
            <div className="w-full h-2 bg-zinc-800 rounded overflow-hidden">
              <div
                className="h-full bg-green-500 transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="text-xs text-zinc-500">
              The evaluation runs asynchronously — you can leave this page and come back.
              Partial results are saved after every resume so nothing is lost if something fails.
            </p>
          </>
        )}
        {isError && (
          <div className="text-sm text-red-400">
            {progress.error || "The background worker hit an error. You can re-click Accept to resume from the last checkpoint."}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
