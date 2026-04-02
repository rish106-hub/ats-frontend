"use client";

import { useEffect } from "react";
import { type ResumeLens, type CandidateResult } from "@/lib/api";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ── constants ─────────────────────────────────────────────────────────────────

const CLASS_STYLE: Record<string, string> = {
  P0: "bg-emerald-900/60 text-emerald-200 border border-emerald-700/50",
  Baseline: "bg-blue-900/60 text-blue-200 border border-blue-700/50",
  Reject: "bg-red-950/60 text-red-300 border border-red-800/50",
};

const LENS_FIELDS: { key: keyof ResumeLens; label: string; icon: string }[] = [
  { key: "ownership_arc",      label: "Ownership Arc",      icon: "🎯" },
  { key: "domain_proximity",   label: "Domain Proximity",   icon: "🌐" },
  { key: "craft_signals",      label: "Craft Signals",      icon: "🔧" },
  { key: "experience_profile", label: "Experience Profile", icon: "📋" },
  { key: "trajectory",         label: "Trajectory",         icon: "📈" },
  { key: "hm_flag",            label: "HM Flag",            icon: "🚩" },
  { key: "red_flag_notes",     label: "Red Flags",          icon: "⚠️" },
];

// ── resume drawer ─────────────────────────────────────────────────────────────

interface ResumeDrawerProps {
  open: boolean;
  onClose: () => void;
  sessionId: string;
  fileName: string;
  candidate: CandidateResult;
  resumeLens?: ResumeLens | null;
}

export function ResumeDrawer({
  open,
  onClose,
  sessionId,
  fileName,
  candidate,
  resumeLens,
}: ResumeDrawerProps) {
  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  const pdfUrl = `${BASE}/api/sessions/${sessionId}/resumes/${encodeURIComponent(fileName)}/pdf`;
  const style = CLASS_STYLE[candidate.classification] ?? "bg-zinc-800 text-zinc-200 border border-zinc-700";
  const score = candidate.overall_score ?? 0;
  const scoreColor =
    score >= 75 ? "text-emerald-400" :
    score >= 50 ? "text-blue-400" :
    score >= 25 ? "text-yellow-400" : "text-red-400";

  return (
    <>
      {/* backdrop */}
      <div
        className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* drawer panel */}
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-5xl flex flex-col bg-zinc-950 border-l border-zinc-800 shadow-2xl">

        {/* header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <span className="font-semibold text-zinc-100 text-base truncate">
              {candidate.candidate_name || "Unknown"}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold shrink-0 ${style}`}>
              {candidate.classification}
            </span>
            <span className={`text-sm font-mono font-bold shrink-0 ${scoreColor}`}>
              {score}
            </span>
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-[10px] text-zinc-500 hover:text-blue-400 underline font-mono hidden sm:block shrink-0"
            >
              open PDF ↗
            </a>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-200 transition-colors text-xl leading-none shrink-0 ml-4"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* body — two-panel layout */}
        <div className="flex-1 flex overflow-hidden min-h-0">

          {/* LEFT — actual PDF */}
          <div className="flex-1 flex flex-col border-r border-zinc-800 min-w-0">
            <div className="px-5 py-3 border-b border-zinc-800 bg-zinc-900/50 shrink-0">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
                Resume PDF
              </span>
            </div>
            <div className="flex-1 min-h-0">
              <iframe
                src={pdfUrl}
                className="w-full h-full border-0 bg-white"
                title={`Resume — ${candidate.candidate_name}`}
              />
            </div>
          </div>

          {/* RIGHT — recruiter lens notes */}
          <div className="w-80 xl:w-96 flex flex-col shrink-0">
            <div className="px-5 py-3 border-b border-zinc-800 bg-zinc-900/50 shrink-0">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
                Recruiter Lens
              </span>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {resumeLens ? (
                LENS_FIELDS.map(({ key, label, icon }) => (
                  <div key={key} className="space-y-1">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
                      <span>{icon}</span>
                      {label}
                    </p>
                    <p className="text-xs text-zinc-300 leading-relaxed bg-zinc-900/60 rounded-lg px-3 py-2 border border-zinc-800/60">
                      {resumeLens[key] || (
                        <span className="text-zinc-600 italic">Not noted</span>
                      )}
                    </p>
                  </div>
                ))
              ) : (
                <div className="text-zinc-600 text-xs italic mt-2">
                  Lens notes not yet available. Run preview to generate them.
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
