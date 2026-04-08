"use client";

import { type CandidateResult, type PreviewResults, type P0Match, type CandidateFeedback, type ResumeListItem, type ResumeLens } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useState, useMemo } from "react";
import { ResumeDrawer } from "@/components/resume-drawer";

// ── constants ─────────────────────────────────────────────────────────────────

const MATCH_STYLE = {
  pass:    { icon: "✅", label: "Pass",    cls: "text-green-400",  bg: "bg-green-950/30",  border: "border-l-green-500"  },
  fail:    { icon: "❌", label: "Fail",    cls: "text-red-400",    bg: "bg-red-950/30",    border: "border-l-red-500"    },
  partial: { icon: "⚠️", label: "Partial", cls: "text-yellow-400", bg: "bg-yellow-950/20", border: "border-l-yellow-500" },
};

const CLASS_STYLE: Record<string, string> = {
  P0:       "bg-emerald-900/60 text-emerald-200 border border-emerald-700/50",
  Baseline: "bg-blue-900/60 text-blue-200 border border-blue-700/50",
  Reject:   "bg-red-950/60 text-red-300 border border-red-800/50",
};

// ── helpers ───────────────────────────────────────────────────────────────────

/**
 * Safely coerce any value to a plain string.
 * Gemini occasionally returns structured objects (e.g. {signal: "...", evidence_fields: [...]})
 * instead of plain strings. This prevents React "Objects are not valid as a React child" crashes.
 */
function toStr(val: unknown): string {
  if (typeof val === "string") return val;
  if (val === null || val === undefined) return "";
  if (typeof val === "object") {
    const obj = val as Record<string, unknown>;
    // Try common field names in order of preference
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
          className="ml-1 text-zinc-500 hover:text-zinc-300 underline text-[10px] shrink-0"
        >
          {expanded ? "less" : "more"}
        </button>
      )}
    </span>
  );
}

// ── field match row ───────────────────────────────────────────────────────────

function FieldMatchRow({ fm }: { fm: { field: unknown; value_from_resume: unknown; criteria_checked: unknown; match: "pass" | "fail" | "partial"; note: unknown } }) {
  const m = MATCH_STYLE[fm.match] ?? { icon: "—", label: "—", cls: "text-zinc-400", bg: "bg-zinc-900/40", border: "border-l-zinc-600" };
  const [open, setOpen] = useState(false);

  const field = toStr(fm.field);
  const criteriaChecked = toStr(fm.criteria_checked);
  const valueFromResume = toStr(fm.value_from_resume);
  const note = toStr(fm.note);

  return (
    <div className={`border-l-2 ${m.border} ${m.bg} rounded-r-md overflow-hidden`}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-white/5 transition-colors gap-2"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[10px] font-mono font-semibold uppercase tracking-wider bg-zinc-800/80 text-zinc-300 px-2 py-0.5 rounded shrink-0">
            {field}
          </span>
          <span className={`text-[11px] font-semibold ${m.cls} flex items-center gap-1 shrink-0`}>
            {m.icon} {m.label}
          </span>
          {!open && criteriaChecked && (
            <span className="text-[11px] text-zinc-500 truncate min-w-0">
              {truncate(criteriaChecked, 60)}
            </span>
          )}
        </div>
        <span className="text-zinc-600 text-[10px] shrink-0">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-2">
          {criteriaChecked && (
            <div className="flex gap-2">
              <span className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wide shrink-0 pt-0.5 w-20">Criteria</span>
              <p className="text-xs text-zinc-300 leading-relaxed"><ExpandableText text={criteriaChecked} maxLen={200} /></p>
            </div>
          )}
          {valueFromResume && (
            <div className="flex gap-2">
              <span className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wide shrink-0 pt-0.5 w-20">Resume</span>
              <p className="text-xs text-zinc-400 leading-relaxed"><ExpandableText text={valueFromResume} maxLen={200} /></p>
            </div>
          )}
          {note && (
            <div className="flex gap-2">
              <span className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wide shrink-0 pt-0.5 w-20">Note</span>
              <p className={`text-xs leading-relaxed italic ${m.cls} opacity-80`}><ExpandableText text={note} maxLen={200} /></p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── P0 signal list (label only, no scores) ────────────────────────────────────

function P0Signal({ m }: { m: P0Match | string | unknown }) {
  const label = toStr(typeof m === "object" && m !== null && "signal" in (m as object) ? (m as P0Match).signal : m as string);
  return (
    <div className="flex items-start gap-2 text-xs">
      <span className="text-emerald-500 shrink-0 mt-0.5">✦</span>
      <span className="text-zinc-300 leading-relaxed"><ExpandableText text={label} maxLen={120} /></span>
    </div>
  );
}

// ── candidate card ────────────────────────────────────────────────────────────

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

  const style = CLASS_STYLE[c.classification] ?? "bg-zinc-800 text-zinc-200 border border-zinc-700";

  function handleSubmitFeedback(e: React.MouseEvent) {
    e.stopPropagation();
    if (!onFeedback || !feedbackReason.trim()) return;
    onFeedback({ file_name: c.candidate_name, action: feedbackAction, reason: feedbackReason });
    setFeedbackOpen(false);
    setFeedbackReason("");
    setFeedbackSubmitted(true);
  }

  return (
    <div className="border border-zinc-800 rounded-xl overflow-hidden shadow-sm">
      {/* card header — div so nested buttons work */}
      <div
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3.5 bg-zinc-900 hover:bg-zinc-800/80 transition-colors cursor-pointer gap-3 select-none"
      >
        {/* left: rank · name · classification · badges */}
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          <span className="text-[10px] font-mono text-zinc-600 shrink-0">#{rank}</span>

          <span className="font-semibold text-sm text-zinc-100 truncate">{c.candidate_name || "Unknown"}</span>

          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold shrink-0 ${style}`}>
            {c.classification}
          </span>

          {c.confidence && c.confidence !== "high" && (
            <Badge variant="outline" className={`text-[9px] h-4 px-1.5 shrink-0 ${c.confidence === "low" ? "border-red-600 text-red-400" : "border-yellow-600 text-yellow-400"}`}>
              {c.confidence === "low" ? "⚠️ low" : "~ mid"} confidence
            </Badge>
          )}

          {!c.baseline_pass && (
            <span className="text-[10px] bg-red-950/50 border border-red-800/50 text-red-400 px-1.5 py-0.5 rounded shrink-0">
              Baseline fail
            </span>
          )}

          {/* View Resume button */}
          {onViewResume && (
            <button
              onClick={(e) => { e.stopPropagation(); onViewResume(c); }}
              className="flex items-center gap-1 text-[10px] font-semibold bg-zinc-800 hover:bg-blue-900/60 text-zinc-400 hover:text-blue-300 border border-zinc-700 hover:border-blue-700 px-2 py-0.5 rounded transition-colors shrink-0"
              title="View resume PDF"
            >
              📄 Resume
            </button>
          )}

          {/* Disagree button */}
          {onFeedback && (
            <button
              onClick={(e) => { e.stopPropagation(); setFeedbackOpen(v => !v); }}
              className={`text-[10px] font-semibold px-2 py-0.5 rounded border transition-colors shrink-0 ${
                feedbackSubmitted
                  ? "bg-green-950/40 border-green-800/50 text-green-400"
                  : "bg-zinc-800 hover:bg-orange-900/40 text-zinc-500 hover:text-orange-300 border-zinc-700 hover:border-orange-700"
              }`}
              title="Disagree with this evaluation"
            >
              {feedbackSubmitted ? "✓ Feedback sent" : "👎 Disagree"}
            </button>
          )}
        </div>

        <span className="text-zinc-600 text-xs shrink-0">{open ? "▲" : "▼"}</span>
      </div>

      {/* expanded body */}
      {open && (
        <div className="bg-zinc-950/80 px-4 py-4 space-y-5 border-t border-zinc-800/60">

          {/* feedback form */}
          {feedbackOpen && (
            <div className="bg-blue-950/20 border border-blue-900/50 rounded-lg p-4 space-y-3 shadow-inner">
              <p className="text-xs font-semibold text-blue-300">
                Tell the AI what it got wrong — this updates the rubric and immediately re-evaluates.
              </p>
              <select
                title="action"
                className="w-full bg-zinc-950 border border-zinc-800 text-zinc-300 text-xs rounded-md px-2 py-1.5 focus:border-blue-500 focus:outline-none"
                value={feedbackAction}
                onChange={(e) => setFeedbackAction(e.target.value)}
              >
                <option value="should_pass">Should PASS — they have what's needed</option>
                <option value="should_fail">Should FAIL — they have a red flag or lack skills</option>
                <option value="p0_booster">Deserves a P0 boost</option>
              </select>
              <Textarea
                placeholder="Explain why, e.g. 'They have 3 years B2B SaaS experience which is exactly what we need.' This directly updates the AI rubric for all candidates."
                className="bg-zinc-950 border-zinc-800 text-zinc-300 text-xs min-h-[70px] resize-none"
                value={feedbackReason}
                onChange={(e) => setFeedbackReason(e.target.value)}
              />
              <div className="flex gap-2 justify-end">
                <Button variant="ghost" className="h-7 text-[10px] text-zinc-500 hover:text-zinc-300" onClick={(e) => { e.stopPropagation(); setFeedbackOpen(false); }}>
                  Cancel
                </Button>
                <Button
                  className="h-7 text-[10px] bg-blue-600 hover:bg-blue-500 text-white"
                  disabled={!feedbackReason.trim()}
                  onClick={handleSubmitFeedback}
                >
                  Submit & Re-evaluate
                </Button>
              </div>
            </div>
          )}

          {/* reasoning */}
          {c.reasoning && (
            <div className="flex gap-3">
              <span className="text-zinc-600 mt-0.5 shrink-0">💬</span>
              <p className="text-xs text-zinc-400 leading-relaxed italic">
                <ExpandableText text={toStr(c.reasoning)} maxLen={300} />
              </p>
            </div>
          )}

          {/* baseline failures */}
          {c.baseline_failures && c.baseline_failures.length > 0 && (
            <div className="bg-red-950/30 border border-red-900/40 rounded-lg p-3 space-y-1">
              <p className="text-[10px] font-semibold text-red-400 uppercase tracking-wider mb-2">⛔ Baseline Failures</p>
              {c.baseline_failures.map((f, i) => (
                <p key={i} className="text-xs text-red-300 leading-relaxed">• <ExpandableText text={toStr(f)} maxLen={150} /></p>
              ))}
            </div>
          )}

          {/* red flags */}
          {c.red_flags_found && c.red_flags_found.length > 0 && (
            <div className="bg-orange-950/20 border border-orange-900/30 rounded-lg p-3 space-y-1">
              <p className="text-[10px] font-semibold text-orange-400 uppercase tracking-wider mb-2">🚩 Red Flags</p>
              {c.red_flags_found.map((f, i) => (
                <p key={i} className="text-xs text-orange-300 leading-relaxed">• <ExpandableText text={toStr(f)} maxLen={150} /></p>
              ))}
            </div>
          )}

          {/* P0 signals matched */}
          {c.p0_matches && c.p0_matches.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">🎯 P0 Signals Matched</p>
              <div className="space-y-1.5">
                {c.p0_matches.map((m, i) => <P0Signal key={i} m={m} />)}
              </div>
            </div>
          )}

          {/* extra param matches */}
          {c.extra_param_matches && c.extra_param_matches.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">✨ Extra Parameters Matched</p>
              {c.extra_param_matches.map((m, i) => (
                <p key={i} className="text-xs text-zinc-300">• <ExpandableText text={toStr(m)} maxLen={120} /></p>
              ))}
            </div>
          )}

          {/* field-level breakdown */}
          {c.field_matches && c.field_matches.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">📋 Field-Level Breakdown</p>
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

// ── main export ───────────────────────────────────────────────────────────────

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

  // Windowed rendering — at 600 candidates, a single DOM flush of fully expanded
  // cards freezes the browser. Render in chunks of 50 with a "Show more" button.
  const WINDOW_STEP = 50;
  const [visibleCount, setVisibleCount] = useState(WINDOW_STEP);

  // name → file_name lookup
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

  // Wrap onFeedback so that file_name is always the *actual* resolved filename,
  // not the candidate_name string that CandidateCard has access to.
  // CandidateCard passes c.candidate_name as file_name — this wrapper intercepts
  // that and replaces it with the correctly resolved file path.
  function makeFeedbackHandler(candidateName: string) {
    if (!onFeedback) return undefined;
    return (fb: CandidateFeedback) => {
      const resolvedFileName = resolveFileName(candidateName);
      onFeedback({ ...fb, file_name: resolvedFileName });
    };
  }

  if (!candidates || candidates.length === 0) {
    return <p className="text-zinc-500 text-sm">No candidates to display.</p>;
  }

  // Detect all-reject batches so we can surface a clear message instead of
  // leaving the recruiter confused about why there are 0 P0s and 0 Baselines.
  const allReject = summary.p0_count === 0 && summary.baseline_count === 0 && summary.reject_count > 0;

  return (
    <>
      <div className="space-y-4">
        {/* summary counts */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Evaluated", value: summary.total_evaluated, cls: "text-zinc-100",    ring: "border-zinc-700"    },
            { label: "P0",        value: summary.p0_count,        cls: "text-emerald-400", ring: "border-emerald-800" },
            { label: "Baseline",  value: summary.baseline_count,  cls: "text-blue-400",    ring: "border-blue-800"    },
            { label: "Reject",    value: summary.reject_count,    cls: "text-red-400",     ring: "border-red-900"     },
          ].map(({ label, value, cls, ring }) => (
            <div key={label} className={`bg-zinc-900 border ${ring} rounded-xl p-4 text-center`}>
              <div className={`text-3xl font-bold font-mono ${cls}`}>{value}</div>
              <div className="text-zinc-500 text-xs mt-1 font-medium uppercase tracking-wider">{label}</div>
            </div>
          ))}
        </div>

        {/* all-reject message: helps the recruiter understand this is correct, not a bug */}
        {allReject && (
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 flex items-start gap-3">
            <span className="text-zinc-500 shrink-0 mt-0.5">ℹ️</span>
            <div className="space-y-0.5">
              <p className="text-xs font-semibold text-zinc-300">None of these candidates meet the baseline</p>
              <p className="text-xs text-zinc-500 leading-relaxed">
                The AI is applying your criteria as absolute thresholds — not picking the best from this batch.
                Try uploading stronger candidates, or use the include/exclude fields to relax a criterion
                that may be filtering too aggressively.
              </p>
            </div>
          </div>
        )}

        {/* candidate list — windowed to avoid freezing the browser on 600+ results */}
        <div className="space-y-2">
          {candidates.slice(0, visibleCount).map((c, i) => (
            <CandidateCard
              key={i}
              c={c}
              rank={i + 1}
              onFeedback={makeFeedbackHandler(c.candidate_name || "")}
              onViewResume={sessionId ? handleViewResume : undefined}
            />
          ))}
          {visibleCount < candidates.length && (
            <div className="flex items-center justify-center pt-4">
              <button
                onClick={() => setVisibleCount((n) => Math.min(n + WINDOW_STEP, candidates.length))}
                className="text-xs text-zinc-400 hover:text-zinc-200 border border-zinc-700 rounded px-4 py-2"
              >
                Show {Math.min(WINDOW_STEP, candidates.length - visibleCount)} more
                ({visibleCount}/{candidates.length} shown)
              </button>
            </div>
          )}
        </div>
      </div>

      {/* resume drawer — rendered outside the list so it overlays everything */}
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
