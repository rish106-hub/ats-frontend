"use client";

import { useEffect } from "react";
import { type CandidateResult, type ResumeLens } from "@/lib/api";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const LENS_FIELDS: { key: keyof ResumeLens; label: string; icon: string }[] = [
  { key: "ownership_arc",     label: "Ownership Arc",      icon: "🏗️" },
  { key: "domain_proximity",  label: "Domain Proximity",   icon: "🎯" },
  { key: "craft_signals",     label: "Craft Signals",      icon: "⚙️" },
  { key: "experience_profile",label: "Experience Profile", icon: "📅" },
  { key: "trajectory",        label: "Trajectory",         icon: "📈" },
  { key: "hm_flag",           label: "HM Flag",            icon: "🚩" },
  { key: "red_flag_notes",    label: "Red Flag Notes",     icon: "⚠️" },
];

interface ResumeDrawerProps {
  open: boolean;
  onClose: () => void;
  sessionId: string;
  fileName: string;
  candidate: CandidateResult;
  resumeLens: ResumeLens | null;
}

export function ResumeDrawer({ open, onClose, sessionId, fileName, candidate, resumeLens }: ResumeDrawerProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  const pdfUrl = `${BASE}/api/sessions/${sessionId}/resumes/${encodeURIComponent(fileName)}/pdf`;
  const cls = candidate.classification;
  const clsStyle =
    cls === "P0"       ? "bg-emerald-900/60 text-emerald-200 border border-emerald-700/50" :
    cls === "Baseline" ? "bg-blue-900/60 text-blue-200 border border-blue-700/50" :
                         "bg-red-950/60 text-red-300 border border-red-800/50";

  return (
    <>
      {/* backdrop */}
      <div
        className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* drawer panel */}
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-5xl shadow-2xl">
        {/* left: PDF viewer */}
        <div className="flex-1 bg-zinc-950 flex flex-col border-l border-zinc-800">
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 shrink-0">
            <span className="text-xs font-semibold text-zinc-300 truncate">{fileName}</span>
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-blue-400 hover:text-blue-300 underline shrink-0 ml-3"
            >
              open ↗
            </a>
          </div>
          <iframe
            src={pdfUrl}
            className="flex-1 w-full"
            title={`Resume — ${candidate.candidate_name}`}
          />
        </div>

        {/* right: recruiter lens notes */}
        <div className="w-80 shrink-0 bg-zinc-900 border-l border-zinc-800 flex flex-col overflow-hidden">
          {/* header */}
          <div className="px-4 py-3 border-b border-zinc-800 space-y-1 shrink-0">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-sm text-zinc-100 truncate">
                {candidate.candidate_name || "Unknown"}
              </span>
              <button
                onClick={onClose}
                className="text-zinc-500 hover:text-zinc-300 text-lg leading-none shrink-0"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold inline-block ${clsStyle}`}>
              {cls}
            </span>
          </div>

          {/* lens notes */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {resumeLens ? (
              LENS_FIELDS.map(({ key, label, icon }) => {
                const val = resumeLens[key];
                if (!val) return null;
                return (
                  <div key={key} className="space-y-1">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                      {icon} {label}
                    </p>
                    <p className="text-xs text-zinc-300 leading-relaxed">{val}</p>
                  </div>
                );
              })
            ) : (
              <p className="text-xs text-zinc-600 italic">
                No recruiter lens notes yet — run the preview to generate them.
              </p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
