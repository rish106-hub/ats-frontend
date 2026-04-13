"use client";

import {
  type CandidateResult, type PreviewResults, type P0Match,
  type CandidateFeedback, type ResumeListItem, type ResumeLens,
} from "@/lib/api";
import { Textarea } from "@/components/ui/textarea";
import { useState, useMemo } from "react";
import { ResumeDrawer } from "@/components/resume-drawer";
import {
  FileText, MessageSquare, Info, ThumbsDown, Check, ChevronDown, ChevronUp,
  CheckCircle2, X, ExternalLink, Minus,
} from "lucide-react";

// ── Constants ──────────────────────────────────────────────────────────
const MATCH_STYLE = {
  pass:    { label: "Pass",    cls: "text-emerald-400", bg: "rgba(16,185,129,0.05)", border: "border-l-emerald-500" },
  fail:    { label: "Fail",    cls: "text-red-400",     bg: "rgba(239,68,68,0.05)",  border: "border-l-red-500"    },
  partial: { label: "Partial", cls: "text-amber-400",   bg: "rgba(245,158,11,0.05)", border: "border-l-amber-500"  },
};
const MATCH_ICON: Record<string, React.ReactNode> = {
  pass:    <Check size={10} />,
  fail:    <X size={10} />,
  partial: <Minus size={10} />,
};

const CLASS_CONFIG: Record<string, { bg: string; dot: string }> = {
  P0:       { bg: "bg-emerald-500/[.1] text-emerald-300 border border-emerald-500/30", dot: "bg-emerald-400" },
  Baseline: { bg: "bg-blue-500/[.1] text-blue-300 border border-blue-500/30",          dot: "bg-blue-400"    },
  Reject:   { bg: "bg-red-500/[.08] text-red-300 border border-red-500/20",            dot: "bg-red-400"     },
};

// ── Helpers ────────────────────────────────────────────────────────────
function toStr(val: unknown): string {
  if (typeof val === "string") return val;
  if (val === null || val === undefined) return "";
  if (typeof val === "object") {
    const obj = val as Record<string, unknown>;
    for (const key of ["signal", "check", "text", "description", "value", "label"]) {
      if (typeof obj[key] === "string" && (obj[key] as string).trim()) return obj[key] as string;
    }
    return JSON.stringify(val);
  }
  return String(val);
}

function truncate(str: string, max = 120): string {
  if (!str || str.length <= max) return str;
  return str.slice(0, max).trimEnd() + "…";
}

function ExpandableText({ text, maxLen = 120, className = "" }: { text: string; maxLen?: number; className?: string }) {
  const [expanded, setExpanded] = useState(false);
  if (!text) return null;
  const isLong = text.length > maxLen;
  return (
    <span className={className}>
      {expanded || !isLong ? text : truncate(text, maxLen)}
      {isLong && (
        <button
          onClick={(e) => { e.stopPropagation(); setExpanded(v => !v); }}
          className="ml-1 text-blue-400/60 hover:text-blue-400 underline text-[10px] shrink-0"
        >
          {expanded ? "less" : "more"}
        </button>
      )}
    </span>
  );
}

// ── Field match row ────────────────────────────────────────────────────
function FieldMatchRow({ fm }: { fm: { field: unknown; value_from_resume: unknown; criteria_checked: unknown; match: "pass" | "fail" | "partial"; note: unknown } }) {
  const m = MATCH_STYLE[fm.match] ?? { label: "—", cls: "text-[#6c80a8]", bg: "rgba(96,165,250,0.03)", border: "border-l-white/20" };
  const mIcon = MATCH_ICON[fm.match] ?? <Minus size={10} />;
  const [open, setOpen] = useState(false);

  const field = toStr(fm.field);
  const criteriaChecked = toStr(fm.criteria_checked);
  const valueFromResume = toStr(fm.value_from_resume);
  const note = toStr(fm.note);

  return (
    <div className={`border-l-2 ${m.border} rounded-r-lg overflow-hidden`} style={{ background: m.bg }}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-3 py-2 text-left transition-colors gap-2"
        style={{ background: "transparent" }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-[#c8d8f0] px-2 py-0.5 rounded shrink-0"
            style={{ background: "rgba(96,165,250,0.08)", border: "1px solid rgba(96,165,250,0.15)" }}>
            {field}
          </span>
          <span className={`text-[11px] font-bold ${m.cls} flex items-center gap-1 shrink-0`}>
            {mIcon} {m.label}
          </span>
          {!open && criteriaChecked && (
            <span className="text-[11px] text-[#4a6080] truncate min-w-0">
              {truncate(criteriaChecked, 60)}
            </span>
          )}
        </div>
        {open ? <ChevronUp size={12} className="text-[#2a3a5a] shrink-0" /> : <ChevronDown size={12} className="text-[#2a3a5a] shrink-0" />}
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-2">
          {criteriaChecked && (
            <div className="flex gap-2">
              <span className="text-[10px] text-[#3a5080] font-semibold uppercase tracking-wide shrink-0 pt-0.5 w-20">Criteria</span>
              <p className="text-xs text-[#c8d8f0] leading-relaxed"><ExpandableText text={criteriaChecked} maxLen={200} /></p>
            </div>
          )}
          {valueFromResume && (
            <div className="flex gap-2">
              <span className="text-[10px] text-[#3a5080] font-semibold uppercase tracking-wide shrink-0 pt-0.5 w-20">Resume</span>
              <p className="text-xs text-[#a8b8d8] leading-relaxed"><ExpandableText text={valueFromResume} maxLen={200} /></p>
            </div>
          )}
          {note && (
            <div className="flex gap-2">
              <span className="text-[10px] text-[#3a5080] font-semibold uppercase tracking-wide shrink-0 pt-0.5 w-20">Note</span>
              <p className={`text-xs leading-relaxed italic ${m.cls} opacity-80`}><ExpandableText text={note} maxLen={200} /></p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── P0 Signal ─────────────────────────────────────────────────────────
function P0Signal({ m }: { m: P0Match | string | unknown }) {
  const label = toStr(typeof m === "object" && m !== null && "signal" in (m as object) ? (m as P0Match).signal : m as string);
  return (
    <div className="flex items-start gap-2 text-xs">
      <CheckCircle2 size={11} className="text-emerald-400 shrink-0 mt-0.5" />
      <span className="text-[#c8d8f0] leading-relaxed"><ExpandableText text={label} maxLen={120} /></span>
    </div>
  );
}

// ── Score bar ──────────────────────────────────────────────────────────
function ScoreBar({ score, max = 100 }: { score: number; max?: number }) {
  const pct = Math.min((score / max) * 100, 100);
  const color = pct >= 70 ? "from-emerald-500 to-emerald-400" : pct >= 40 ? "from-blue-500 to-blue-400" : "from-red-500 to-red-400";
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(96,165,250,0.08)" }}>
        <div className={`h-full bg-gradient-to-r ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-mono font-bold text-[#6c80a8] w-7 text-right">{score}</span>
    </div>
  );
}

// ── Candidate card ────────────────────────────────────────────────────
function CandidateCard({ c, rank, onFeedback, onViewResume }: {
  c: CandidateResult;
  rank: number;
  onFeedback?: (fb: CandidateFeedback) => void;
  onViewResume?: (c: CandidateResult) => void;
}) {
  const [open, setOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackAction, setFeedbackAction] = useState("should_pass");
  const [feedbackReason, setFeedbackReason] = useState("");
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

  const cls = c.classification;
  const clsCfg = CLASS_CONFIG[cls] ?? { bg: "bg-white/[.06] text-[#c8d8f0] border border-white/10", dot: "bg-[#6c80a8]" };

  const cardBorder =
    cls === "P0"       ? "border-emerald-500/20 hover:border-emerald-500/35" :
    cls === "Baseline" ? "border-blue-500/15 hover:border-blue-500/30" :
                         "border-white/[.06] hover:border-white/[.10]";

  const cardLeftAccent =
    cls === "P0"       ? "3px solid #10b981" :
    cls === "Baseline" ? "3px solid #4f6ef7" :
                         "3px solid rgba(100,116,139,0.3)";

  function handleSubmitFeedback(e: React.MouseEvent) {
    e.stopPropagation();
    if (!onFeedback || !feedbackReason.trim()) return;
    onFeedback({ file_name: c.candidate_name, action: feedbackAction, reason: feedbackReason });
    setFeedbackOpen(false);
    setFeedbackReason("");
    setFeedbackSubmitted(true);
  }

  return (
    <div
      className={`nh-card border overflow-hidden transition-all ${cardBorder}`}
      style={{ borderLeft: cardLeftAccent }}
    >
      {/* Card header */}
      <div
        onClick={() => setOpen(v => !v)}
        className="flex items-center justify-between px-4 py-3.5 cursor-pointer transition-colors gap-3"
        style={{ background: open ? "rgba(96,165,250,0.03)" : "transparent" }}
      >
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          <span className="text-[10px] font-mono text-[#2a3a5a] shrink-0">#{rank}</span>

          <span className="font-semibold text-sm text-white truncate">{c.candidate_name || "Unknown"}</span>

          <span className={`flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full font-semibold shrink-0 ${clsCfg.bg}`}>
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${clsCfg.dot}`} />
            {cls}
          </span>

          {c.confidence && c.confidence !== "high" && (
            <span className={`text-[9px] px-1.5 py-0.5 rounded-full border font-semibold shrink-0 ${
              c.confidence === "low" ? "border-red-500/30 text-red-400" : "border-amber-500/30 text-amber-400"
            }`}>
              {c.confidence === "low" ? "low" : "mid"} confidence
            </span>
          )}

          {!c.baseline_pass && (
            <span className="text-[10px] border border-red-500/20 text-red-400 px-1.5 py-0.5 rounded shrink-0"
              style={{ background: "rgba(239,68,68,0.06)" }}>
              Baseline fail
            </span>
          )}

          {onViewResume && (
            <button
              onClick={(e) => { e.stopPropagation(); onViewResume(c); }}
              className="flex items-center gap-1 text-[10px] font-semibold text-[#6c80a8] hover:text-blue-300 px-2 py-0.5 rounded transition-all shrink-0"
              style={{ background: "rgba(96,165,250,0.06)", border: "1px solid rgba(96,165,250,0.15)" }}
            >
              <FileText size={10} /> Resume
            </button>
          )}

          {onFeedback && (
            <button
              onClick={(e) => { e.stopPropagation(); setFeedbackOpen(v => !v); }}
              className={`text-[10px] font-semibold px-2 py-0.5 rounded border transition-all shrink-0 ${
                feedbackSubmitted
                  ? "border-emerald-500/20 text-emerald-400"
                  : "text-[#6c80a8] hover:text-amber-300 border-white/[.08] hover:border-amber-500/20"
              }`}
              style={{ background: feedbackSubmitted ? "rgba(16,185,129,0.06)" : "rgba(96,165,250,0.04)" }}
            >
              {feedbackSubmitted ? <><Check size={11} /> Sent</> : <><ThumbsDown size={10} /> Disagree</>}
            </button>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {c.overall_score !== undefined && (
            <div className="w-24 hidden sm:block">
              <ScoreBar score={c.overall_score} />
            </div>
          )}
          {open ? <ChevronUp size={13} className="text-[#2a3a5a]" /> : <ChevronDown size={13} className="text-[#2a3a5a]" />}
        </div>
      </div>

      {/* Expanded body */}
      {open && (
        <div className="px-4 py-4 space-y-5 border-t" style={{ borderColor: "rgba(96,165,250,0.08)", background: "rgba(2,9,23,0.35)" }}>

          {/* Feedback form */}
          {feedbackOpen && (
            <div className="nh-inset p-4 space-y-3" style={{ borderColor: "rgba(59,130,246,0.2)" }}>
              <p className="text-xs font-semibold text-blue-300">
                Tell the AI what it got wrong — this updates the rubric and re-evaluates immediately.
              </p>
              <select
                title="action"
                className="w-full text-[#cbd5f0] text-xs rounded-lg px-3 py-2"
                value={feedbackAction}
                onChange={(e) => setFeedbackAction(e.target.value)}
              >
                <option value="should_pass">Should PASS — they have what&apos;s needed</option>
                <option value="should_fail">Should FAIL — red flag or missing skill</option>
                <option value="p0_booster">Deserves a P0 boost</option>
              </select>
              <Textarea
                placeholder="Explain why, e.g. 'They have 3 years B2B SaaS experience which is exactly what we need.'"
                className="text-[#c8d8f0] text-xs min-h-[70px] resize-none"
                value={feedbackReason}
                onChange={(e) => setFeedbackReason(e.target.value)}
              />
              <div className="flex gap-2 justify-end">
                <button
                  className="text-[10px] text-[#4a6080] hover:text-[#a8b8d8] px-3 py-1.5 transition-colors"
                  onClick={(e) => { e.stopPropagation(); setFeedbackOpen(false); }}
                >
                  Cancel
                </button>
                <button
                  className="nh-btn-primary flex items-center gap-1.5 text-[10px] font-semibold px-3 py-1.5 disabled:opacity-50"
                  disabled={!feedbackReason.trim()}
                  onClick={handleSubmitFeedback}
                >
                  Submit & Re-evaluate
                </button>
              </div>
            </div>
          )}

          {/* Reasoning */}
          {c.reasoning && (
            <div className="flex gap-3">
              <MessageSquare size={13} className="text-[#3a5080] mt-0.5 shrink-0" />
              <p className="text-xs text-[#a8b8d8] leading-relaxed italic">
                <ExpandableText text={toStr(c.reasoning)} maxLen={300} />
              </p>
            </div>
          )}

          {/* Baseline failures */}
          {c.baseline_failures && c.baseline_failures.length > 0 && (
            <div className="nh-inset p-3 space-y-1" style={{ borderColor: "rgba(239,68,68,0.2)", background: "rgba(239,68,68,0.05)" }}>
              <p className="text-[10px] font-semibold text-red-400 uppercase tracking-wider mb-2">Baseline Failures</p>
              {c.baseline_failures.map((f, i) => (
                <p key={i} className="text-xs text-red-300 leading-relaxed flex gap-1.5 items-start"><span className="text-red-400 shrink-0 mt-0.5">-</span><ExpandableText text={toStr(f)} maxLen={150} /></p>
              ))}
            </div>
          )}

          {/* Red flags */}
          {c.red_flags_found && c.red_flags_found.length > 0 && (
            <div className="nh-inset p-3 space-y-1" style={{ borderColor: "rgba(249,115,22,0.15)", background: "rgba(249,115,22,0.04)" }}>
              <p className="text-[10px] font-semibold text-orange-400 uppercase tracking-wider mb-2">Red Flags</p>
              {c.red_flags_found.map((f, i) => (
                <p key={i} className="text-xs text-orange-300 leading-relaxed flex gap-1.5 items-start"><span className="text-orange-400 shrink-0 mt-0.5">-</span><ExpandableText text={toStr(f)} maxLen={150} /></p>
              ))}
            </div>
          )}

          {/* P0 signals matched */}
          {c.p0_matches && c.p0_matches.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-semibold text-[#4a6080] uppercase tracking-wider">P0 Signals Matched</p>
              <div className="space-y-1.5">
                {c.p0_matches.map((m, i) => <P0Signal key={i} m={m} />)}
              </div>
            </div>
          )}

          {/* Extra param matches */}
          {c.extra_param_matches && c.extra_param_matches.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold text-[#4a6080] uppercase tracking-wider">Extra Parameters</p>
              {c.extra_param_matches.map((m, i) => (
                <p key={i} className="text-xs text-[#a8b8d8] flex gap-1.5 items-start"><span className="text-[#3a5080] shrink-0 mt-0.5">-</span><ExpandableText text={toStr(m)} maxLen={120} /></p>
              ))}
            </div>
          )}

          {/* Field-level breakdown */}
          {c.field_matches && c.field_matches.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-semibold text-[#4a6080] uppercase tracking-wider">Field-Level Breakdown</p>
              <div className="space-y-1.5">
                {c.field_matches.map((fm, i) => <FieldMatchRow key={i} fm={fm} />)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main export ────────────────────────────────────────────────────────
export function FieldMatchTable({
  results,
  onFeedback,
  sessionId,
  resumes = [],
}: {
  results: PreviewResults;
  onFeedback?: (fb: CandidateFeedback) => void;
  sessionId?: string;
  resumes?: ResumeListItem[];
}) {
  const { summary, results: candidates } = results;

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerCandidate, setDrawerCandidate] = useState<CandidateResult | null>(null);
  const [drawerFileName, setDrawerFileName] = useState("");
  const [drawerLens, setDrawerLens] = useState<ResumeLens | null>(null);
  const [filterCls, setFilterCls] = useState<string>("all");

  const WINDOW_STEP = 50;
  const [visibleCount, setVisibleCount] = useState(WINDOW_STEP);

  const fileNameByCandidate = useMemo(() => {
    const map: Record<string, string> = {};
    for (const r of resumes) {
      const parsedName = (r.resume_json?.name || "").toLowerCase();
      const stem = r.file_name.replace(/\.pdf$/i, "").replace(/[_-]/g, " ").trim().toLowerCase();
      if (parsedName) map[parsedName] = r.file_name;
      map[stem] = r.file_name;
    }
    return map;
  }, [resumes]);

  function resolveFileName(name: string): string {
    const key = name.toLowerCase();
    if (fileNameByCandidate[key]) return fileNameByCandidate[key];
    for (const [k, v] of Object.entries(fileNameByCandidate)) {
      if (k.includes(key) || key.includes(k)) return v;
    }
    return name;
  }

  function handleViewResume(c: CandidateResult) {
    if (!sessionId) return;
    const fileName = resolveFileName(c.candidate_name || "");
    const matched = resumes.find((r) => r.file_name === fileName);
    setDrawerCandidate(c);
    setDrawerFileName(fileName);
    setDrawerLens(matched?.resume_lens ?? null);
    setDrawerOpen(true);
  }

  function makeFeedbackHandler(candidateName: string) {
    if (!onFeedback) return undefined;
    return (fb: CandidateFeedback) => {
      const resolvedFileName = resolveFileName(candidateName);
      onFeedback({ ...fb, file_name: resolvedFileName });
    };
  }

  if (!candidates || candidates.length === 0) {
    return <p className="text-[#4a6080] text-sm">No candidates to display.</p>;
  }

  const allReject = summary.p0_count === 0 && summary.baseline_count === 0 && summary.reject_count > 0;
  const filteredCandidates = filterCls === "all" ? candidates : candidates.filter((c) => c.classification === filterCls);

  return (
    <>
      <div className="space-y-4">

        {/* Summary stats */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Total",    value: summary.total_evaluated, color: "text-white",       accent: "rgba(79,110,247,0.5)"  },
            { label: "P0",       value: summary.p0_count,        color: "text-emerald-400", accent: "rgba(16,185,129,0.5)"  },
            { label: "Baseline", value: summary.baseline_count,  color: "text-blue-400",    accent: "rgba(79,110,247,0.5)"  },
            { label: "Reject",   value: summary.reject_count,    color: "text-red-400",     accent: "rgba(239,68,68,0.5)"   },
          ].map(({ label, value, color, accent }) => (
            <div key={label} className="nh-card p-5 text-center" style={{ borderTop: `2px solid ${accent}` }}>
              <div className={`text-3xl font-black font-mono ${color}`}>{value}</div>
              <div className="text-[#566b99] text-[10px] mt-2 uppercase tracking-widest">
                {label}
              </div>
            </div>
          ))}
        </div>

        {/* Filter tabs */}
        {candidates.length > 5 && (
          <div className="flex gap-2 flex-wrap">
            {["all", "P0", "Baseline", "Reject"].map((f) => (
              <button
                key={f}
                onClick={() => { setFilterCls(f); setVisibleCount(WINDOW_STEP); }}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-all font-medium ${
                  filterCls === f
                    ? "text-blue-300"
                    : "text-[#4a6080] hover:text-[#c8d8f0]"
                }`}
                style={filterCls === f
                  ? { background: "rgba(37,99,235,0.12)", borderColor: "rgba(96,165,250,0.3)" }
                  : { background: "rgba(96,165,250,0.04)", borderColor: "rgba(96,165,250,0.12)" }
                }
              >
                {f === "all" ? `All (${candidates.length})` : `${f} (${candidates.filter(c => c.classification === f).length})`}
              </button>
            ))}
          </div>
        )}

        {/* All-reject warning */}
        {allReject && (
          <div className="nh-inset px-4 py-3 flex items-start gap-3">
            <Info size={14} className="text-[#6c80a8] shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="text-xs font-semibold text-[#c8d8f0]">None of these candidates meet the baseline</p>
              <p className="text-xs text-[#4a6080] leading-relaxed">
                The AI applies your criteria as absolute thresholds. Try uploading stronger candidates,
                or relax a criterion that may be filtering too aggressively.
              </p>
            </div>
          </div>
        )}

        {/* Candidate list */}
        <div className="space-y-2">
          {filteredCandidates.slice(0, visibleCount).map((c, i) => (
            <CandidateCard
              key={i}
              c={c}
              rank={candidates.indexOf(c) + 1}
              onFeedback={makeFeedbackHandler(c.candidate_name || "")}
              onViewResume={sessionId ? handleViewResume : undefined}
            />
          ))}
          {visibleCount < filteredCandidates.length && (
            <div className="flex items-center justify-center pt-4">
              <button
                onClick={() => setVisibleCount((n) => Math.min(n + WINDOW_STEP, filteredCandidates.length))}
                className="nh-btn-ghost text-xs px-6 py-2"
              >
                Load {Math.min(WINDOW_STEP, filteredCandidates.length - visibleCount)} more
                <span className="text-[#3a5080] ml-1">({visibleCount}/{filteredCandidates.length} shown)</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {drawerCandidate && sessionId && (
        <ResumeDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          sessionId={sessionId}
          fileName={drawerFileName}
          candidate={drawerCandidate}
          resumeLens={drawerLens}
        />
      )}
    </>
  );
}
