"use client";

import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Textarea } from "@/components/ui/textarea";
import {
  api,
  BASE,
  type CandidateFeedback,
  type CandidateResult,
  type InterpretResponse,
  type JdAnalysis,
  type ResumeListItem,
  type Session,
} from "@/lib/api";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Brain,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDashed,
  ClipboardCheck,
  Eye,
  FileText,
  Flag,
  Gauge,
  Layers3,
  Loader2,
  MessageSquareText,
  PanelRightOpen,
  Play,
  RefreshCcw,
  Search,
  ShieldAlert,
  Sparkles,
  Star,
  Upload,
  X,
  XCircle,
} from "lucide-react";

type Step = "jd" | "resumes" | "calibration" | "running" | "results";

type ActionTone = "shortlist" | "reject" | "flag";

const REVIEW_ACTIONS: Array<{ key: ActionTone; label: string; icon: any; className: string }> = [
  { key: "shortlist", label: "Shortlist", icon: CheckCircle2, className: "bg-[#0f5132] text-white border-[#0f5132] hover:bg-[#0b3f27]" },
  { key: "reject", label: "Reject", icon: XCircle, className: "bg-[#b42318] text-white border-[#b42318] hover:bg-[#8f1c14]" },
  { key: "flag", label: "Needs review", icon: Flag, className: "bg-[#b54708] text-white border-[#b54708] hover:bg-[#93370d]" },
];

function stepFromStatus(session: Session): Step {
  if (session.status === "completed") return "results";
  if (session.status === "running_full_eval") return "running";
  if (session.status === "preview_active") return "calibration";
  if (["resumes_uploaded", "rubric_ready"].includes(session.status)) return "resumes";
  if (session.status === "jd_analyzed") return "resumes";
  return "jd";
}

function roleName(session: Session | null) {
  return String((session?.jd_analysis as any)?.role || "Untitled hiring role");
}

function candidateTone(result?: CandidateResult) {
  if (!result) return { label: "No candidate", color: "#475467", bg: "#f2f4f7", border: "#d0d5dd" };
  if (result.classification === "P0") return { label: "Priority", color: "#027a48", bg: "#ecfdf3", border: "#abefc6" };
  if (result.classification === "Baseline") return { label: "Review", color: "#b54708", bg: "#fffaeb", border: "#fedf89" };
  return { label: "Reject", color: "#b42318", bg: "#fef3f2", border: "#fecdca" };
}

function matchTone(match?: string) {
  if (match === "pass") return { label: "Pass", color: "#027a48", bg: "#ecfdf3", border: "#abefc6" };
  if (match === "fail") return { label: "Fail", color: "#b42318", bg: "#fef3f2", border: "#fecdca" };
  return { label: "Review", color: "#b54708", bg: "#fffaeb", border: "#fedf89" };
}

function baselineTone(pass?: boolean) {
  return pass
    ? { label: "Pass", color: "#027a48", bg: "#ecfdf3", border: "#abefc6" }
    : { label: "Fail", color: "#b42318", bg: "#fef3f2", border: "#fecdca" };
}

function compactText(value?: string, max = 150) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return "No evidence found.";
  return text.length > max ? `${text.slice(0, max).trim()}...` : text;
}

function OneLine({ text, className = "" }: { text: string; className?: string }) {
  return <span title={text} className={`block min-w-0 truncate ${className}`}>{text}</span>;
}

function criterionLabel(value?: string) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  const failSplit = text.split(" FAILS if:");
  const firstSentence = failSplit[0].split(". ")[0];
  return compactText(firstSentence, 110);
}

function evidenceCriterion(value?: string) {
  const text = String(value || "").toLowerCase();
  if (/1-1\.5 years|combined relevant experience|less than 1 year/.test(text)) return "1-1.5 yrs PM";
  if (/ideation through to customer launch|full lifecycle|product-level ownership/.test(text)) return "Lifecycle";
  if (/customer needs|business drivers|metrics analysis|market trends/.test(text)) return "Customer/metrics";
  if (/stakeholder management|cross-functional|fast-paced startup/.test(text)) return "Stakeholders";
  return criterionLabel(value).replaceAll("_", " ");
}

function evidenceResumeSignal(value?: string) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  const lower = text.toLowerCase();
  if (!text) return "No resume proof";
  if (lower.includes("qa analyst")) return "QA analyst evidence";
  if (lower.includes("business analyst")) return "BA internship";
  if (lower.includes("product analyst intern")) return "Product analyst internship";
  if (lower.includes("project manager") || lower.includes("scrum master")) return "Project delivery evidence";
  return compactText(text.split(/[.;]/)[0], 44);
}

function evidenceDecisionNote(note?: string, match?: string) {
  const text = String(note || "").replace(/\s+/g, " ").trim();
  const lower = text.toLowerCase();
  if (!text) return match === "pass" ? "Evidence supports the bar" : "Evidence is not clear enough";
  if (/less than|required|short of|required 1-1\.5/.test(lower)) return "Below experience bar";
  if (/not a product manager|not direct product management|not product manager|qa analyst/.test(lower)) return "No PM ownership";
  if (/no clear evidence|no evidence|lacks detail|too brief/.test(lower) && /lifecycle|ideation|launch|ownership/.test(lower)) return "No lifecycle proof";
  if (/business drivers|market trends|customer needs|metrics/.test(lower) && /lacks|lack|without|but/.test(lower)) return "Thin business signal";
  if (/stakeholder|cross-functional|fast-paced/.test(lower) && /lacks|lack|passive|but/.test(lower)) return "Thin stakeholder proof";
  if (/strong stakeholder|extensive experience|demonstrates strong/.test(lower)) return "Strong stakeholder proof";
  return compactText(text, 48);
}

function evidenceFieldLabel(value?: string) {
  const text = String(value || "Evidence").replaceAll("_", " ");
  if (text.toLowerCase() === "work experience") return "Work exp";
  return compactText(text, 16);
}

function pct(score?: number) {
  if (score === undefined || score === null || Number.isNaN(score)) return "--";
  return `${Math.round(score)}`;
}

function referralInsight(resume?: ResumeListItem) {
  if (!resume) return { found: false, label: "No resume loaded", detail: "Open a mapped resume first." };
  const raw = JSON.stringify(resume.resume_json || {}).toLowerCase();
  const found = raw.includes("referr") || raw.includes("referred by") || raw.includes("employee referral");
  return found
    ? { found: true, label: "Referral signal found", detail: "Resume data contains referral-related text. Verify source before treating it as confirmed." }
    : { found: false, label: "No referral signal", detail: "No referral marker was found in parsed resume data." };
}

export default function RoleWorkspace({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [session, setSession] = useState<Session | null>(null);
  const [resumes, setResumes] = useState<ResumeListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [jdText, setJdText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [instruction, setInstruction] = useState("");
  const [teachingIntent, setTeachingIntent] = useState<"auto" | "hard_filter" | "p0_signal" | "relax_filter" | "red_flag">("auto");
  const [teachingReview, setTeachingReview] = useState<InterpretResponse | null>(null);
  const [promptOpen, setPromptOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});

  const refresh = useCallback(async () => {
    const next = await api.getSession(id);
    setSession(next);
    if (next.jd_text) setJdText(next.jd_text);
    return next;
  }, [id]);

  const refreshResumes = useCallback(async () => {
    const list = await api.listResumes(id);
    setResumes(list);
    return list;
  }, [id]);

  useEffect(() => {
    Promise.all([refresh(), refreshResumes()])
      .catch(() => setError("Could not load this hiring role."))
      .finally(() => setLoading(false));
  }, [refresh, refreshResumes]);

  useEffect(() => {
    if (!session) return;
    const running = session.status === "running_full_eval" || session.full_eval_progress?.status === "running" || session.full_eval_progress?.status === "queued";
    if (!running) return;
    const interval = setInterval(() => refresh().catch(() => undefined), 3000);
    return () => clearInterval(interval);
  }, [refresh, session?.status, session?.full_eval_progress?.status]);

  const step = session ? stepFromStatus(session) : "jd";
  const results = useMemo(() => {
    return session?.full_results?.results || session?.preview_field_results?.results || [];
  }, [session?.full_results, session?.preview_field_results]);

  const selected = results[selectedIndex] || results[0];
  const selectedTone = candidateTone(selected);
  const jd = session?.jd_analysis as JdAnalysis | null | undefined;
  const rubric = (session?.final_config || session?.synthesized_config) as any;
  const summary = session?.full_results?.summary || session?.preview_field_results?.summary;
  const scoringPrompt = String((rubric as any)?.final_evaluation_prompt || "");
  const hasTeachingContext = Boolean(
    session?.preview_field_results ||
    session?.full_results ||
    (session?.jd_analysis && resumes.length > 0)
  );
  const selectedResume = resumes.find((resume) => {
    const resultFile = selected?.file_name || (selected as any)?.file_name;
    if (resultFile && resume.file_name === resultFile) return true;
    return !!selected?.candidate_name && resume.file_name.toLowerCase().includes(selected.candidate_name.toLowerCase().split(" ")[0] || "");
  });

  async function run<T>(fn: () => Promise<T>, opts?: { resumes?: boolean }) {
    setBusy(true);
    setError("");
    try {
      await fn();
      await refresh();
      if (opts?.resumes) await refreshResumes();
    } catch (e) {
      setError((e as Error).message || "Something failed.");
    } finally {
      setBusy(false);
    }
  }

  function analyzeJD() {
    if (!jdText.trim()) return setError("Paste the job description first.");
    run(() => api.analyzeJD(id, jdText));
  }

  function uploadResumes() {
    if (!files.length) return setError("Select at least one PDF resume.");
    run(() => api.uploadResumes(id, files), { resumes: true });
  }

  function startCalibration() {
    run(() => api.startPreview(id), { resumes: true });
  }

  function loadMoreCalibration() {
    run(() => api.reloadPreview(id), { resumes: true });
  }

  function finalRun() {
    run(() => api.accept(id), { resumes: true });
  }

  function teachingPayload() {
    const text = instruction.trim();
    if (!text || teachingIntent === "auto") return text;
    const prefix: Record<Exclude<typeof teachingIntent, "auto">, string> = {
      hard_filter: "Treat this as a hard baseline filter:",
      p0_signal: "Treat this as a P0 reward signal:",
      relax_filter: "Relax this hard filter:",
      red_flag: "Treat this as a red flag, not an automatic reject:",
    };
    return `${prefix[teachingIntent]} ${text}`;
  }

  function reviewTeaching() {
    const payload = teachingPayload();
    if (!payload) return setError("Write the teaching instruction first.");
    const lower = payload.toLowerCase();
    const obviousTier1 = /tier\s*1|tier[- ]?one|top[- ]tier/.test(lower) && /india|indian/.test(lower) && /universit|college|institution|school/.test(lower);
    if (teachingIntent !== "auto" || obviousTier1) {
      const intentType = teachingIntent === "auto" && obviousTier1 ? "hard_filter" : teachingIntent;
      setTeachingReview({
        intent_type: intentType === "auto" ? "ambiguous" : intentType,
        interpretation:
          intentType === "hard_filter"
            ? "I will treat this as a hard baseline gate. Candidates who do not satisfy it should be rejected or marked needs_review when evidence is unclear."
            : intentType === "p0_signal"
              ? "I will treat this as a reward signal. It should lift strong candidates after hard filters pass, but should not reject candidates by itself."
              : intentType === "relax_filter"
                ? "I will relax this requirement so candidates are not rejected only because they miss it."
                : "I will treat this as a red flag for recruiter review, not an automatic rejection.",
        will_do: [
          intentType === "hard_filter"
            ? `Add hard filter — ${instruction.trim()}`
            : intentType === "p0_signal"
              ? `Add P0 reward — ${instruction.trim()}`
              : intentType === "relax_filter"
                ? `Relax filter — ${instruction.trim()}`
                : `Add red flag — ${instruction.trim()}`,
        ],
        confirmation_prompt: "I'll apply this teaching to the scoring rubric and prompt. Does that look right?",
      });
      return;
    }
    run(() => api.interpretInstructions(id, payload).then((review) => setTeachingReview(review)));
  }

  function refine() {
    const payload = teachingPayload();
    run(() => api.refinePreview(id, payload, [], undefined, false), { resumes: true }).then(() => {
      setInstruction("");
      setTeachingReview(null);
    });
  }

  function sendCandidateFeedback(action: ActionTone) {
    if (!selected) return;
    const note = reviewNotes[selected.candidate_name] || "Recruiter quick action from review cockpit.";
    const feedback: CandidateFeedback = {
      file_name: selected.file_name || (selected as any).file_name || selected.candidate_name,
      action: action === "shortlist" ? "should_pass" : action === "reject" ? "should_fail" : "flag_for_review",
      reason: note,
    };
    run(() => api.refinePreview(id, "", [feedback]), { resumes: true });
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return;
      if (e.key.toLowerCase() === "j") setSelectedIndex((i) => Math.min(results.length - 1, i + 1));
      if (e.key.toLowerCase() === "k") setSelectedIndex((i) => Math.max(0, i - 1));
      if (e.key.toLowerCase() === "s") sendCandidateFeedback("shortlist");
      if (e.key.toLowerCase() === "r") sendCandidateFeedback("reject");
      if (e.key.toLowerCase() === "f") sendCandidateFeedback("flag");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [results.length, selected?.candidate_name, reviewNotes]);

  if (loading) {
    return <main className="grid min-h-screen place-items-center bg-[#f5f2ea] text-[#151411]"><Loader2 className="animate-spin" /></main>;
  }

  if (!session) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f5f2ea] text-[#151411]">
        <div className="rounded-2xl border border-[#ded8cc] bg-white p-6 text-center shadow-sm">
          <p className="font-bold">Role not found.</p>
          <button onClick={() => router.push("/")} className="mt-4 rounded-lg bg-[#151411] px-4 py-2 text-sm font-semibold text-white">Back to desk</button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f5f2ea] text-[#151411]">
      <header className="sticky top-0 z-40 border-b border-[#ded8cc] bg-[#f9f7f1]/95 backdrop-blur">
        <div className="flex flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center lg:justify-between lg:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button onClick={() => router.push("/")} className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#ded8cc] bg-white text-[#151411]">
              <ArrowLeft size={16} />
            </button>
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[.18em] text-[#9b6a2f]">Hiring role cockpit</p>
              <h1 className="truncate text-lg font-black tracking-tight">{roleName(session)}</h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StepPill active={step === "jd"} done={!!session.jd_analysis} label="JD" />
            <ChevronRight size={14} className="text-[#b7ad9d]" />
            <StepPill active={step === "resumes"} done={resumes.length > 0} label="Resumes" />
            <ChevronRight size={14} className="text-[#b7ad9d]" />
            <StepPill active={step === "calibration"} done={!!session.preview_field_results} label="Calibration" />
            <ChevronRight size={14} className="text-[#b7ad9d]" />
            <StepPill active={step === "results" || step === "running"} done={!!session.full_results} label="Shortlist" />
          </div>
        </div>
      </header>

      {error && (
        <div className="px-4 pt-4 lg:px-6">
          <div className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <span className="flex items-center gap-2"><AlertCircle size={15} /> {error}</span>
            <button onClick={() => setError("")}><X size={14} /></button>
          </div>
        </div>
      )}

      <div className="grid min-w-0 gap-4 p-4 lg:grid-cols-[300px_minmax(0,1fr)_340px] lg:p-6">
        <aside className="min-w-0 space-y-4">
          <DeskCard title="Role readiness" icon={Gauge}>
            <div className="space-y-3">
              <ReadinessRow label="JD analyzed" done={!!session.jd_analysis} />
              <ReadinessRow label="Resumes parsed" done={resumes.length > 0} />
              <ReadinessRow label="Calibration reviewed" done={!!session.preview_field_results} />
              <ReadinessRow label="Final shortlist" done={!!session.full_results} />
            </div>
          </DeskCard>

          <DeskCard title="Candidate queue" icon={Search}>
            {results.length === 0 ? (
              <p className="text-sm leading-6 text-[#777064]">Candidate evidence appears here after calibration starts.</p>
            ) : (
              <div className="max-h-[520px] space-y-2 overflow-y-auto pr-1">
                {results.map((candidate, index) => {
                  const tone = candidateTone(candidate);
                  return (
                    <button
                      key={`${candidate.candidate_name}-${index}`}
                      onClick={() => setSelectedIndex(index)}
                      className={`w-full rounded-xl border p-3 text-left transition ${index === selectedIndex ? "border-[#151411] bg-[#f3ecdf]" : "border-[#ebe5d9] bg-white hover:border-[#cdbfaa]"}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="line-clamp-1 text-sm font-black">{candidate.candidate_name || `Candidate ${index + 1}`}</p>
                        <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ color: tone.color, background: tone.bg }}>{tone.label}</span>
                      </div>
                      <div className="mt-2 flex items-center gap-2 text-xs text-[#777064]">
                        <span>{pct(candidate.overall_score)} overall</span>
                        <span>/</span>
                        <span>{pct(candidate.p0_score)} P0</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </DeskCard>
        </aside>

        <section className="min-w-0 space-y-4">
          {step === "jd" && (
            <DeskCard title="Draft the role brief" icon={FileText} wide>
              <p className="mb-4 text-sm leading-6 text-[#645d52]">Paste the complete JD. The system will turn it into hard filters, priority signals, red flags, and calibration questions.</p>
              <Textarea
                value={jdText}
                onChange={(e) => setJdText(e.target.value)}
                rows={15}
                placeholder="Paste the job description here..."
                className="min-h-[340px] resize-none border-[#ded8cc] bg-[#fffdf8] text-[#151411] placeholder:text-[#a49a8b]"
              />
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <ActionButton onClick={analyzeJD} disabled={busy || !jdText.trim()} icon={Brain} label={busy ? "Analyzing" : "Analyze JD"} busy={busy} />
                <p className="text-xs text-[#777064]">Output becomes the rubric starting point, not a locked decision.</p>
              </div>
            </DeskCard>
          )}

          {step === "resumes" && (
            <DeskCard title="Build the candidate batch" icon={Upload} wide>
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
                <div>
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="grid min-h-[260px] w-full place-items-center rounded-2xl border border-dashed border-[#cbbda8] bg-[#fffdf8] p-6 text-center transition hover:border-[#151411]"
                  >
                    <div>
                      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#ede7da]"><Upload size={22} /></span>
                      <p className="mt-4 text-sm font-black">{files.length ? `${files.length} PDF resumes selected` : "Select PDF resumes"}</p>
                      <p className="mt-2 text-xs leading-5 text-[#777064]">Upload a batch, parse structured evidence, then run a calibration sample before final scoring.</p>
                    </div>
                  </button>
                  <input ref={fileRef} type="file" multiple accept=".pdf" className="hidden" onChange={(e) => setFiles(Array.from(e.target.files || []))} />
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <ActionButton onClick={uploadResumes} disabled={busy || !files.length} icon={Upload} label={busy ? "Parsing" : "Parse resumes"} busy={busy} />
                    {resumes.length > 0 && <ActionButton onClick={startCalibration} disabled={busy} icon={Play} label="Start calibration" />}
                  </div>
                </div>
                <div className="rounded-2xl border border-[#ebe5d9] bg-[#fffdf8] p-4">
                  <p className="text-xs font-bold uppercase tracking-[.16em] text-[#9b6a2f]">Parsed evidence</p>
                  <div className="mt-4 space-y-2">
                    {resumes.length === 0 ? <p className="text-sm text-[#777064]">No resumes parsed yet.</p> : resumes.map((resume) => (
                      <div key={resume.id} className="flex items-center justify-between gap-2 rounded-lg border border-[#ebe5d9] bg-white px-3 py-2">
                        <span className="truncate text-xs font-semibold">{resume.file_name}</span>
                        <span className="text-[10px] font-bold uppercase tracking-[.12em] text-[#027a48]">Ready</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </DeskCard>
          )}

          {(step === "calibration" || step === "results" || step === "running") && (
            <DeskCard title={step === "results" ? "Final shortlist evidence" : "Calibration review"} icon={PanelRightOpen} wide>
              {step === "running" ? (
                <RunningPanel session={session} />
              ) : selected ? (
                <CandidateReview
                  candidate={selected}
                  tone={selectedTone}
                  note={reviewNotes[selected.candidate_name] || ""}
                  setNote={(value) => setReviewNotes((notes) => ({ ...notes, [selected.candidate_name]: value }))}
                  onAction={sendCandidateFeedback}
                  resume={selectedResume}
                  sessionId={id}
                />
              ) : (
                <div className="grid min-h-[420px] place-items-center rounded-2xl border border-[#ebe5d9] bg-[#fffdf8] p-6 text-center">
                  <div>
                    <CircleDashed className="mx-auto text-[#a49a8b]" />
                    <p className="mt-3 text-sm font-bold">No scored candidates yet</p>
                    <p className="mt-2 max-w-sm text-sm leading-6 text-[#777064]">Start calibration after parsing resumes to review candidate evidence here.</p>
                    {resumes.length > 0 && <button onClick={startCalibration} className="mt-4 rounded-lg bg-[#151411] px-4 py-2 text-sm font-bold text-white">Start calibration</button>}
                  </div>
                </div>
              )}
            </DeskCard>
          )}
        </section>

        <aside className="min-w-0 space-y-4">
          <DeskCard title="Recruiter actions" icon={ClipboardCheck}>
            <div className="grid gap-2">
              {step === "calibration" && <ActionButton onClick={loadMoreCalibration} disabled={busy} icon={RefreshCcw} label="Add 2 more resumes" secondary />}
              {step === "calibration" && <ActionButton onClick={finalRun} disabled={busy} icon={BadgeCheck} label="Run final shortlist" />}
              {step === "resumes" && resumes.length > 0 && <ActionButton onClick={startCalibration} disabled={busy} icon={Play} label="Start calibration" />}
              {step === "results" && <ActionButton onClick={() => router.push("/")} icon={ArrowRight} label="Back to hiring desk" secondary />}
              {busy && <p className="text-xs text-[#777064]">Working through the model call. Keep this page open for live feedback.</p>}
            </div>
          </DeskCard>

          <DeskCard title="Rubric cockpit" icon={Layers3}>
            {jd ? (
              <>
                <RubricPanel jd={jd} rubric={rubric} />
                <button
                  onClick={() => setPromptOpen((value) => !value)}
                  disabled={!scoringPrompt}
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[#ded8cc] bg-[#fffdf8] px-3 py-2 text-xs font-black text-[#151411] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Eye size={14} />
                  {promptOpen ? "Hide scoring prompt" : "Show scoring prompt"}
                </button>
                {promptOpen && (
                  <pre className="mt-3 max-h-[320px] overflow-auto whitespace-pre-wrap rounded-xl border border-[#ded8cc] bg-[#151411] p-3 text-xs leading-5 text-[#f8f5ee]">
                    {scoringPrompt || "No scoring prompt generated yet."}
                  </pre>
                )}
              </>
            ) : <p className="text-sm leading-6 text-[#777064]">Analyze the JD to see hard filters, P0 signals, red flags, and calibration questions.</p>}
          </DeskCard>

          <DeskCard title="Teach the model" icon={MessageSquareText}>
            <p className="text-sm leading-6 text-[#645d52]">Use plain language to adjust what the model should reward, relax, or reject.</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {[
                ["auto", "Auto"],
                ["hard_filter", "Hard filter"],
                ["p0_signal", "P0 reward"],
                ["relax_filter", "Relax"],
                ["red_flag", "Red flag"],
              ].map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => {
                    setTeachingIntent(key as typeof teachingIntent);
                    setTeachingReview(null);
                  }}
                  className={`rounded-lg border px-3 py-2 text-xs font-black ${teachingIntent === key ? "border-[#151411] bg-[#151411] text-white" : "border-[#ded8cc] bg-[#fffdf8] text-[#4d473d]"}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <Textarea
              value={instruction}
              onChange={(e) => {
                setInstruction(e.target.value);
                setTeachingReview(null);
              }}
              rows={4}
              placeholder="Example: Do not reject candidates without EdTech if they have strong consumer product launches."
              className="mt-3 resize-none border-[#ded8cc] bg-[#fffdf8] text-[#151411] placeholder:text-[#a49a8b]"
            />
            {teachingReview && (
              <div className="mt-3 rounded-xl border border-[#fedf89] bg-[#fffaeb] p-3 text-[#7a3b00]">
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-full border border-[#fdb022] bg-white px-2 py-0.5 text-[10px] font-black uppercase tracking-[.12em]">{teachingReview.intent_type?.replaceAll("_", " ") || "review"}</span>
                  <span className="text-[10px] font-black uppercase tracking-[.12em]">Confirm before applying</span>
                </div>
                <p className="mt-2 text-xs leading-5">{teachingReview.interpretation}</p>
                <div className="mt-2 space-y-1">
                  {teachingReview.will_do.map((item) => (
                    <OneLine key={item} text={item} className="text-xs font-semibold" />
                  ))}
                </div>
              </div>
            )}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                onClick={reviewTeaching}
                disabled={busy || !instruction.trim() || !hasTeachingContext}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#ded8cc] bg-[#fffdf8] px-3 py-2 text-sm font-bold text-[#151411] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
                Review
              </button>
              <button
                onClick={refine}
                disabled={busy || !instruction.trim() || !hasTeachingContext}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#151411] bg-[#151411] px-3 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
                {teachingReview ? "Confirm" : "Apply"}
              </button>
            </div>
            {!hasTeachingContext && (
              <p className="mt-2 text-xs text-[#777064]">Add the JD and resumes before teaching the model.</p>
            )}
          </DeskCard>

          <DeskCard title="Run details" icon={Eye}>
            <div className="grid gap-2 text-sm">
              <InfoRow label="Resumes parsed" value={String(resumes.length)} />
              <InfoRow label="P0 in view" value={summary ? String(summary.p0_count) : "--"} />
              <InfoRow label="Blocked" value={summary ? String(summary.reject_count) : "--"} />
              <InfoRow label="Token usage" value={session.token_totals?._total_tokens ? Number(session.token_totals._total_tokens).toLocaleString() : "--"} />
            </div>
          </DeskCard>
        </aside>
      </div>
    </main>
  );
}

function StepPill({ label, active, done }: { label: string; active?: boolean; done?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${active ? "border-[#151411] bg-[#151411] text-white" : done ? "border-[#b6a88f] bg-[#ede7da] text-[#151411]" : "border-[#ded8cc] bg-white text-[#8b8376]"}`}>
      {done ? <Check size={11} /> : <CircleDashed size={11} />}
      {label}
    </span>
  );
}

function DeskCard({ title, icon: Icon, children, wide }: { title: string; icon: any; children: React.ReactNode; wide?: boolean }) {
  return (
    <section className={`min-w-0 rounded-2xl border border-[#ded8cc] bg-white shadow-sm ${wide ? "p-5 sm:p-6" : "p-4"}`}>
      <div className="mb-4 flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#ede7da] text-[#151411]"><Icon size={17} /></span>
        <h2 className="text-sm font-black tracking-tight">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function ReadinessRow({ label, done }: { label: string; done: boolean }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-[#ebe5d9] bg-[#fffdf8] px-3 py-2">
      <span className="min-w-0 truncate text-sm text-[#4d473d]">{label}</span>
      {done ? <CheckCircle2 size={15} className="text-emerald-600" /> : <CircleDashed size={15} className="text-[#b7ad9d]" />}
    </div>
  );
}

function ActionButton({ onClick, disabled, icon: Icon, label, busy, secondary }: { onClick: () => void; disabled?: boolean; icon: any; label: string; busy?: boolean; secondary?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${secondary ? "border border-[#ded8cc] bg-white text-[#151411] hover:border-[#151411]" : "border border-[#151411] bg-[#151411] text-white hover:bg-[#2a2823]"}`}
    >
      {busy ? <Loader2 size={15} className="animate-spin" /> : <Icon size={15} />}
      {label}
    </button>
  );
}

function CandidateReview({ candidate, tone, note, setNote, onAction, resume, sessionId }: {
  candidate: CandidateResult;
  tone: { label: string; color: string; bg: string; border: string };
  note: string;
  setNote: (value: string) => void;
  onAction: (action: ActionTone) => void;
  resume?: ResumeListItem;
  sessionId: string;
}) {
  const evidence = candidate.field_matches || [];
  const pdfUrl = resume ? `${BASE}/api/sessions/${sessionId}/resumes/${encodeURIComponent(resume.file_name)}/pdf` : "";
  const baseTone = baselineTone(candidate.baseline_pass);
  const [pdfOpen, setPdfOpen] = useState(false);
  const referral = referralInsight(resume);
  const counts = evidence.reduce(
    (acc, item) => {
      if (item.match === "pass") acc.pass += 1;
      else if (item.match === "fail") acc.fail += 1;
      else acc.review += 1;
      return acc;
    },
    { pass: 0, fail: 0, review: 0 },
  );
  return (
    <div className="space-y-4">
      <div className="space-y-4">
        <div className="rounded-2xl border border-[#ebe5d9] bg-[#fffdf8] p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <span className="rounded-full border px-2.5 py-1 text-[11px] font-bold" style={{ color: tone.color, background: tone.bg, borderColor: tone.border }}>{tone.label}</span>
              <h3 className="mt-3 truncate text-2xl font-black tracking-tight">{candidate.candidate_name}</h3>
              <OneLine text={compactText(candidate.reasoning, 140)} className="mt-2 max-w-3xl text-sm text-[#645d52]" />
            </div>
            <div className="grid grid-cols-2 gap-2 text-center">
              <Score label="Overall" value={candidate.overall_score} />
              <Score label="P0" value={candidate.p0_score} />
            </div>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {REVIEW_ACTIONS.map((action) => (
            <button key={action.key} onClick={() => onAction(action.key)} className={`inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-black ${action.className}`}>
              <action.icon size={16} /> {action.label}
            </button>
          ))}
        </div>

        <div className="rounded-2xl border border-[#ebe5d9] bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <MessageSquareText size={15} />
              <div>
                <p className="text-sm font-black">Recruiter note</p>
                <p className="text-xs text-[#777064]">Capture the one reason behind your decision.</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {["Strong signal, keep", "Too weak, reject", "Needs human review"].map((template) => (
                <button
                  key={template}
                  onClick={() => setNote(template)}
                  className="rounded-full border border-[#ded8cc] bg-[#fffdf8] px-2.5 py-1 text-[11px] font-bold text-[#4d473d] hover:border-[#151411]"
                >
                  {template}
                </button>
              ))}
            </div>
          </div>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Example: good product exposure, but ownership evidence is still unclear."
            className="mt-3 resize-none border-[#ded8cc] bg-[#fffdf8] text-[#151411] placeholder:text-[#a49a8b]"
          />
          <p className="mt-2 text-xs text-[#777064]">Keyboard: J next, K previous, S shortlist, R reject, F flag.</p>
        </div>

        <div className="rounded-2xl border border-[#ebe5d9] bg-white p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2"><ShieldAlert size={15} /><p className="text-sm font-black">Evidence trail</p></div>
            <div className="flex flex-wrap gap-2">
              <StatusChip label={`${counts.pass} pass`} tone={matchTone("pass")} />
              <StatusChip label={`${counts.review} review`} tone={matchTone("partial")} />
              <StatusChip label={`${counts.fail} fail`} tone={matchTone("fail")} />
            </div>
          </div>
          <div className="grid gap-2">
            {evidence.length === 0 ? <p className="text-sm text-[#777064]">No field evidence returned.</p> : evidence.map((item, index) => <EvidenceRow key={index} item={item} />)}
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
        <div className="rounded-2xl border border-[#ebe5d9] bg-[#fffdf8] p-4">
          <p className="text-xs font-bold uppercase tracking-[.16em] text-[#9b6a2f]">Decision detail</p>
          <div className="mt-3 flex items-center justify-between gap-3 border-t border-[#ebe5d9] pt-3">
            <span className="text-xs text-[#777064]">Classification</span>
            <span className="rounded-full border px-2 py-0.5 text-xs font-black" style={{ color: tone.color, background: tone.bg, borderColor: tone.border }}>{candidate.classification}</span>
          </div>
          <InfoRow label="Confidence" value={candidate.confidence || "--"} />
          <div className="mt-3 flex items-center justify-between gap-3 border-t border-[#ebe5d9] pt-3">
            <span className="text-xs text-[#777064]">Baseline</span>
            <span className="rounded-full border px-2 py-0.5 text-xs font-black" style={{ color: baseTone.color, background: baseTone.bg, borderColor: baseTone.border }}>{baseTone.label}</span>
          </div>
        </div>
        <div className="rounded-2xl border border-[#ebe5d9] bg-[#fffdf8] p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.16em] text-[#9b6a2f]">Resume</p>
              <p className="mt-1 text-xs text-[#777064]">Open in a side panel without leaving review mode.</p>
            </div>
            {resume && <span className="truncate text-[10px] font-semibold text-[#777064]">{resume.file_name}</span>}
          </div>
          {resume ? (
            <button
              onClick={() => setPdfOpen(true)}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#151411] px-3 py-2 text-sm font-bold text-white hover:bg-[#2a2823]"
            >
              <PanelRightOpen size={15} />
              Open resume workspace
            </button>
          ) : <p className="mt-2 text-sm text-[#777064]">PDF link appears when the candidate maps to an uploaded file.</p>}
          <div className="mt-3 rounded-lg border px-3 py-2" style={{ color: referral.found ? "#027a48" : "#b54708", background: referral.found ? "#ecfdf3" : "#fffaeb", borderColor: referral.found ? "#abefc6" : "#fedf89" }}>
            <p className="text-xs font-black">{referral.label}</p>
            <OneLine text={referral.detail} className="mt-1 text-xs" />
          </div>
        </div>
      </div>
      {resume && (
        <ResumeSidePanel
          open={pdfOpen}
          onClose={() => setPdfOpen(false)}
          candidateName={candidate.candidate_name}
          fileName={resume.file_name}
          pdfUrl={pdfUrl}
          resume={resume}
          sessionId={sessionId}
        />
      )}
    </div>
  );
}

function StatusChip({ label, tone }: { label: string; tone: { color: string; bg: string; border: string } }) {
  return (
    <span className="rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-[.08em]" style={{ color: tone.color, background: tone.bg, borderColor: tone.border }}>
      {label}
    </span>
  );
}

function ResumeSidePanel({ open, onClose, candidateName, fileName, pdfUrl, resume, sessionId }: {
  open: boolean;
  onClose: () => void;
  candidateName: string;
  fileName: string;
  pdfUrl: string;
  resume: ResumeListItem;
  sessionId: string;
}) {
  const noteKey = `nexthire:private-note:${sessionId}:${fileName}`;
  const noteSavedKey = `${noteKey}:saved-at`;
  const [privateNote, setPrivateNote] = useState("");
  const [noteSavedAt, setNoteSavedAt] = useState("");
  const [referralOpen, setReferralOpen] = useState(false);
  const referral = referralInsight(resume);

  useEffect(() => {
    if (!open) return;
    setPrivateNote(window.localStorage.getItem(noteKey) || "");
    setNoteSavedAt(window.localStorage.getItem(noteSavedKey) || "");
  }, [noteKey, noteSavedKey, open]);

  function savePrivateNote(value: string) {
    const timestamp = new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
    setPrivateNote(value);
    setNoteSavedAt(timestamp);
    window.localStorage.setItem(noteKey, value);
    window.localStorage.setItem(noteSavedKey, timestamp);
  }

  function appendPrivateNote(template: string) {
    const next = privateNote ? `${privateNote}\n${template}` : template;
    savePrivateNote(next);
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/25">
      <button className="absolute inset-0 cursor-default" aria-label="Close resume preview" onClick={onClose} />
      <aside className="relative flex h-full w-full max-w-6xl flex-col overflow-hidden border-l border-[#ded8cc] bg-[#f9f7f1] shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-[#ded8cc] px-4 py-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[.18em] text-[#9b6a2f]">Resume workspace</p>
            <h3 className="mt-1 truncate text-base font-black">{candidateName}</h3>
            <p className="truncate text-xs text-[#777064]">{fileName}</p>
          </div>
          <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#ded8cc] bg-white text-[#151411] hover:border-[#151411]">
            <X size={15} />
          </button>
        </div>
        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[minmax(0,1fr)_360px]">
          <iframe title={`${candidateName} resume PDF`} src={pdfUrl} className="h-full min-h-[65vh] w-full bg-white lg:min-h-0" />
          <aside className="overflow-y-auto border-t border-[#ded8cc] bg-[#fffdf8] p-4 lg:border-l lg:border-t-0">
            <section className="overflow-hidden rounded-2xl border border-[#ded8cc] bg-[#fffdf8] shadow-sm">
              <div className="border-b border-[#e5dccb] bg-[#fbf4df] px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-black uppercase tracking-[.16em] text-[#9b6a2f]">Private note</p>
                    <h4 className="mt-1 truncate text-base font-black text-[#151411]">Selection rationale</h4>
                  </div>
                  <span className="shrink-0 rounded-full border border-[#d8c59f] bg-[#fffaf0] px-2 py-0.5 text-[10px] font-black text-[#7a5524]">Private</span>
                </div>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-[#777064]">
                  <OneLine text={`Candidate: ${candidateName}`} className="max-w-[210px]" />
                  <span className="font-semibold">{noteSavedAt ? `Saved ${noteSavedAt}` : "Not saved yet"}</span>
                </div>
              </div>
              <div className="p-4">
                <textarea
                  value={privateNote}
                  onChange={(e) => savePrivateNote(e.target.value)}
                  rows={12}
                  placeholder={"Decision note\nWhy select:\nEvidence to verify:\nConcern:"}
                  className="private-note-pad min-h-[280px] w-full resize-none rounded-xl border border-[#e0d2b6] px-4 py-3 text-sm leading-7 text-[#2c2924] outline-none placeholder:text-[#b09b74] focus:border-[#9b6a2f]"
                />
                <div className="mt-3 grid grid-cols-1 gap-2">
                  {[
                    "Why select: ",
                    "Evidence to verify: ",
                    "Concern: ",
                    "Hiring manager summary: ",
                  ].map((template) => (
                    <button
                      key={template}
                      onClick={() => appendPrivateNote(template)}
                      className="rounded-lg border border-[#ded8cc] bg-white px-3 py-2 text-left text-xs font-semibold text-[#4d473d] hover:border-[#9b6a2f]"
                    >
                      {template.replace(": ", "")}
                    </button>
                  ))}
                </div>
                <p className="mt-3 text-xs leading-5 text-[#777064]">Stored locally for this resume. Use it for private screening rationale before sharing a shortlist.</p>
              </div>
            </section>

            <section className="mt-4 rounded-2xl border border-[#ebe5d9] bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-black">Referral check</p>
                  <OneLine text="Quick scan for referral markers in parsed resume data." className="mt-1 text-xs text-[#777064]" />
                </div>
                <button
                  onClick={() => setReferralOpen((value) => !value)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#ded8cc] bg-[#fffdf8] px-2.5 py-1.5 text-xs font-bold text-[#151411] hover:border-[#151411]"
                >
                  <Search size={13} />
                  Check
                </button>
              </div>
              <div className="mt-3 rounded-xl border px-3 py-3" style={{ color: referral.found ? "#027a48" : "#b54708", background: referral.found ? "#ecfdf3" : "#fffaeb", borderColor: referral.found ? "#abefc6" : "#fedf89" }}>
                <p className="text-xs font-black">{referral.label}</p>
                <OneLine text={referral.detail} className="mt-1 text-xs" />
              </div>
              {referralOpen && (
                <div className="mt-3 rounded-xl border border-[#ebe5d9] bg-[#fffdf8] p-3">
                  <p className="text-[10px] font-black uppercase tracking-[.14em] text-[#9b6a2f]">How to use this</p>
                  <OneLine text="Assistive check only. Confirm referrals from ATS metadata, employee email, or recruiter-entered source." className="mt-1 text-xs text-[#645d52]" />
                </div>
              )}
            </section>
          </aside>
        </div>
      </aside>
    </div>
  );
}

function EvidenceRow({ item }: { item: CandidateResult["field_matches"][number] }) {
  const tone = matchTone(item.match);
  const field = evidenceFieldLabel(item.field);
  const requirement = evidenceCriterion(item.criteria_checked);
  const resumeSignal = evidenceResumeSignal(item.value_from_resume);
  const decision = evidenceDecisionNote(item.note, item.match);
  const line = `${requirement}: ${decision}; ${resumeSignal}.`;
  return (
    <article className="grid min-w-0 grid-cols-[74px_62px_minmax(0,1fr)] items-center gap-2 rounded-xl border bg-[#fffdf8] px-3 py-2 sm:grid-cols-[88px_72px_minmax(0,1fr)]" style={{ borderColor: tone.border }}>
      <OneLine text={field} className="text-[11px] font-black uppercase tracking-[.1em] text-[#9b6a2f]" />
      <span className="rounded-full border px-2 py-0.5 text-center text-[10px] font-black" style={{ color: tone.color, background: tone.bg, borderColor: tone.border }}>{tone.label}</span>
      <OneLine text={line} className="text-sm font-medium text-[#4d473d]" />
    </article>
  );
}

function Score({ label, value }: { label: string; value?: number }) {
  return (
    <div className="rounded-xl border border-[#ded8cc] bg-white px-4 py-3">
      <p className="text-2xl font-black leading-none">{pct(value)}</p>
      <p className="mt-1 text-[10px] font-bold uppercase tracking-[.14em] text-[#9b6a2f]">{label}</p>
    </div>
  );
}

function rubricRoleLens(value?: string) {
  const text = String(value || "").toLowerCase();
  if (text.includes("shipped consumer internet products")) return "Consumer PM: launch, judgment, metrics.";
  return compactText(String(value || ""), 88);
}

function rubricHardLabel(value?: string) {
  const text = String(value || "");
  const lower = text.toLowerCase();
  if (lower.includes("tier") && (lower.includes("university") || lower.includes("institution") || lower.includes("college"))) return "Tier 1 university";
  if (lower.includes("product management") || lower.includes("product ownership") || lower.includes("product role")) return "Product experience";
  const normalized = evidenceCriterion(text);
  if (normalized === "1-1.5 yrs PM") return "PM tenure";
  if (normalized === "Lifecycle") return "Lifecycle ownership";
  if (normalized === "Customer/metrics") return "Customer metrics";
  if (normalized === "Stakeholders") return "Stakeholder alignment";
  return compactText(text.replaceAll("_", " "), 60);
}

function rubricP0Label(value?: string) {
  const text = String(value || "").toLowerCase();
  if (text.includes("clear inflection point")) return "Ownership trajectory";
  if (text.includes("deep curiosity") || text.includes("understanding the 'why'")) return "Curiosity depth";
  if (text.includes("data and analysis") || text.includes("product improvements")) return "Metrics-led iteration";
  if (text.includes("product taste") || text.includes("design")) return "Product taste";
  return compactText(String(value || "").replaceAll("_", " "), 62);
}

function rubricRiskLabel(value?: string) {
  const text = String(value || "").toLowerCase();
  if (text.includes("passive contribution") || text.includes("worked on") || text.includes("contributed to")) return "Passive ownership";
  if (text.includes("non-consumer")) return "Non-consumer product evidence";
  if (text.includes("academic")) return "Academic-only product proof";
  return compactText(String(value || "").replaceAll("_", " "), 62);
}

function RubricPanel({ jd, rubric }: { jd: JdAnalysis; rubric: any }) {
  const checks = rubric?.scoring_rubric?.baseline_checks || [];
  const weights = rubric?.scoring_rubric?.p0_weights || [];
  const red = rubric?.scoring_rubric?.red_flag_checks || jd.red_flags || [];
  const hardSource = checks.length ? checks.filter((item: any) => item?.reject_if_missing !== false && item?.status !== "disabled") : jd.baseline_signals || [];
  const relaxedSource = checks.length ? checks.filter((item: any) => item?.reject_if_missing === false && item?.status !== "disabled") : [];
  const hardChecks = hardSource.slice(0, 6).map((item: any) => ({
    text: rubricHardLabel(item.check || item),
    meta: item.source === "explicit" ? "explicit" : "hard",
  }));
  const relaxedChecks = relaxedSource.slice(0, 4).map((item: any) => ({
    text: rubricHardLabel(item.check || item),
    meta: "relaxed",
  }));
  const p0Signals = (weights.length ? weights : jd.p0_signals || []).slice(0, 5).map((item: any) => ({
    text: rubricP0Label(item.signal || item),
    meta: item.weight ? `${item.weight} pts` : "P0 signal",
  }));
  const redFlags = (red || []).slice(0, 4).map((item: any) => ({
    text: rubricRiskLabel(item.check || item.flag || item),
    meta: "risk",
  }));
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <RubricMetric label="Hard" value={hardChecks.length} tone={matchTone("fail")} />
        <RubricMetric label="P0" value={p0Signals.length} tone={matchTone("pass")} />
        <RubricMetric label="Risk" value={redFlags.length} tone={matchTone("partial")} />
      </div>
      {jd.one_liner && (
        <div className="rounded-xl border border-[#ebe5d9] bg-[#fffdf8] p-3">
          <p className="text-[10px] font-black uppercase tracking-[.14em] text-[#9b6a2f]">Role lens</p>
          <OneLine text={rubricRoleLens(jd.one_liner)} className="mt-1 text-sm text-[#4d473d]" />
        </div>
      )}
      <RubricList title="Hard filters" items={hardChecks} icon={CheckCircle2} tone={matchTone("fail")} />
      {relaxedChecks.length > 0 && <RubricList title="Relaxed criteria" items={relaxedChecks} icon={CircleDashed} tone={matchTone("partial")} />}
      <RubricList title="P0 signals" items={p0Signals} icon={Star} tone={matchTone("pass")} />
      <RubricList title="Red flags" items={redFlags} icon={ShieldAlert} tone={matchTone("partial")} />
    </div>
  );
}

function RubricMetric({ label, value, tone }: { label: string; value: number; tone: { color: string; bg: string; border: string } }) {
  return (
    <div className="rounded-xl border p-3 text-center" style={{ background: tone.bg, borderColor: tone.border }}>
      <p className="text-xl font-black leading-none" style={{ color: tone.color }}>{value}</p>
      <p className="mt-1 text-[10px] font-black uppercase tracking-[.12em]" style={{ color: tone.color }}>{label}</p>
    </div>
  );
}

function RubricList({ title, items, icon: Icon, tone }: {
  title: string;
  items: Array<{ text: string; meta: string }>;
  icon: any;
  tone: { color: string; bg: string; border: string };
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.16em] text-[#9b6a2f]"><Icon size={13} /> {title}</div>
        <span className="rounded-full border px-2 py-0.5 text-[10px] font-black" style={{ color: tone.color, background: tone.bg, borderColor: tone.border }}>{items.length}</span>
      </div>
      <div className="space-y-2">
        {items.length === 0 ? <p className="text-sm text-[#777064]">Waiting for rubric.</p> : items.map((item, index) => (
          <div key={`${item.text}-${index}`} className="grid min-w-0 grid-cols-[minmax(0,1fr)_88px] items-center gap-2 rounded-lg border border-[#ebe5d9] bg-[#fffdf8] px-3 py-2">
            <OneLine text={compactText(item.text, 105)} className="text-sm font-medium text-[#2c2924]" />
            <span className="truncate rounded-full border border-[#ded8cc] bg-white px-2 py-0.5 text-center text-[10px] font-bold uppercase tracking-[.08em] text-[#9b6a2f]" title={item.meta}>{item.meta}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="mt-3 flex items-center justify-between gap-3 border-t border-[#ebe5d9] pt-3 first:mt-0 first:border-t-0 first:pt-0">
      <span className="text-xs text-[#777064]">{label}</span>
      <span className="text-right text-xs font-black text-[#151411]">{value}</span>
    </div>
  );
}

function RunningPanel({ session }: { session: Session }) {
  const progress = session.full_eval_progress;
  const scored = progress?.scored || 0;
  const total = progress?.total || 0;
  const width = total ? Math.round((scored / total) * 100) : 12;
  return (
    <div className="grid min-h-[460px] place-items-center rounded-2xl border border-[#ebe5d9] bg-[#fffdf8] p-8 text-center">
      <div className="w-full max-w-md">
        <Loader2 className="mx-auto animate-spin text-[#151411]" size={34} />
        <h3 className="mt-5 text-xl font-black">Final shortlist is running</h3>
        <p className="mt-2 text-sm leading-6 text-[#777064]">The backend is scoring every parsed resume against the calibrated rubric.</p>
        <div className="mt-6 h-3 overflow-hidden rounded-full bg-[#e9e1d4]"><div className="h-full rounded-full bg-[#151411]" style={{ width: `${width}%` }} /></div>
        <p className="mt-2 text-xs font-semibold text-[#777064]">{scored || "--"} of {total || "--"} candidates scored</p>
      </div>
    </div>
  );
}
