"use client";

import { type CandidateResult, type PreviewResults, type P0Match, type CandidateFeedback } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";

// ── constants ─────────────────────────────────────────────────────────────────

const MATCH_STYLE = {
  pass: { icon: "✅", label: "Pass", cls: "text-green-400", bg: "bg-green-950/30", border: "border-l-green-500" },
  fail: { icon: "❌", label: "Fail", cls: "text-red-400", bg: "bg-red-950/30", border: "border-l-red-500" },
  partial: { icon: "⚠️", label: "Partial", cls: "text-yellow-400", bg: "bg-yellow-950/20", border: "border-l-yellow-500" },
};

const CLASS_STYLE: Record<string, string> = {
  P0: "bg-emerald-900/60 text-emerald-200 border border-emerald-700/50",
  Baseline: "bg-blue-900/60 text-blue-200 border border-blue-700/50",
  Reject: "bg-red-950/60 text-red-300 border border-red-800/50",
};

const SCORE_BAR_COLOR = (score: number) =>
  score >= 75 ? "bg-emerald-500" :
  score >= 50 ? "bg-blue-500" :
  score >= 25 ? "bg-yellow-500" : "bg-red-600";

// ── helpers ───────────────────────────────────────────────────────────────────

/** Truncate a string to a max len, appending "…" if trimmed. */
function truncate(str: string, max = 120): string {
  if (!str || str.length <= max) return str;
  return str.slice(0, max).trimEnd() + "…";
}

/** Render a long text in a compact expandable block. */
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

// ── score ring ────────────────────────────────────────────────────────────────

function ScoreRing({ score }: { score: number }) {
  const color =
    score >= 75 ? "text-emerald-400 stroke-emerald-500" :
    score >= 50 ? "text-blue-400 stroke-blue-500" :
    score >= 25 ? "text-yellow-400 stroke-yellow-500" : "text-red-400 stroke-red-600";
  const r = 14;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <div className="relative flex items-center justify-center w-10 h-10 shrink-0">
      <svg className="absolute inset-0 -rotate-90" width="40" height="40" viewBox="0 0 40 40">
        <circle cx="20" cy="20" r={r} fill="none" stroke="currentColor" strokeWidth="3" className="text-zinc-800" />
        <circle
          cx="20" cy="20" r={r} fill="none" strokeWidth="3"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          className={color}
        />
      </svg>
      <span className={`text-[10px] font-mono font-bold ${color.split(" ")[0]}`}>{score}</span>
    </div>
  );
}

// ── field match row ───────────────────────────────────────────────────────────

function FieldMatchRow({ fm }: { fm: { field: string; value_from_resume: string; criteria_checked: string; match: "pass" | "fail" | "partial"; note: string } }) {
  const m = MATCH_STYLE[fm.match] ?? { icon: "—", label: "—", cls: "text-zinc-400", bg: "bg-zinc-900/40", border: "border-l-zinc-600" };
  const [open, setOpen] = useState(false);

  return (
    <div className={`border-l-2 ${m.border} ${m.bg} rounded-r-md overflow-hidden`}>
      {/* header: field pill + match badge + toggle */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-white/5 transition-colors gap-2"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[10px] font-mono font-semibold uppercase tracking-wider bg-zinc-800/80 text-zinc-300 px-2 py-0.5 rounded shrink-0">
            {fm.field}
          </span>
          <span className={`text-[11px] font-semibold ${m.cls} flex items-center gap-1 shrink-0`}>
            {m.icon} {m.label}
          </span>
          {!open && fm.criteria_checked && (
            <span className="text-[11px] text-zinc-500 truncate min-w-0">
              {truncate(fm.criteria_checked, 60)}
            </span>
          )}
        </div>
        <span className="text-zinc-600 text-[10px] shrink-0">{open ? "▲" : "▼"}</span>
      </button>

      {/* expanded detail */}
      {open && (
        <div className="px-3 pb-3 space-y-2">
          {fm.criteria_checked && (
            <div className="flex gap-2">
              <span className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wide shrink-0 pt-0.5 w-20">Criteria</span>
              <p className="text-xs text-zinc-300 leading-relaxed">
                <ExpandableText text={fm.criteria_checked} maxLen={200} />
              </p>
            </div>
          )}
          {fm.value_from_resume && (
            <div className="flex gap-2">
              <span className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wide shrink-0 pt-0.5 w-20">Resume</span>
              <p className="text-xs text-zinc-400 leading-relaxed">
                <ExpandableText text={fm.value_from_resume} maxLen={200} />
              </p>
            </div>
          )}
          {fm.note && (
            <div className="flex gap-2">
              <span className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wide shrink-0 pt-0.5 w-20">Note</span>
              <p className={`text-xs leading-relaxed italic ${m.cls} opacity-80`}>
                <ExpandableText text={fm.note} maxLen={200} />
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── P0 signal bar ─────────────────────────────────────────────────────────────

function P0Bar({ m, index }: { m: P0Match | string; index: number }) {
  const label = typeof m === "string" ? m : m.signal;
  const score = typeof m === "string" ? 100 : (m.score ?? 0);
  const barColor = SCORE_BAR_COLOR(score);
  const textColor =
    score >= 75 ? "text-emerald-400" :
    score >= 50 ? "text-blue-400" :
    score >= 25 ? "text-yellow-400" : "text-red-400";

  return (
    <div key={index} className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-zinc-300 leading-tight flex-1 min-w-0">
          <ExpandableText text={label} maxLen={80} />
        </span>
        <span className={`text-xs font-mono font-bold shrink-0 ${textColor}`}>
          {score > 0 ? `+${score}` : "—"}
        </span>
      </div>
      <div className="h-1.5 bg-zinc-800/80 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: score > 0 ? `${Math.min(score, 100)}%` : "3px" }}
        />
      </div>
    </div>
  );
}

// ── candidate card ────────────────────────────────────────────────────────────

function CandidateCard({ c, rank, onFeedback }: { c: CandidateResult; rank: number; onFeedback?: (fb: CandidateFeedback) => void }) {
  const [open, setOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackAction, setFeedbackAction] = useState("should_pass");
  const [feedbackReason, setFeedbackReason] = useState("");

  const style = CLASS_STYLE[c.classification] ?? "bg-zinc-800 text-zinc-200 border border-zinc-700";
  const hasFieldMatches = c.field_matches && c.field_matches.length > 0;

  function handleSubmitFeedback(e: React.MouseEvent) {
    e.stopPropagation();
    if (!onFeedback || !feedbackReason.trim()) return;
    onFeedback({ file_name: c.candidate_name, action: feedbackAction, reason: feedbackReason });
    setFeedbackOpen(false);
    setFeedbackReason("");
  }

  return (
    <div className="border border-zinc-800 rounded-xl overflow-hidden shadow-sm">
      {/* card header */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3.5 bg-zinc-900 hover:bg-zinc-800/80 transition-colors text-left gap-3"
      >
        {/* left: rank + name + badges */}
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-[10px] font-mono text-zinc-600 shrink-0">#{rank}</span>
          <span className="font-semibold text-sm text-zinc-100 truncate">{c.candidate_name || "Unknown"}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold shrink-0 ${style}`}>
            {c.classification}
          </span>
          {c.confidence && c.confidence !== "high" && (
            <Badge
              variant="outline"
              className={`text-[9px] h-4 px-1.5 shrink-0 ${c.confidence === "low" ? "border-red-600 text-red-400" : "border-yellow-600 text-yellow-400"}`}
            >
              {c.confidence === "low" ? "⚠️ low" : "~ medium"} confidence
            </Badge>
          )}
          {!c.baseline_pass && (
            <span className="text-[10px] bg-red-950/50 border border-red-800/50 text-red-400 px-1.5 py-0.5 rounded shrink-0">
              Baseline fail
            </span>
          )}
          {onFeedback && (
            <div className="relative isolate z-10">
              <span 
                onClick={(e) => { e.stopPropagation(); setFeedbackOpen(v => !v); }}
                className="text-[10px] uppercase font-semibold text-zinc-500 hover:text-blue-400 hover:underline px-2 py-1 cursor-pointer shrink-0"
              >
                Disagree?
              </span>
            </div>
          )}
        </div>

        {/* right: score ring + p0 score + toggle */}
        <div className="flex items-center gap-4 shrink-0">
          <div className="text-right">
            <div className="text-[10px] text-zinc-500">P0</div>
            <div className="text-xs font-mono font-bold text-zinc-300">{c.p0_score}</div>
          </div>
          <ScoreRing score={c.overall_score} />
          <span className="text-zinc-600 text-xs">{open ? "▲" : "▼"}</span>
        </div>
      </button>

      {/* expanded body */}
      {open && (
        <div className="bg-zinc-950/80 px-4 py-4 space-y-5 border-t border-zinc-800/60">

          {/* Feedback Form UI */}
          {feedbackOpen && (
            <div className="bg-blue-950/20 border border-blue-900/50 rounded-lg p-4 space-y-4 shadow-inner">
              <div>
                <p className="text-xs font-semibold text-blue-300 mb-2">Manual Intervention Required</p>
                <div className="flex gap-2">
                  <select 
                    title="action"
                    className="bg-zinc-950 border border-zinc-800 text-zinc-300 text-xs rounded-md px-2 py-1.5 focus:border-blue-500 focus:outline-none"
                    value={feedbackAction}
                    onChange={(e) => setFeedbackAction(e.target.value)}
                  >
                    <option value="should_pass">This candidate should PASS (they have the required skills)</option>
                    <option value="should_fail">This candidate should FAIL (they have a red flag or lack skills)</option>
                    <option value="p0_booster">This candidate deserves a P0 Boost</option>
                  </select>
                </div>
              </div>
              <div>
                <Textarea
                  placeholder="Explain exactly why. E.g., 'They have 5 years of startup experience which is awesome.' This feedback directly trains the AI's strict baseline rubric."
                  className="bg-zinc-950 border-zinc-800 text-zinc-300 text-xs min-h-[60px]"
                  value={feedbackReason}
                  onChange={(e) => setFeedbackReason(e.target.value)}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="ghost" className="h-7 text-[10px] text-zinc-500 hover:text-zinc-300" onClick={() => setFeedbackOpen(false)}>Cancel</Button>
                <Button className="h-7 text-[10px] bg-blue-600 hover:bg-blue-500 text-white" disabled={!feedbackReason.trim()} onClick={handleSubmitFeedback}>Add to Criteria Loop</Button>
              </div>
            </div>
          )}

          {/* reasoning */}
          {c.reasoning && (
            <div className="flex gap-3">
              <span className="text-zinc-600 mt-0.5 shrink-0">💬</span>
              <p className="text-xs text-zinc-400 leading-relaxed italic">
                <ExpandableText text={c.reasoning} maxLen={300} />
              </p>
            </div>
          )}

          {/* baseline failures */}
          {c.baseline_failures && c.baseline_failures.length > 0 && (
            <div className="bg-red-950/30 border border-red-900/40 rounded-lg p-3 space-y-1">
              <p className="text-[10px] font-semibold text-red-400 uppercase tracking-wider mb-2">⛔ Baseline Failures</p>
              {c.baseline_failures.map((f, i) => (
                <p key={i} className="text-xs text-red-300 leading-relaxed">• <ExpandableText text={f} maxLen={150} /></p>
              ))}
            </div>
          )}

          {/* red flags */}
          {c.red_flags_found && c.red_flags_found.length > 0 && (
            <div className="bg-orange-950/20 border border-orange-900/30 rounded-lg p-3 space-y-1">
              <p className="text-[10px] font-semibold text-orange-400 uppercase tracking-wider mb-2">🚩 Red Flags</p>
              {c.red_flags_found.map((f, i) => (
                <p key={i} className="text-xs text-orange-300 leading-relaxed">• <ExpandableText text={f} maxLen={150} /></p>
              ))}
            </div>
          )}

          {/* P0 signals */}
          {c.p0_matches && c.p0_matches.length > 0 && (
            <div className="space-y-3">
              <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">🎯 P0 Signals</p>
              <div className="space-y-2.5">
                {c.p0_matches.map((m, i) => <P0Bar key={i} m={m} index={i} />)}
              </div>
            </div>
          )}

          {/* extra param matches */}
          {c.extra_param_matches && c.extra_param_matches.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">✨ Extra Parameters Matched</p>
              {c.extra_param_matches.map((m, i) => (
                <p key={i} className="text-xs text-zinc-300">• <ExpandableText text={m} maxLen={120} /></p>
              ))}
            </div>
          )}

          {/* field-level breakdown (preview only) */}
          {hasFieldMatches && (
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

export function FieldMatchTable({ results, onFeedback }: { results: PreviewResults; onFeedback?: (fb: CandidateFeedback) => void }) {
  const { summary, results: candidates } = results;

  if (!candidates || candidates.length === 0) {
    return <p className="text-zinc-500 text-sm">No candidates to display.</p>;
  }

  return (
    <div className="space-y-4">
      {/* summary stat bar */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Evaluated", value: summary.total_evaluated, cls: "text-zinc-100", ring: "border-zinc-700" },
          { label: "P0", value: summary.p0_count, cls: "text-emerald-400", ring: "border-emerald-800" },
          { label: "Baseline", value: summary.baseline_count, cls: "text-blue-400", ring: "border-blue-800" },
          { label: "Reject", value: summary.reject_count, cls: "text-red-400", ring: "border-red-900" },
        ].map(({ label, value, cls, ring }) => (
          <div key={label} className={`bg-zinc-900 border ${ring} rounded-xl p-4 text-center`}>
            <div className={`text-3xl font-bold font-mono ${cls}`}>{value}</div>
            <div className="text-zinc-500 text-xs mt-1 font-medium uppercase tracking-wider">{label}</div>
          </div>
        ))}
      </div>

      {/* ranked candidate list */}
      <div className="space-y-2">
        {candidates.map((c, i) => (
          <CandidateCard key={i} c={c} rank={i + 1} onFeedback={onFeedback} />
        ))}
      </div>
    </div>
  );
}
