"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  api, BASE,
  type Session, type CandidateFeedback, type InterpretResponse,
  type JdAnalysis, type ResumeListItem, type LessonLearned, type SkippedInfo,
} from "@/lib/api";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { FieldMatchTable } from "@/components/field-match-table";
import {
  FileText, Upload, RefreshCw, Trophy, AlertTriangle, Info,
  Zap, Play, XCircle, CheckCircle2, Search, Scale, Brain,
  Star, Flag, Target, MessageSquare, Layers, Clock,
  ArrowLeft, ExternalLink, ChevronUp, ChevronDown, X, Check,
} from "lucide-react";
import { AiThinking } from "@/components/ai-thinking";

/* ── types ─────────────────────────────────────────────────────────── */
type Step = "jd" | "resumes" | "preview" | "running" | "results";
type BaselineCheck = { check: string; resume_field: string; reject_if_missing: boolean };
type P0Weight      = { signal: string; weight: number; resume_field: string };

const STEP_ORDER: Step[] = ["jd", "resumes", "preview", "results"];

function stepFromStatus(s: Session): Step {
  if (s.status === "completed")       return "results";
  if (s.status === "running_full_eval") return "running";
  if (s.status === "preview_active")  return "preview";
  if (["resumes_uploaded", "jd_analyzed", "rubric_ready"].includes(s.status)) return "resumes";
  return "jd";
}

/* ── small primitives ──────────────────────────────────────────────── */
function Spinner({ sm }: { sm?: boolean }) {
  const sz = sm ? "w-3 h-3 border-[1.5px]" : "w-4 h-4 border-2";
  return <span className={`inline-block ${sz} border-white/20 border-t-white rounded-full animate-spin`} />;
}

const PROC_MSGS = [
  "Parsing job description details…",
  "Extracting signals & requirements…",
  "Building your evaluation rubric…",
  "Cross-referencing hiring patterns…",
  "Finalising criteria…",
];
const RESUME_MSGS = ["Parsing resume structure…", "Extracting timelines…", "Identifying skills…", "Mapping to requirements…"];
const EVAL_TIPS   = [
  "You can leave this page — evaluation runs in the background.",
  "Each resume is scored against your final rubric.",
  "Partial results are saved after every resume.",
  "P0 candidates will top your results.",
  "Red flags and baseline failures are checked for every candidate.",
];

function BounceMsg({ msgs }: { msgs: string[] }) {
  const [i, setI] = useState(0);
  useEffect(() => { const t = setInterval(() => setI(n => (n + 1) % msgs.length), 2600); return () => clearInterval(t); }, [msgs]);
  return (
    <div className="flex items-center gap-3">
      <div className="flex gap-1">
        {[0, 1, 2].map(d => (
          <span key={d} className="w-1.5 h-1.5 rounded-full bg-blue-500"
            style={{ animationDelay: `${d * 0.18}s`, animation: `nh-bounce-dot 1.3s ease-in-out ${d * 0.18}s infinite` }} />
        ))}
      </div>
      <span className="text-blue-300/80 text-sm">{msgs[i]}</span>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   SESSION PAGE
═══════════════════════════════════════════════════════════════════ */
export default function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id }   = use(params);
  const router   = useRouter();

  const [session,   setSession]   = useState<Session | null>(null);
  const [resumes,   setResumes]   = useState<ResumeListItem[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [busy,      setBusy]      = useState(false);
  const [error,     setError]     = useState("");
  const [step,      setStep]      = useState<Step>("jd");
  const [viewStep,  setViewStep]  = useState<Step | null>(null);   // back-nav override

  const [jdText,         setJdText]         = useState("");
  const [files,          setFiles]          = useState<File[]>([]);
  const [instrText,      setInstrText]      = useState("");
  const [exemplarOpen,   setExemplarOpen]   = useState(false);
  const [candFeedback,   setCandFeedback]   = useState<CandidateFeedback[]>([]);
  const [interpretPend,  setInterpretPend]  = useState(false);
  const [interpretRes,   setInterpretRes]   = useState<InterpretResponse | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Clear viewStep whenever session naturally advances
  useEffect(() => { setViewStep(null); }, [step]);

  const view = viewStep ?? step;

  const refresh = useCallback(async () => {
    const s = await api.getSession(id);
    setSession(s);
    setStep(stepFromStatus(s));
    if (s.jd_text) setJdText(s.jd_text);
    return s;
  }, [id]);

  const refreshResumes = useCallback(() => {
    api.listResumes(id).then(setResumes).catch(console.warn);
  }, [id]);

  useEffect(() => { refresh().catch(() => setError("Session not found.")).finally(() => setLoading(false)); }, [refresh]);
  useEffect(() => { refreshResumes(); }, [refreshResumes]);

  // Poll during background eval
  useEffect(() => {
    if (!session) return;
    const active = session.status === "running_full_eval"
      || session.full_eval_progress?.status === "running"
      || session.full_eval_progress?.status === "queued";
    if (!active) return;
    const iv = setInterval(() => {
      api.getSession(id).then(s => {
        setSession(s); setStep(stepFromStatus(s));
        if (s.status === "completed" || s.full_eval_progress?.status === "error") clearInterval(iv);
      }).catch(() => {});
    }, 3000);
    return () => clearInterval(iv);
  }, [id, session?.status, session?.full_eval_progress?.status]);

  async function run<T>(fn: () => Promise<T>, opts?: { refreshResumes?: boolean }) {
    setBusy(true); setError("");
    try {
      const r = await fn();
      await refresh();
      if (opts?.refreshResumes) refreshResumes();
      return r;
    } catch (e) { setError((e as Error).message); }
    finally      { setBusy(false); }
  }

  function analyzeJD()      { run(() => api.analyzeJD(id, jdText)); }
  function uploadResumes()  {
    if (!files.length) { setError("Select at least one PDF."); return; }
    run(() => api.uploadResumes(id, files), { refreshResumes: true });
  }
  function startPreview()   { run(() => api.startPreview(id), { refreshResumes: true }); }
  function reloadPreview()  { run(() => api.reloadPreview(id), { refreshResumes: true }); }
  function acceptAll()      { run(() => api.accept(id), { refreshResumes: true }); }

  async function requestRefine() {
    if (!instrText.trim()) { doRefine(); return; }
    setInterpretPend(true); setInterpretRes(null); setError("");
    try { setInterpretRes(await api.interpretInstructions(id, instrText)); }
    catch (e) { setError((e as Error).message); }
    finally   { setInterpretPend(false); }
  }

  function doRefine() {
    setInterpretRes(null);
    run(() => api.refinePreview(id, instrText, candFeedback), { refreshResumes: true })
      .then(() => { setInstrText(""); setCandFeedback([]); });
  }

  function immediateFeedback(fb: CandidateFeedback) {
    run(() => api.refinePreview(id, "", [fb]), { refreshResumes: true });
  }

  async function patchReclassify(patch: { baseline_checks?: BaselineCheck[]; p0_weights?: P0Weight[] }) {
    setBusy(true); setError("");
    try {
      await api.patchRubric(id, patch);
      if ((session as Session).preview_field_results?.results?.length) await api.reclassifyPreview(id);
      await refresh();
    } catch (e) { setError((e as Error).message); }
    finally     { setBusy(false); }
  }

  async function toggleExemplar(name: string, cur: boolean) {
    try {
      const u = await api.markExemplar(id, name, !cur);
      setResumes(prev => prev.map(r => r.file_name === name ? { ...r, is_exemplar: u.is_exemplar } : r));
    } catch (e) { setError((e as Error).message); }
  }

  /* ── loading / error ── */
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="nh-card p-12 flex flex-col items-center gap-6">
        <div className="w-12 h-12 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
        <p className="text-[#6c80a8] text-sm">Loading session…</p>
      </div>
    </div>
  );

  if (!session) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="nh-card p-12 flex flex-col items-center gap-4 text-center">
        <p className="text-red-400 text-sm">{error || "Session not found."}</p>
        <button onClick={() => router.push("/")} className="nh-btn-ghost flex items-center gap-2 px-6 py-2 text-sm">
          <ArrowLeft size={14} /> All Sessions
        </button>
      </div>
    </div>
  );

  const jd     = session.jd_analysis;
  const config = session.synthesized_config as Record<string, unknown> | null;
  const tokens = (session.token_totals as Record<string, unknown>)?._total_tokens as number | undefined;

  return (
    <div className="min-h-screen flex flex-col">

      {/* ── Top bar ───────────────────────────────────────────────── */}
      <header className="nh-nav sticky top-0 z-50">
        <div className="px-8 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => router.push("/")} className="flex items-center gap-2 hover:opacity-75 transition-opacity shrink-0">
              <div
                className="w-6 h-6 rounded-lg flex items-center justify-center font-black text-white text-xs"
                style={{ background: "linear-gradient(135deg,#4f6ef7,#06b6d4)" }}
              >
                N
              </div>
              <span className="font-bold text-white text-sm hidden sm:block">NextHire</span>
            </button>
            <span className="text-[#2a3a5a] hidden sm:block text-sm">/</span>
            <span className="text-[#8899b8] text-sm font-medium truncate">
              {jd ? String((jd as any).role ?? "Session") : "New Session"}
            </span>
            {jd && (jd as any).role_context?.seniority_level && (
              <span
                className="text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wide shrink-0 hidden md:block"
                style={{ background: "rgba(37,99,235,0.12)", border: "1px solid rgba(96,165,250,0.2)", color: "#93c5fd" }}
              >
                {(jd as any).role_context.seniority_level}
              </span>
            )}
          </div>

          <div className="flex items-center gap-4 shrink-0">
            {session.preview_iteration_count > 0 && (
              <span className="text-[#3a5080] text-xs hidden sm:block">
                iter <span className="text-blue-400 font-mono font-bold">{session.preview_iteration_count}</span>
              </span>
            )}
            {tokens && (
              <span className="text-[#3a5080] text-[11px] font-mono hidden sm:block">{tokens.toLocaleString()} tok</span>
            )}
          </div>
        </div>

        {/* Step nav strip */}
        <StepNav current={step} view={view} onNavigate={setViewStep} />
      </header>

      {/* ── Error banner ──────────────────────────────────────────── */}
      {error && (
        <div className="sticky top-[calc(4rem+3.5rem)] z-40 px-8 py-2">
          <div className="nh-card p-4 flex items-center justify-between gap-3" style={{ background: "rgba(239,68,68,0.08)", borderColor: "rgba(239,68,68,0.25)" }}>
            <p className="text-red-400 text-sm">{error}</p>
            <button onClick={() => setError("")} className="text-red-600 hover:text-red-400 shrink-0"><X size={13} /></button>
          </div>
        </div>
      )}

      {/* ── Content ───────────────────────────────────────────────── */}
      <div className="flex-1 px-8 py-10 max-w-4xl mx-auto w-full space-y-10">

        {/* ═══ STEP 1: JD ════════════════════════════════════════ */}
        {view === "jd" && (
          <>
            <PageHeader icon={<FileText size={16} />} title="Job Description Analysis"
              sub="Paste the full job description — AI extracts baseline signals, P0 requirements, and red flags automatically." />

            <div className="nh-card p-8 space-y-6">
              <Textarea
                placeholder={`Paste the full job description here…\n\nTip: include requirements, preferred skills, and cultural fit notes — the more detail, the sharper the rubric.`}
                value={jdText}
                onChange={e => setJdText(e.target.value)}
                rows={14}
                className="w-full text-sm resize-none"
              />

              <div className="flex items-center gap-4 flex-wrap">
                <button onClick={analyzeJD} disabled={busy || !jdText.trim()} className="nh-btn-primary flex items-center gap-2 px-6 py-3 text-sm">
                  {busy ? <><Spinner sm /> Analyzing…</> : "Analyze JD"}
                </button>
                {busy && <BounceMsg msgs={PROC_MSGS} />}
                {jdText.trim() && !busy && (
                  <span className="text-[#3a5080] text-xs">~{Math.max(10, Math.round(jdText.length / 200))}s estimate</span>
                )}
              </div>
            </div>

            {/* JD tip cards */}
            {!jdText.trim() && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { t: "Baseline Signals", d: "Non-negotiable requirements every candidate must meet",    color: "#4f6ef7", icon: "●" },
                  { t: "P0 Signals",       d: "High-priority differentiators that define the ideal hire", color: "#8b5cf6", icon: "★" },
                  { t: "Red Flags",        d: "Patterns that indicate poor culture or role fit",           color: "#f59e0b", icon: "⚑" },
                ].map(({ t, d, color, icon }) => (
                  <div key={t} className="nh-card p-6 space-y-3">
                    <div className="flex items-center gap-2.5">
                      <span className="text-base leading-none" style={{ color }}>{icon}</span>
                      <p className="text-sm font-semibold text-white">{t}</p>
                    </div>
                    <p className="text-[#566b99] text-xs leading-relaxed">{d}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Prior analysis result (shown when navigating back) */}
            {jd && step !== "jd" && (
              <div className="nh-card p-6 space-y-5" style={{ borderColor: "rgba(96,165,250,0.22)" }}>
                <div className="flex items-center justify-between">
                  <p className="text-blue-400/70 text-xs font-semibold uppercase tracking-widest">Previous Analysis</p>
                  <button onClick={() => setViewStep(null)} className="nh-btn-ghost px-4 py-1.5 text-xs">
                    Continue to {step === "running" ? "Evaluating" : step.charAt(0).toUpperCase() + step.slice(1)} →
                  </button>
                </div>
                <CriteriaSummary jd={jd as JdAnalysis} />
              </div>
            )}
          </>
        )}

        {/* ═══ STEP 2: RESUMES ═══════════════════════════════════ */}
        {(view === "resumes" || (view === "preview" && !session.preview_field_results)) && (
          <>
            <PageHeader icon={<Upload size={16} />} title="Upload Resumes"
              sub="Upload PDF resumes — each one is parsed into structured JSON ready for evaluation." />

            {/* JD pill */}
            {jd && (
              <button onClick={() => setViewStep("jd")} className="w-full nh-card nh-card-hover p-5 flex items-center gap-4 text-left group">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: "rgba(37,99,235,0.12)", border: "1px solid rgba(96,165,250,0.2)" }}>
                  <FileText size={14} className="text-blue-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[#c8d8f0] text-sm font-medium truncate">
                    {(jd as any).role ?? "Analysed JD"} — {((jd as any).baseline_signals?.length ?? 0)} baseline · {((jd as any).p0_signals?.length ?? 0)} P0 signals
                  </p>
                  {(jd as any).one_liner && (
                    <p className="text-[#4a6080] text-xs italic truncate mt-0.5">"{(jd as any).one_liner}"</p>
                  )}
                </div>
                <span className="text-[#3a5080] text-xs group-hover:text-blue-400 transition-colors shrink-0">Edit ›</span>
              </button>
            )}

            <div className="nh-card p-8 space-y-6">
              {/* Drop zone */}
              <div
                className="rounded-xl p-12 text-center cursor-pointer transition-all group"
                style={{ border: "2px dashed rgba(96,165,250,0.2)", background: "rgba(6,15,38,0.4)" }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = "rgba(96,165,250,0.45)")}
                onMouseLeave={e => (e.currentTarget.style.borderColor = "rgba(96,165,250,0.2)")}
                onClick={() => fileRef.current?.click()}
              >
                <div className="w-12 h-12 mx-auto rounded-xl flex items-center justify-center mb-4 nh-float text-blue-400"
                  style={{ background: "rgba(37,99,235,0.1)", border: "1px solid rgba(96,165,250,0.2)" }}>
                  <Upload size={22} />
                </div>

                {files.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-blue-400 font-semibold">{files.length} PDF{files.length > 1 ? "s" : ""} selected</p>
                    <p className="text-[#4a6080] text-xs">{files.map(f => f.name).join(", ").slice(0, 90)}{files.map(f => f.name).join(", ").length > 90 ? "…" : ""}</p>
                    <button onClick={e => { e.stopPropagation(); setFiles([]); }} className="text-[#3a5080] hover:text-red-400 text-xs transition-colors mt-1">
                      Clear
                    </button>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <p className="text-[#6c80a8] text-sm">Click to select PDF resumes</p>
                    <p className="text-[#3a5080] text-xs">Multiple files supported</p>
                  </div>
                )}

                <input ref={fileRef} type="file" accept=".pdf" multiple className="hidden"
                  onChange={e => setFiles(Array.from(e.target.files ?? []))} />
              </div>

              <div className="flex items-center gap-4 flex-wrap">
                <button onClick={uploadResumes} disabled={busy || !files.length} className="nh-btn-primary flex items-center gap-2 px-6 py-3 text-sm">
                  {busy ? <><Spinner sm /> Parsing…</> : "Parse Resumes"}
                </button>
                {busy && <BounceMsg msgs={RESUME_MSGS} />}
              </div>
            </div>
          </>
        )}

        {/* Resumes parsed confirmation */}
        {view === "resumes" && ["resumes_uploaded", "rubric_ready"].includes(session.status) && (
          <ParseConfirmation session={session} resumes={resumes} id={id} busy={busy}
            onToggleExemplar={toggleExemplar} onRubricFromExemplars={() => run(() => api.rubricFromExemplars(id))}
            onStartPreview={startPreview} />
        )}

        {/* ═══ STEP 3: PREVIEW ══════════════════════════════════ */}
        {view === "preview" && session.preview_field_results && (
          <div className="space-y-8">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <PageHeader icon={<RefreshCw size={16} />} title="Preview & Refine"
                sub="A sample of candidates has been scored. Review results, give feedback, and refine criteria in plain English." />
              <span className="nh-inset px-4 py-1.5 text-xs font-mono text-blue-300 shrink-0 self-center">
                Iteration {session.preview_iteration_count}
              </span>
            </div>

            {/* What changed */}
            {config && (config as any).synthesis_notes && (
              <div className="nh-card p-5 space-y-2" style={{ background: "rgba(6,30,80,0.55)", borderColor: "rgba(96,165,250,0.25)" }}>
                <p className="text-blue-400/70 text-[10px] font-semibold uppercase tracking-widest">What changed this iteration</p>
                <p className="text-[#a8c8f0] text-sm leading-relaxed">{(config as any).synthesis_notes}</p>
              </div>
            )}

            {/* Lessons learned */}
            {config && Array.isArray((config as any).lessons_learned) && (config as any).lessons_learned.length > 0 && (
              <LessonsLearnedPanel lessons={(config as any).lessons_learned as LessonLearned[]} />
            )}

            {/* Active rubric */}
            <ActiveRubricPanel config={config} onEdit={patchReclassify} />

            {/* Instruction history */}
            {session.extra_params_history.length > 0 && (
              <div className="space-y-3">
                <p className="text-[#3a5080] text-xs font-semibold uppercase tracking-widest">Refinement History</p>
                <div className="space-y-2">
                  {session.extra_params_history.map((p: any, i: number) => {
                    const text = p.instructions || [p.include && `+${p.include}`, p.exclude && `−${p.exclude}`].filter(Boolean).join(" · ");
                    if (!text) return null;
                    return (
                      <div key={i} className="nh-inset px-4 py-3 flex items-start gap-3">
                        <span className="text-blue-500/40 font-mono text-[10px] font-bold mt-0.5 shrink-0">#{i + 1}</span>
                        <span className="text-[#8899b8] text-xs leading-relaxed">{text}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Exemplar panel */}
            {resumes.length > 0 && (
              <ExemplarPanel resumes={resumes} id={id} open={exemplarOpen}
                onToggle={() => setExemplarOpen(v => !v)} onToggleExemplar={toggleExemplar}
                onRubricFromExemplars={() => run(() => api.rubricFromExemplars(id))} busy={busy} />
            )}

            {/* Results */}
            <FieldMatchTable results={session.preview_field_results} sessionId={id}
              resumes={resumes} onFeedback={immediateFeedback} />

            <Separator className="opacity-10" />

            {/* Refine input */}
            <div className="nh-card p-6 space-y-4">
              <div className="flex items-center gap-3 flex-wrap">
                <p className="text-[#c8d8f0] text-sm font-semibold">Refine the Criteria</p>
                <span className="nh-inset px-3 py-1 text-[10px] text-blue-400">AI confirms before applying</span>
              </div>
              <Textarea
                placeholder={`e.g. "Require IIT/IIM, drop consulting requirement, raise weight for 0-to-1 builders to 40%, make B2B SaaS a hard filter"`}
                value={instrText}
                onChange={e => { setInstrText(e.target.value); setInterpretRes(null); }}
                rows={3}
                className="w-full text-sm resize-none"
              />

              {/* AI interpret confirmation */}
              {interpretRes && (
                <div className="nh-card p-5 space-y-4" style={{ background: "rgba(6,30,80,0.55)", borderColor: "rgba(96,165,250,0.3)" }}>
                  <p className="text-blue-400/70 text-[10px] font-semibold uppercase tracking-widest">AI Interpretation — confirm?</p>
                  <p className="text-[#a8c8f0] text-sm leading-relaxed">{interpretRes.interpretation}</p>
                  {interpretRes.will_do.length > 0 && (
                    <ul className="space-y-1.5">
                      {interpretRes.will_do.map((a, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-[#8899b8]">
                          <span className="text-blue-500 mt-0.5 shrink-0">→</span><span>{a}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="text-[#93c5fd] text-sm font-medium">{interpretRes.confirmation_prompt}</p>
                  <div className="flex gap-3">
                    <button onClick={doRefine} disabled={busy} className="nh-btn-primary flex items-center gap-2 px-5 py-2 text-sm">
                      {busy ? <Spinner sm /> : "Yes, apply"}
                    </button>
                    <button onClick={() => setInterpretRes(null)} className="nh-btn-ghost px-5 py-2 text-sm">Cancel</button>
                  </div>
                </div>
              )}

              <div className="flex gap-3 flex-wrap pt-2">
                <button onClick={requestRefine} disabled={busy || interpretPend} className="nh-btn-primary flex items-center gap-2 px-6 py-2.5 text-sm">
                  {interpretPend ? <><Spinner sm /> Interpreting…</>
                    : busy ? <><Spinner sm /> Re-evaluating…</>
                    : "Re-evaluate"}
                </button>
                <button onClick={reloadPreview} disabled={busy} className="nh-btn-ghost flex items-center gap-2 px-5 py-2.5 text-sm">
                  + 2 More Resumes
                </button>
                <button onClick={acceptAll} disabled={busy} className="nh-btn-success flex items-center gap-2 px-6 py-2.5 text-sm">
                  {busy ? <Spinner sm /> : <Check size={14} />} Accept & Full Eval
                </button>
              </div>
              {busy && <BounceMsg msgs={PROC_MSGS} />}
            </div>
          </div>
        )}

        {/* ═══ STEP 3.5: RUNNING ════════════════════════════════ */}
        {view !== "results" && step === "running" && (
          <FullEvalProgress session={session} />
        )}

        {/* ═══ STEP 4: RESULTS ══════════════════════════════════ */}
        {view === "results" && step === "results" && session.full_results && (
          <div className="space-y-8">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <PageHeader icon={<Trophy size={16} />} title="Full Evaluation Results" sub="Every candidate scored against your final rubric — ranked by fit, not subjectivity." />
              <button onClick={() => router.push("/")} className="nh-btn-ghost flex items-center gap-2 px-5 py-2 text-sm self-center">
                <ArrowLeft size={14} /> All Sessions
              </button>
            </div>
            <RubricAuditPanel config={session.final_config ?? session.synthesized_config} />
            <FieldMatchTable results={session.full_results} sessionId={id} resumes={resumes} />
            {session.full_results._skipped && <SkippedPanel skipped={session.full_results._skipped} />}
            <TokenPanel totals={session.token_totals || {}} />
          </div>
        )}
      </div>
    </div>
  );
}

/* ── PageHeader ────────────────────────────────────────────────────── */
function PageHeader({ icon, title, sub }: { icon: React.ReactNode; title: string; sub: string }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <span
          className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-blue-400"
          style={{ background: "rgba(79,110,247,0.1)", border: "1px solid rgba(79,110,247,0.2)" }}
        >
          {icon}
        </span>
        <h2 className="text-xl font-black text-white tracking-tight">{title}</h2>
      </div>
      <p className="text-[#566b99] text-sm leading-relaxed max-w-lg">{sub}</p>
    </div>
  );
}

/* ── StepNav ───────────────────────────────────────────────────────── */
function StepNav({ current, view, onNavigate }: { current: Step; view: Step; onNavigate: (s: Step) => void }) {
  const displaySteps: Step[] = ["jd", "resumes", "preview", "results"];
  const labels: Record<Step, string> = { jd: "JD", resumes: "Resumes", preview: "Preview", running: "Running", results: "Results" };
  const currentIdx = STEP_ORDER.indexOf(current === "running" ? "preview" : current);

  return (
    <div className="px-8 py-2.5 border-t" style={{ borderColor: "rgba(96,165,250,0.07)" }}>
      <div className="flex items-center max-w-lg">
        {displaySteps.map((key, i) => {
          const stepIdx     = STEP_ORDER.indexOf(key);
          const isDone      = stepIdx < currentIdx;
          const isActive    = key === view || (key === "preview" && view === "running");
          const isReachable = stepIdx <= currentIdx;
          const isLast      = i === displaySteps.length - 1;

          return (
            <div key={key} className="flex items-center flex-1 last:flex-none">
              <button
                onClick={() => isReachable && onNavigate(key)}
                disabled={!isReachable}
                title={isReachable ? `Go to ${labels[key]}` : undefined}
                className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
                  isActive    ? "text-blue-300"
                  : isDone    ? "text-[#4a6080] hover:text-[#8899b8] cursor-pointer"
                  :              "text-[#2a3a5a] cursor-not-allowed"
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 transition-all ${
                    isActive ? "text-white" : isDone ? "text-[#6c80a8]" : "text-[#2a3a5a]"
                  }`}
                  style={{
                    background: isActive
                      ? "linear-gradient(135deg,#2563eb,#0ea5e9)"
                      : isDone ? "rgba(96,165,250,0.12)" : "transparent",
                    border: `1px solid ${isActive ? "transparent" : isDone ? "rgba(96,165,250,0.25)" : "rgba(96,165,250,0.08)"}`,
                    boxShadow: isActive ? "0 0 10px rgba(37,99,235,0.4)" : "none",
                  }}
                >
                  {isDone ? <Check size={9} className="mx-auto" /> : i + 1}
                </span>
                <span className="hidden sm:block">{labels[key]}</span>
              </button>
              {!isLast && (
                <div
                  className="flex-1 h-px mx-0.5"
                  style={{
                    background: isDone
                      ? "linear-gradient(90deg, rgba(96,165,250,0.3), rgba(96,165,250,0.15))"
                      : "rgba(96,165,250,0.06)",
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── CriteriaSummary ───────────────────────────────────────────────── */
function CriteriaSummary({ jd }: { jd: JdAnalysis }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {jd.role_type && <Tag text={jd.role_type} color="slate" />}
        {jd.role_context?.seniority_level && <Tag text={jd.role_context.seniority_level} color="blue" label="Seniority" />}
        {jd.role_context?.archetype && <Tag text={jd.role_context.archetype} color="purple" label="Archetype" />}
        {jd.role_context?.org_stage && <Tag text={jd.role_context.org_stage} color="green" label="Stage" />}
        {jd.jd_quality_score && (
          <Tag text={`JD Quality: ${jd.jd_quality_score}/10`}
            color={jd.jd_quality_score >= 7 ? "green" : jd.jd_quality_score >= 4 ? "amber" : "red"} />
        )}
      </div>

      {jd.one_liner && (
        <div className="pl-4 py-2" style={{ borderLeft: "2px solid rgba(59,130,246,0.4)" }}>
          <p className="text-[#8899b8] text-sm italic">"{jd.one_liner}"</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <SignalList title="Baseline Signals" color="#6c80a8" items={jd.baseline_signals ?? []} bullet="•" />
        <SignalList title="P0 Signals (Priority)" color="#f59e0b" items={jd.p0_signals ?? []} bullet="✦" bulletColor="#f59e0b" />
      </div>

      {(jd.red_flags?.length ?? 0) > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-red-400/70">Red Flags</p>
          <div className="flex flex-wrap gap-2">
            {(jd.red_flags ?? []).map((f, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
                style={{ background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.2)" }}>
                <span className="text-xs text-[#e2e8f0]">{f.flag}</span>
                {f.risk_type && <span className="text-[9px] font-mono text-red-400/60 uppercase">{f.risk_type.replace(/_/g, " ")}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {(jd.vague_requirements?.length ?? 0) > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#3a5080]">Unverifiable Phrasing</p>
          <div className="flex flex-wrap gap-1.5">
            {(jd.vague_requirements ?? []).map((r, i) => (
              <span key={i} className="nh-inset text-[#4a6080] text-[10px] px-2 py-0.5 rounded" title="Too vague for objective scoring">{r}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Tag({ text, color, label }: { text: string; color: string; label?: string }) {
  const styles: Record<string, string> = {
    blue:   "background:rgba(37,99,235,0.12);border:1px solid rgba(96,165,250,0.25);color:#93c5fd",
    cyan:   "background:rgba(6,182,212,0.1);border:1px solid rgba(34,211,238,0.25);color:#67e8f9",
    purple: "background:rgba(139,92,246,0.1);border:1px solid rgba(167,139,250,0.25);color:#c4b5fd",
    green:  "background:rgba(5,150,105,0.1);border:1px solid rgba(52,211,153,0.25);color:#6ee7b7",
    amber:  "background:rgba(245,158,11,0.1);border:1px solid rgba(251,191,36,0.25);color:#fcd34d",
    red:    "background:rgba(239,68,68,0.1);border:1px solid rgba(248,113,113,0.25);color:#fca5a5",
    slate:  "background:rgba(96,165,250,0.06);border:1px solid rgba(96,165,250,0.14);color:#6c80a8",
  };
  return (
    <span className="text-[10px] px-2.5 py-1 rounded-full font-semibold uppercase tracking-wide" style={{ cssText: styles[color] } as any}>
      {label ? `${label}: ` : ""}{text}
    </span>
  );
}

function SignalList({ title, color, items, bullet, bulletColor }: { title: string; color: string; items: string[]; bullet: string; bulletColor?: string }) {
  return (
    <div className="space-y-3">
      <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color }}>{title}</p>
      <div className="space-y-2">
        {items.length ? items.map((s, i) => (
          <div key={i} className="flex gap-2.5 text-sm text-[#c8d8f0] leading-relaxed">
            <span className="mt-0.5 shrink-0" style={{ color: bulletColor ?? "#4a6080" }}>{bullet}</span>
            <span>{s}</span>
          </div>
        )) : <p className="text-xs text-[#2a3a5a] italic">None extracted</p>}
      </div>
    </div>
  );
}

/* ── ParseConfirmation ─────────────────────────────────────────────── */
function ParseConfirmation({ session, resumes, id, busy, onToggleExemplar, onRubricFromExemplars, onStartPreview }: {
  session: Session; resumes: ResumeListItem[]; id: string; busy: boolean;
  onToggleExemplar: (n: string, c: boolean) => void;
  onRubricFromExemplars: () => void;
  onStartPreview: () => void;
}) {
  const ok  = resumes.filter(r => isReadable(r));
  const bad = resumes.filter(r => !isReadable(r));
  const starred = resumes.filter(r => r.is_exemplar).length;

  return (
    <div className="nh-card p-8 space-y-7">
      {/* Parse summary */}
      <div className="flex items-center gap-5 flex-wrap">
        <span className="flex items-center gap-2 text-emerald-400 text-sm font-medium">
          <span className="nh-dot-green" />
          {ok.length} resume{ok.length !== 1 ? "s" : ""} parsed
        </span>
        {bad.length > 0 && (
          <span className="flex items-center gap-2 text-amber-400 text-sm">
            <span className="nh-dot-amber" />
            {bad.length} unreadable
          </span>
        )}
      </div>

      {bad.length > 0 && (
        <div className="nh-inset p-4 space-y-3" style={{ borderColor: "rgba(245,158,11,0.25)" }}>
          <p className="text-amber-400 text-xs font-semibold uppercase tracking-wider">Unreadable PDFs — excluded</p>
          <p className="text-[#4a6080] text-xs leading-relaxed">Likely scanned image PDFs. Re-upload as text-based PDFs to include them.</p>
          {bad.map((r, i) => {
            const reasons = (r.quality as any)?.reasons ?? [];
            return (
              <div key={i} className="flex gap-2 text-xs">
                <span className="text-amber-500 shrink-0">•</span>
                <span className="text-[#8899b8] font-mono">{r.file_name}</span>
                {reasons[0] && <span className="text-[#3a5080]">— {reasons[0]}</span>}
              </div>
            );
          })}
        </div>
      )}

      {session.status === "rubric_ready" && (
        <div className="nh-inset p-4 space-y-1" style={{ borderColor: "rgba(245,158,11,0.25)" }}>
          <p className="text-amber-300 text-sm font-semibold">Rubric generated from ideal resumes</p>
          <p className="text-[#4a6080] text-xs">Reverse-engineered from your starred examples. Click "Start Preview Loop" to evaluate candidates.</p>
        </div>
      )}

      {/* Exemplar list */}
      {resumes.length > 0 && (
        <div className="space-y-3">
          <p className="text-[#3a5080] text-xs font-semibold uppercase tracking-widest">
            Mark ideal resumes to generate a rubric from examples
          </p>
          <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
            {resumes.map(r => (
              <div key={r.file_name} className="nh-inset flex items-center justify-between gap-3 px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                    isReadable(r) ? "text-emerald-400" : "text-[#3a5080]"
                  }`}
                    style={{ background: isReadable(r) ? "rgba(5,150,105,0.1)" : "rgba(30,50,100,0.3)" }}>
                    {isReadable(r) ? "ok" : "skip"}
                  </span>
                  <span className="text-[#8899b8] text-xs font-mono truncate">{r.file_name}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <a href={`${BASE}/api/sessions/${id}/resumes/${encodeURIComponent(r.file_name)}/pdf`}
                    target="_blank" rel="noopener noreferrer"
                    className="text-[#3a5080] hover:text-blue-400 transition-colors" title="View PDF">
                    <ExternalLink size={11} /></a>
                  <button onClick={() => onToggleExemplar(r.file_name, r.is_exemplar)}
                    className={`text-lg transition-colors ${r.is_exemplar ? "text-amber-400" : "text-[#2a3a5a] hover:text-[#4a6080]"}`}>
                    <Star size={14} fill={r.is_exemplar ? "currentColor" : "none"} className={r.is_exemplar ? "text-amber-400" : "text-[#2a3a5a] hover:text-[#4a6080]"} />
                  </button>
                </div>
              </div>
            ))}
          </div>
          {starred >= 2
            ? <button onClick={onRubricFromExemplars} disabled={busy} className="nh-btn-ghost flex items-center gap-2 px-4 py-2 text-xs"
                style={{ color: "#fcd34d", borderColor: "rgba(245,158,11,0.3)" }}>
                {busy ? <Spinner sm /> : <Star size={11} />} Generate Rubric from {starred} Ideal Resumes
              </button>
            : <p className="text-[#2a3a5a] text-xs">Star 2+ resumes to unlock rubric generation from examples</p>
          }
        </div>
      )}

      <div className="pt-2 border-t" style={{ borderColor: "rgba(96,165,250,0.1)" }}>
        <button onClick={onStartPreview} disabled={busy} className="nh-btn-primary flex items-center gap-2 px-8 py-3 text-sm">
          {busy ? <><Spinner sm /> Running preview…</> : <><Play size={14} /> Start Preview Loop</>}
        </button>
        {busy && <div className="mt-4"><BounceMsg msgs={PROC_MSGS} /></div>}
      </div>
    </div>
  );
}

function isReadable(r: ResumeListItem) {
  const q = r.quality as any;
  if (!q) return true;
  if ("text_extractable" in q) return !!q.text_extractable;
  return !!q.readable;
}

/* ── ExemplarPanel ─────────────────────────────────────────────────── */
function ExemplarPanel({ resumes, id, open, onToggle, onToggleExemplar, onRubricFromExemplars, busy }: {
  resumes: ResumeListItem[]; id: string; open: boolean; busy: boolean;
  onToggle: () => void;
  onToggleExemplar: (n: string, c: boolean) => void;
  onRubricFromExemplars: () => void;
}) {
  const starred = resumes.filter(r => r.is_exemplar).length;
  return (
    <div className="nh-card overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center justify-between px-6 py-4 text-sm font-medium transition-all hover:bg-white/[.015]">
        <span className="flex items-center gap-2 text-[#8899b8]">
          <Star size={12} className="text-amber-400" /> Mark Ideal Resumes
          {starred > 0 && <span className="text-amber-400">({starred} starred)</span>}
        </span>
        {open ? <ChevronUp size={14} className="text-[#3a5080]" /> : <ChevronDown size={14} className="text-[#3a5080]" />}
      </button>
      {open && (
        <div className="px-6 pb-6 border-t space-y-3 pt-4" style={{ borderColor: "rgba(96,165,250,0.08)" }}>
          <div className="space-y-2 max-h-44 overflow-y-auto">
            {resumes.map(r => (
              <div key={r.file_name} className="nh-inset flex items-center justify-between gap-3 px-4 py-2.5">
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${isReadable(r) ? "text-emerald-400" : "text-[#3a5080]"}`}
                    style={{ background: isReadable(r) ? "rgba(5,150,105,0.1)" : "rgba(30,50,100,0.3)" }}>
                    {isReadable(r) ? "ok" : "skip"}
                  </span>
                  <span className="text-[#8899b8] text-xs font-mono truncate">{r.file_name}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <a href={`${BASE}/api/sessions/${id}/resumes/${encodeURIComponent(r.file_name)}/pdf`} target="_blank" rel="noopener noreferrer"
                    className="text-[#3a5080] hover:text-blue-400 text-xs transition-colors"><ExternalLink size={11} /></a>
                  <button onClick={() => onToggleExemplar(r.file_name, r.is_exemplar)}
                    className={`text-lg transition-colors ${r.is_exemplar ? "text-amber-400" : "text-[#2a3a5a] hover:text-[#4a6080]"}`}>
                    <Star size={14} fill={r.is_exemplar ? "currentColor" : "none"} className={r.is_exemplar ? "text-amber-400" : "text-[#2a3a5a] hover:text-[#4a6080]"} />
                  </button>
                </div>
              </div>
            ))}
          </div>
          {starred >= 2
            ? <button onClick={onRubricFromExemplars} disabled={busy} className="nh-btn-ghost text-xs px-4 py-2"
                style={{ color: "#fcd34d", borderColor: "rgba(245,158,11,0.3)" }}>
                {busy ? "Generating…" : `Regenerate Rubric from ${starred} Ideal Resumes`}
              </button>
            : <p className="text-[#2a3a5a] text-xs">Star 2+ resumes to regenerate the rubric</p>
          }
        </div>
      )}
    </div>
  );
}

/* ── LessonsLearnedPanel ───────────────────────────────────────────── */
function LessonsLearnedPanel({ lessons }: { lessons: LessonLearned[] }) {
  const [open, setOpen] = useState(false);
  if (!lessons?.length) return null;

  const actionCls = (a?: string) =>
    a === "should_pass" || a === "p0_booster" ? "text-emerald-400 border-emerald-500/25 bg-emerald-500/[.05]"
    : a === "should_fail" ? "text-red-400 border-red-500/25 bg-red-500/[.05]"
    : "text-[#6c80a8] border-white/10";

  const actionLabel = (a?: string) =>
    a === "should_pass" ? "Should PASS" : a === "should_fail" ? "Should FAIL" : a === "p0_booster" ? "P0 Boost" : a ?? "Feedback";

  return (
    <div className="nh-card overflow-hidden" style={{ borderColor: "rgba(245,158,11,0.2)" }}>
      <button onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-6 py-4 text-left transition-all"
        style={{ background: "rgba(120,80,0,0.08)" }}>
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-amber-300">Rubric Shift Log</span>
          <span className="nh-inset px-2.5 py-1 text-[10px] font-mono text-amber-400"
            style={{ borderColor: "rgba(245,158,11,0.2)" }}>
            {lessons.length} lesson{lessons.length > 1 ? "s" : ""}
          </span>
        </div>
        {open ? <ChevronUp size={13} className="text-amber-600" /> : <ChevronDown size={13} className="text-amber-600" />}
      </button>
      {open && (
        <div className="px-6 py-6 border-t space-y-5" style={{ borderColor: "rgba(245,158,11,0.1)" }}>
          <p className="text-[#4a6080] text-xs">Each lesson was derived from your disagree feedback and updated the rubric.</p>
          {lessons.map((l, i) => (
            <div key={i} className="nh-inset overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2.5 border-b" style={{ borderColor: "rgba(96,165,250,0.06)" }}>
                <span className="text-[10px] font-mono text-[#3a5080]">#{i + 1}</span>
                {l.candidate && <span className="text-[10px] text-[#6c80a8] truncate">{l.candidate}</span>}
                {l.action && (
                  <span className={`text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${actionCls(l.action)}`}>
                    {actionLabel(l.action)}
                  </span>
                )}
              </div>
              <div className="px-4 py-4 space-y-3">
                {l.reason_given && <Field label="You said" text={`"${l.reason_given}"`} color="#6c80a8" italic />}
                {l.lesson && <Field label="Derived rule" text={l.lesson} color="#fbbf24" />}
                {l.rubric_change && <Field label="Rubric change" text={l.rubric_change} color="#93c5fd" mono />}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Field({ label, text, color, italic, mono }: { label: string; text: string; color: string; italic?: boolean; mono?: boolean }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[9px] font-semibold uppercase tracking-wider text-[#3a5080]">{label}</p>
      <p className={`text-xs leading-relaxed ${italic ? "italic" : ""} ${mono ? "font-mono text-[11px]" : ""}`}
        style={{ color }}>
        {text}
      </p>
    </div>
  );
}

/* ── ActiveRubricPanel ─────────────────────────────────────────────── */
function ActiveRubricPanel({ config, onEdit }: {
  config: Record<string, unknown> | null;
  onEdit?: (p: { baseline_checks?: BaselineCheck[]; p0_weights?: P0Weight[] }) => Promise<void>;
}) {
  const [open,         setOpen]         = useState(false);
  const [localChecks,  setLocalChecks]  = useState<BaselineCheck[]>([]);
  const [localWeights, setLocalWeights] = useState<P0Weight[]>([]);
  const [saveStatus,   setSaveStatus]   = useState<"idle"|"saving"|"saved">("idle");
  const debRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editRef = useRef(false);

  useEffect(() => {
    if (editRef.current || !config) return;
    const r = (config.scoring_rubric as any) ?? {};
    setLocalChecks(r.baseline_checks ?? []);
    setLocalWeights(r.p0_weights ?? []);
  }, [config]);

  if (!config) return null;
  const rubric = (config.scoring_rubric as any) ?? {};
  const redFlags = rubric.red_flag_checks ?? [];
  const screening = config.screening_summary as string | undefined;
  const prompt = config.final_evaluation_prompt as string | undefined;
  const hard = localChecks.filter(c => c.reject_if_missing !== false);
  const soft = localChecks.filter(c => c.reject_if_missing === false);
  const totalW = localWeights.reduce((s, w) => s + (w.weight ?? 0), 0);
  if (!localChecks.length && !localWeights.length && !redFlags.length) return null;

  function scheduleSave(c: BaselineCheck[], w: P0Weight[]) {
    if (!onEdit) return;
    editRef.current = true; setSaveStatus("idle");
    if (debRef.current) clearTimeout(debRef.current);
    debRef.current = setTimeout(async () => {
      setSaveStatus("saving");
      try { await onEdit({ baseline_checks: c, p0_weights: w }); setSaveStatus("saved"); setTimeout(() => setSaveStatus("idle"), 2000); }
      catch { setSaveStatus("idle"); } finally { editRef.current = false; }
    }, 600);
  }

  function toggleHS(check: string) {
    const u = localChecks.map(c => c.check === check ? { ...c, reject_if_missing: !c.reject_if_missing } : c);
    setLocalChecks(u); scheduleSave(u, localWeights);
  }
  function updateW(idx: number, v: number) {
    const u = localWeights.map((w, i) => i === idx ? { ...w, weight: v } : w);
    setLocalWeights(u); scheduleSave(localChecks, u);
  }

  return (
    <div className="nh-card overflow-hidden">
      <button onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-white/[.015] transition-all">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm font-semibold text-[#c8d8f0]">Active Evaluation Criteria</span>
          <span className="nh-inset px-2.5 py-1 text-[10px] font-mono text-[#6c80a8]">
            {hard.length} hard · {soft.length > 0 ? `${soft.length} relaxed · ` : ""}{localWeights.length} P0 · {redFlags.length} flags
          </span>
          {onEdit && saveStatus === "saving" && <span className="text-[10px] text-amber-400 animate-pulse">Saving…</span>}
          {onEdit && saveStatus === "saved" && <span className="text-[10px] text-emerald-400 flex items-center gap-1"><Check size={9} /> Saved</span>}
        </div>
        {open ? <ChevronUp size={14} className="text-[#3a5080]" /> : <ChevronDown size={14} className="text-[#3a5080]" />}
      </button>

      {open && (
        <div className="px-6 py-6 border-t space-y-6" style={{ borderColor: "rgba(96,165,250,0.08)" }}>
          {screening && <p className="text-xs text-[#6c80a8] italic border-l-2 pl-4 leading-relaxed" style={{ borderColor: "rgba(59,130,246,0.3)" }}>{screening}</p>}
          {onEdit && <p className="text-[10px] text-[#3a5080] italic">Toggle hard/soft on baseline checks, or drag P0 sliders — changes apply instantly without re-scoring.</p>}

          {prompt && (
            <details className="group">
              <summary className="text-[10px] font-semibold uppercase tracking-wider text-[#3a5080] cursor-pointer hover:text-[#6c80a8] select-none">
                Full Evaluation Prompt <span className="font-normal normal-case">(click to verify)</span>
              </summary>
              <div className="mt-2 nh-inset p-4 max-h-48 overflow-y-auto">
                <p className="text-xs text-[#6c80a8] leading-relaxed whitespace-pre-wrap">{prompt}</p>
              </div>
            </details>
          )}

          {/* Hard filters */}
          {hard.length > 0 && (
            <div className="space-y-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[#3a5080]">
                Hard Filters <span className="text-red-400 font-normal">(fail = auto reject)</span>
              </p>
              <div className="space-y-2">
                {hard.map(c => (
                  <div key={c.check} className="nh-inset flex items-start gap-3 px-4 py-3"
                    style={{ borderColor: "rgba(239,68,68,0.15)" }}>
                    <XCircle size={13} className="text-red-400 shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <p className="text-[#c8d8f0] text-xs leading-relaxed">{c.check}</p>
                      <p className="text-[#3a5080] text-[10px]">Field: <span className="font-mono">{c.resume_field}</span></p>
                    </div>
                    {onEdit && (
                      <button onClick={() => toggleHS(c.check)}
                        className="nh-btn-ghost text-[10px] px-2 py-1 shrink-0 hover:text-emerald-400">→ Soft</button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Soft checks */}
          {soft.length > 0 && (
            <div className="space-y-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[#3a5080]">
                Relaxed Criteria <span className="text-emerald-400 font-normal">(preference, not gate)</span>
              </p>
              <div className="space-y-2">
                {soft.map(c => (
                  <div key={c.check} className="nh-inset flex items-start gap-3 px-4 py-3"
                    style={{ borderColor: "rgba(5,150,105,0.2)" }}>
                    <CheckCircle2 size={13} className="text-emerald-400 shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <p className="text-[#c8d8f0] text-xs leading-relaxed">{c.check}</p>
                      <p className="text-[#3a5080] text-[10px]">Field: <span className="font-mono">{c.resume_field}</span></p>
                    </div>
                    {onEdit && (
                      <button onClick={() => toggleHS(c.check)}
                        className="nh-btn-ghost text-[10px] px-2 py-1 shrink-0 hover:text-red-400">→ Hard</button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* P0 sliders */}
          {localWeights.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[#3a5080]">
                  P0 Signal Weights <span className="font-normal">(drag to adjust)</span>
                </p>
                <span className={`text-[10px] font-mono ${Math.abs(totalW - 100) <= 5 ? "text-[#3a5080]" : "text-amber-400"}`}>Σ = {totalW}</span>
              </div>
              <div className="space-y-4">
                {localWeights.map((w, i) => (
                  <div key={i} className="space-y-1.5">
                    <div className="flex items-center gap-2 text-xs">
                      <p className="flex-1 text-[#c8d8f0] min-w-0 truncate">{w.signal}</p>
                      <span className="shrink-0 font-mono font-bold text-emerald-400 w-8 text-right">{w.weight}</span>
                    </div>
                    {onEdit
                      ? <input type="range" min={0} max={100} step={1} value={w.weight} onChange={e => updateW(i, +e.target.value)} className="w-full" />
                      : <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(96,165,250,0.1)" }}>
                          <div className="h-full rounded-full" style={{ width: `${w.weight}%`, background: "linear-gradient(90deg,#2563eb,#0ea5e9)" }} />
                        </div>
                    }
                    <p className="text-[10px] text-[#2a3a5a] font-mono">{w.resume_field}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Red flag checks */}
          {redFlags.length > 0 && (
            <div className="space-y-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[#3a5080]">
                Red Flag Checks <span className="font-normal">(deprioritise if present)</span>
              </p>
              <div className="space-y-2">
                {redFlags.map((f: any, i: number) => (
                  <div key={i} className="nh-inset flex items-start gap-3 px-4 py-3"
                    style={{ borderColor: "rgba(245,158,11,0.15)" }}>
                    <AlertTriangle size={13} className="text-amber-400 shrink-0 mt-0.5" />
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-[#c8d8f0] text-xs leading-relaxed">{f.check}</p>
                      <p className="text-[#3a5080] text-[10px]">Field: <span className="font-mono">{f.resume_field}</span></p>
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

/* ── FullEvalProgress ──────────────────────────────────────────────── */
function FullEvalProgress({ session }: { session: Session }) {
  const p       = session.full_eval_progress ?? { status: "queued" as const };
  const scored  = p.scored ?? 0;
  const total   = p.total  ?? 0;
  const pct     = total > 0 ? Math.round((scored / total) * 100) : 0;
  const isErr   = p.status === "error";

  const [tipI, setTipI] = useState(0);
  useEffect(() => { const t = setInterval(() => setTipI(n => (n + 1) % EVAL_TIPS.length), 4000); return () => clearInterval(t); }, []);

  return (
    <div className="nh-card p-8 space-y-7">
      {isErr ? (
        <>
          <PageHeader icon={<AlertTriangle size={16} />} title="Evaluation Failed" sub="The background worker encountered an error. Re-click Accept to retry from the last checkpoint." />
          <p className="text-red-400 text-sm">{p.error || "Re-click Accept to resume from the last checkpoint."}</p>
        </>
      ) : (
        <>
          <PageHeader
            icon={<Zap size={16} />}
            title={p.status === "queued" ? "Preparing Full Evaluation" : "Scoring All Candidates"}
            sub="Each candidate is evaluated against your final rubric in parallel. Results are saved progressively."
          />

          {/* Progress */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-[#6c80a8]">{scored} of {total} candidates</span>
              <span className="font-mono font-black text-blue-400">{pct}%</span>
            </div>
            <div className="w-full h-2.5 rounded-full overflow-hidden" style={{ background: "rgba(96,165,250,0.1)" }}>
              <div className="h-full rounded-full nh-progress-bar"
                style={{ width: `${pct || (p.status !== "queued" ? 2 : 0)}%` }} />
            </div>
          </div>

          {/* Tip */}
          <div className="nh-inset p-4 flex items-start gap-3">
            <Info size={13} className="text-blue-400 shrink-0 mt-0.5" />
            <p className="text-[#6c80a8] text-xs leading-relaxed">{EVAL_TIPS[tipI]}</p>
          </div>

          {p.status !== "queued" && <BounceMsg msgs={["Analysing candidates…", "Applying rubric criteria…", "Scoring field by field…"]} />}
        </>
      )}
    </div>
  );
}

/* ── RubricAuditPanel ──────────────────────────────────────────────── */
function RubricAuditPanel({ config }: { config: any }) {
  const [open, setOpen] = useState(false);
  if (!config) return null;
  const r     = config.scoring_rubric ?? {};
  const bc    = r.baseline_checks ?? [];
  const pw    = r.p0_weights ?? [];
  const rf    = r.red_flag_checks ?? [];
  const hard  = bc.filter((c: any) => c?.reject_if_missing !== false).length;
  const soft  = bc.length - hard;

  return (
    <div className="nh-card overflow-hidden">
      <button onClick={() => setOpen(v => !v)} className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-white/[.015] transition-all">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-[#c8d8f0]">Rubric Audit</span>
          <span className="text-[#4a6080] text-xs">{hard} hard · {soft} soft · {pw.length} P0 · {rf.length} flags</span>
        </div>
        {open ? <ChevronUp size={14} className="text-[#3a5080]" /> : <ChevronDown size={14} className="text-[#3a5080]" />}
      </button>
      {open && (
        <div className="px-6 py-6 border-t space-y-5 text-xs" style={{ borderColor: "rgba(96,165,250,0.08)" }}>
          {[{ title: "Baseline Checks", items: bc, render: (c: any) => (
            <div className="flex gap-2 mb-2" key={c?.check}>
              <span className={`px-1.5 py-0.5 rounded text-[10px] shrink-0 ${
                c?.reject_if_missing !== false ? "bg-red-500/[.08] text-red-300 border border-red-500/20" : "bg-blue-500/[.08] text-blue-300 border border-blue-500/20"
              }`}>{c?.reject_if_missing !== false ? "HARD" : "soft"}</span>
              <span className="text-[#8899b8] leading-relaxed">{c?.check}</span>
            </div>
          )}, { title: "P0 Weights", items: pw, render: (w: any) => (
            <div className="flex gap-2 mb-1.5" key={w?.signal}>
              <span className="text-[10px] text-emerald-300 border border-emerald-500/20 bg-emerald-500/[.06] px-1.5 py-0.5 rounded font-mono shrink-0">{w?.weight ?? 0}</span>
              <span className="text-[#8899b8]">{w?.signal}</span>
            </div>
          )}].map(({ title, items, render }) => (
            <div key={title}>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[#3a5080] mb-2">{title}</p>
              {items.length === 0 ? <p className="text-[#2a3a5a] italic">none</p> : items.map(render)}
            </div>
          ))}
          {rf.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[#3a5080] mb-2">Red Flags</p>
              {rf.map((f: any, i: number) => <p key={i} className="text-amber-300/80 mb-1">• {f?.check}</p>)}
            </div>
          )}
          {config.final_evaluation_prompt && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[#3a5080] mb-2">Final Evaluation Prompt</p>
              <pre className="nh-inset p-4 whitespace-pre-wrap break-words text-[11px] text-[#6c80a8] leading-relaxed max-h-80 overflow-y-auto">
                {config.final_evaluation_prompt}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── SkippedPanel ──────────────────────────────────────────────────── */
function SkippedPanel({ skipped }: { skipped: SkippedInfo }) {
  const [open, setOpen] = useState(false);
  const unreadable   = skipped.unreadable    ?? [];
  const sampledOut   = skipped.sampled_out   ?? [];
  const modelDropped = skipped.model_dropped ?? [];
  const total = unreadable.length + sampledOut.length + modelDropped.length;
  if (!total) return null;

  return (
    <div className="nh-card overflow-hidden">
      <button onClick={() => setOpen(v => !v)} className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-white/[.015] transition-all">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-[#c8d8f0]">Resumes Not Evaluated</span>
          <span className="nh-inset px-2.5 py-1 text-[10px] font-mono text-[#6c80a8]">{total} skipped</span>
        </div>
        {open ? <ChevronUp size={14} className="text-[#3a5080]" /> : <ChevronDown size={14} className="text-[#3a5080]" />}
      </button>
      {open && (
        <div className="px-6 py-6 border-t space-y-5" style={{ borderColor: "rgba(96,165,250,0.08)" }}>
          <p className="text-[#4a6080] text-xs leading-relaxed">
            Fix unreadable PDFs by re-uploading text-based PDFs. Model-dropped resumes can be retried.
          </p>
          {[
            { arr: unreadable,   icon: "—", c: "text-red-400",    bg: "rgba(239,68,68,0.05)",   bc: "rgba(239,68,68,0.18)",   t: "Unreadable PDFs" },
            { arr: modelDropped, icon: "?", c: "text-amber-400", bg: "rgba(245,158,11,0.05)", bc: "rgba(245,158,11,0.18)", t: "Dropped by Model"  },
            { arr: sampledOut, icon: "–",  c: "text-[#6c80a8]", bg: "rgba(30,60,120,0.1)",   bc: "rgba(96,165,250,0.1)", t: "Over Cap"            },
          ].filter(x => x.arr.length > 0).map(({ arr, icon, c, bg, bc, t }) => (
            <div key={t} className="space-y-2">
              <p className={`text-[10px] font-semibold uppercase tracking-wider ${c}`}>{t}</p>
              <div className="space-y-2">
                {arr.map((r, i) => (
                  <div key={i} className="nh-inset flex items-start gap-3 px-4 py-3"
                    style={{ background: bg, borderColor: bc }}>
                    <span className={`${c} shrink-0 mt-0.5`}>{icon}</span>
                    <div className="min-w-0">
                      <p className="text-[#c8d8f0] text-xs font-mono truncate">{r.file_name}</p>
                      <p className="text-[#4a6080] text-xs mt-0.5">{r.reason}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── TokenPanel ────────────────────────────────────────────────────── */
function TokenPanel({ totals }: { totals: Record<string, any> }) {
  if (!totals || !Object.keys(totals).length) return null;
  const totalTok = totals._total_tokens || 0;
  const entries  = Object.entries(totals).filter(([k]) => k !== "_total_tokens");

  return (
    <details className="group">
      <summary className="text-xs font-semibold text-[#3a5080] uppercase tracking-wider cursor-pointer hover:text-[#6c80a8] list-none flex items-center gap-2 select-none">
        <span className="group-open:rotate-90 transition-transform inline-block">▸</span> Token Usage
      </summary>
      <div className="mt-4 nh-card p-6 space-y-5">
        <div className="grid grid-cols-2 gap-4 pb-4 border-b" style={{ borderColor: "rgba(96,165,250,0.08)" }}>
          <div>
            <p className="text-[10px] text-[#3a5080] uppercase tracking-wider mb-1">Total Tokens</p>
            <p className="text-2xl text-emerald-400 font-black font-mono">{totalTok.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-[10px] text-[#3a5080] uppercase tracking-wider mb-1">API Calls</p>
            <p className="text-2xl text-[#c8d8f0] font-black font-mono">{entries.length}</p>
          </div>
        </div>
        <div className="space-y-2">
          {entries.map(([name, data]) => {
            const row = data as any;
            return (
              <div key={name} className="nh-inset flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-[#c8d8f0]">{name}</span>
                  {row.latency_seconds && (
                    <span className="nh-inset px-2 py-0.5 text-[10px] font-mono text-[#6c80a8]">{row.latency_seconds}s</span>
                  )}
                </div>
                <div className="flex items-center gap-6 text-[11px] font-mono">
                  {[["In", row.input_tokens, "#6c80a8"], ["Out", row.output_tokens, "#6c80a8"], ["Total", row.total_tokens, "#93c5fd"]].map(([l, v, c]) => (
                    <div key={String(l)} className="flex flex-col items-end">
                      <span className="text-[#2a3a5a] text-[9px] uppercase mb-0.5">{l}</span>
                      <span style={{ color: String(c) }}>{Number(v)?.toLocaleString() || 0}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </details>
  );
}
