"use client";

import { useEffect, useState } from "react";
import { ExternalLink, X, XCircle, Check } from "lucide-react";
import { api, type CandidateResult, type ResumeLens } from "@/lib/api";

const LENS_FIELDS: { key: keyof ResumeLens; label: string }[] = [
  { key: "ownership_arc",      label: "Ownership Arc"      },
  { key: "domain_proximity",   label: "Domain Proximity"   },
  { key: "craft_signals",      label: "Craft Signals"      },
  { key: "experience_profile", label: "Experience Profile" },
  { key: "trajectory",         label: "Trajectory"         },
  { key: "hm_flag",            label: "HM Flag"            },
  { key: "red_flag_notes",     label: "Red Flag Notes"     },
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
  const [pdfBlobUrl, setPdfBlobUrl] = useState("");
  const [pdfError, setPdfError] = useState("");

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let objectUrl = "";
    setPdfBlobUrl("");
    setPdfError("");
    api.resumePdfBlobUrl(sessionId, fileName)
      .then((url) => {
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        objectUrl = url;
        setPdfBlobUrl(url);
      })
      .catch((err) => {
        if (!cancelled) setPdfError((err as Error).message || "Unable to load resume PDF.");
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [fileName, open, sessionId]);

  if (!open) return null;

  const cls = candidate.classification;

  const clsBadge =
    cls === "P0"       ? { cls: "text-emerald-300 border-emerald-500/30",  dot: "bg-emerald-400", bg: "rgba(16,185,129,0.08)" } :
    cls === "Baseline" ? { cls: "text-blue-300 border-blue-500/30",        dot: "bg-blue-400",    bg: "rgba(37,99,235,0.08)"  } :
                         { cls: "text-red-300 border-red-500/20",          dot: "bg-red-400",     bg: "rgba(239,68,68,0.06)"  };

  const lensFields = LENS_FIELDS.filter((f) => resumeLens?.[f.key]);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 backdrop-blur-sm"
        style={{ background: "rgba(2,9,23,0.75)" }}
        onClick={onClose}
      />

      {/* Drawer panel */}
      <div
        className="fixed right-0 top-0 h-screen w-full max-w-2xl z-50 flex flex-col shadow-2xl"
        style={{
          background: "linear-gradient(160deg, rgba(4,12,32,0.99) 0%, rgba(8,20,52,0.99) 100%)",
          borderLeft: "1px solid rgba(96,165,250,0.12)",
        }}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4" style={{ borderBottom: "1px solid rgba(96,165,250,0.1)" }}>
          <div className="min-w-0 space-y-2 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-bold text-white text-base truncate">{candidate.candidate_name || fileName}</h2>
              <span
                className={`text-xs px-2.5 py-0.5 rounded-full font-semibold shrink-0 flex items-center gap-1.5 border ${clsBadge.cls}`}
                style={{ background: clsBadge.bg }}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${clsBadge.dot}`} />
                {cls}
              </span>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              {candidate.overall_score !== undefined && (
                <span className="text-xs text-[#4a6080]">
                  Score: <span className="text-blue-400 font-mono font-semibold">{candidate.overall_score}</span>
                </span>
              )}
              {candidate.p0_score !== undefined && (
                <span className="text-xs text-[#4a6080]">
                  P0: <span className="text-emerald-400 font-mono font-semibold">{candidate.p0_score}</span>
                </span>
              )}
              {candidate.confidence && candidate.confidence !== "high" && (
                <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
                  candidate.confidence === "low" ? "border-red-500/30 text-red-400" : "border-amber-500/30 text-amber-400"
                }`}>
                  {candidate.confidence} confidence
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 ml-3 shrink-0">
            <button
              type="button"
              disabled={!pdfBlobUrl}
              onClick={() => pdfBlobUrl && window.open(pdfBlobUrl, "_blank", "noopener,noreferrer")}
              className="nh-btn-ghost flex items-center gap-1.5 text-xs px-3 py-1.5"
            >
              <ExternalLink size={13} /> Open PDF
            </button>
            <button
              onClick={onClose}
              className="nh-btn-ghost w-8 h-8 flex items-center justify-center text-sm"
            >
              <X size={13} />
            </button>
          </div>
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto">

          {/* PDF embed */}
          <div style={{ borderBottom: "1px solid rgba(96,165,250,0.07)" }}>
            {pdfBlobUrl ? (
              <iframe
                src={pdfBlobUrl}
                className="w-full h-96"
                title={`Resume: ${fileName}`}
              />
            ) : (
              <div className="flex h-96 items-center justify-center p-6 text-center text-sm text-[#8ea2c5]">
                {pdfError || "Loading resume PDF..."}
              </div>
            )}
          </div>

          <div className="p-5 space-y-5">

            {/* AI Resume Lens */}
            {lensFields.length > 0 && (
              <div className="space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-blue-400/70">AI Resume Lens</p>
                <div className="space-y-2">
                  {lensFields.map(({ key, label }) => {
                    const value = resumeLens?.[key];
                    if (!value) return null;
                    const isFlag = key === "hm_flag" || key === "red_flag_notes";
                    return (
                      <div
                        key={key}
                        className="nh-inset rounded-xl p-3 space-y-1"
                        style={isFlag ? { borderColor: "rgba(249,115,22,0.2)" } : {}}
                      >
                        <p className={`text-[10px] font-semibold uppercase tracking-wider ${isFlag ? "text-orange-400/80" : "text-[#3a5080]"}`}>
                          {label}
                        </p>
                        <p className="text-xs text-[#c8d8f0] leading-relaxed">{String(value)}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* AI Reasoning */}
            {candidate.reasoning && (
              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#3a5080]">AI Reasoning</p>
                <div className="nh-inset rounded-xl p-3">
                  <p className="text-xs text-[#a8b8d8] italic leading-relaxed">{String(candidate.reasoning)}</p>
                </div>
              </div>
            )}

            {/* Baseline failures */}
            {candidate.baseline_failures && candidate.baseline_failures.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-red-400/70">Baseline Failures</p>
                <div className="space-y-1.5">
                  {candidate.baseline_failures.map((f, i) => (
                    <div
                      key={i}
                      className="flex gap-2 text-xs rounded-lg px-3 py-2"
                      style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)" }}
                    >
                      <XCircle size={11} className="text-red-400 shrink-0" />
                      <span className="text-red-300 leading-relaxed">{String(f)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Red flags */}
            {candidate.red_flags_found && candidate.red_flags_found.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-orange-400/70">Red Flags</p>
                <div className="space-y-1.5">
                  {candidate.red_flags_found.map((f, i) => (
                    <div
                      key={i}
                      className="flex gap-2 text-xs rounded-lg px-3 py-2"
                      style={{ background: "rgba(249,115,22,0.04)", border: "1px solid rgba(249,115,22,0.15)" }}
                    >
                      <span className="w-1 h-1 rounded-full bg-orange-400 shrink-0 mt-1.5" />
                      <span className="text-orange-300 leading-relaxed">{String(f)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Field matches */}
            {candidate.field_matches && candidate.field_matches.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#3a5080]">Field-Level Breakdown</p>
                <div className="space-y-1.5">
                  {candidate.field_matches.map((fm, i) => {
                    const match = fm.match as "pass" | "fail" | "partial";
                    const style = {
                      pass:    { icon: <Check size={10} className="text-emerald-400" />, cls: "text-emerald-400", borderColor: "rgba(16,185,129,0.5)",  bg: "rgba(16,185,129,0.04)"  },
                      fail:    { icon: <XCircle size={10} className="text-red-400" />,   cls: "text-red-400",     borderColor: "rgba(239,68,68,0.5)",   bg: "rgba(239,68,68,0.04)"   },
                      partial: { icon: <span className="text-amber-400 text-[10px] font-bold">~</span>, cls: "text-amber-400",   borderColor: "rgba(245,158,11,0.5)",  bg: "rgba(245,158,11,0.04)"  },
                    }[match] ?? { icon: "—", cls: "text-[#6c80a8]", borderColor: "rgba(96,165,250,0.2)", bg: "transparent" };

                    return (
                      <div key={i} className="border-l-2 rounded-r-lg px-3 py-2"
                        style={{ borderLeftColor: style.borderColor, background: style.bg }}>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-mono font-semibold uppercase text-[#c8d8f0] px-1.5 py-0.5 rounded"
                            style={{ background: "rgba(96,165,250,0.08)", border: "1px solid rgba(96,165,250,0.15)" }}>
                            {String(fm.field)}
                          </span>
                          <span className={`text-[11px] font-bold ${style.cls}`}>{style.icon} {match}</span>
                        </div>
                        {fm.note && (
                          <p className={`text-[11px] mt-1 leading-relaxed italic ${style.cls} opacity-75`}>
                            {String(fm.note)}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
