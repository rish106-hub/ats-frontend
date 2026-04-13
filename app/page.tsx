"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { api, type Session } from "@/lib/api";
import {
  Plus, Clock, ChevronRight, Sparkles,
  AlertCircle, Trash2, X, AlertTriangle, TrendingUp,
} from "lucide-react";

/* ── Status config ──────────────────────────────────────────────────── */
type StatusCfg = { label: string; color: string; pulse: boolean; group: string };
const STATUS: Record<string, StatusCfg> = {
  created:           { label: "Empty",         color: "#64748b", pulse: false, group: "empty"    },
  jd_analyzed:       { label: "JD Done",       color: "#06b6d4", pulse: false, group: "progress" },
  resumes_uploaded:  { label: "Resumes Ready", color: "#8b5cf6", pulse: false, group: "progress" },
  rubric_ready:      { label: "Rubric Ready",  color: "#8b5cf6", pulse: false, group: "progress" },
  preview_active:    { label: "Previewing",    color: "#4f6ef7", pulse: true,  group: "active"   },
  running_full_eval: { label: "Evaluating",    color: "#4f6ef7", pulse: true,  group: "active"   },
  completed:         { label: "Complete",      color: "#10b981", pulse: false, group: "done"     },
};

const GROUP_ORDER = ["active", "progress", "done", "empty"];
const GROUP_LABELS: Record<string, string> = {
  active: "Live", progress: "In Progress", done: "Completed", empty: "New",
};

/* ── Confirm delete modal ───────────────────────────────────────────── */
function ConfirmDelete({ name, onConfirm, onCancel, deleting }: {
  name: string; onConfirm: () => void; onCancel: () => void; deleting: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div
        className="absolute inset-0 backdrop-blur-sm"
        style={{ background: "rgba(2,9,23,0.85)" }}
        onClick={onCancel}
      />
      <div
        className="relative rounded-2xl p-8 max-w-sm w-full space-y-6 nh-scale-in"
        style={{ background: "rgba(5,11,30,0.98)", border: "1px solid rgba(239,68,68,0.2)" }}
      >
        <button
          onClick={onCancel}
          className="absolute top-5 right-5 text-[#3a5080] hover:text-[#6c80a8] transition-colors"
        >
          <X size={14} />
        </button>
        <div className="space-y-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.18)" }}
          >
            <AlertTriangle size={16} className="text-red-400" />
          </div>
          <div>
            <h3 className="text-white font-semibold text-sm">Delete this session?</h3>
            <p className="text-[#566b99] text-xs leading-relaxed mt-1">
              <span className="text-[#8899b8]">{name}</span> and all its data will be permanently removed.
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 text-sm text-[#566b99] rounded-xl border transition-colors hover:text-[#8899b8]"
            style={{ borderColor: "rgba(96,165,250,0.12)", background: "rgba(96,165,250,0.03)" }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            className="flex-1 py-2.5 text-sm font-medium rounded-xl flex items-center justify-center gap-2 transition-all"
            style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", color: "#f87171" }}
          >
            {deleting
              ? <span className="w-4 h-4 rounded-full border-2 border-red-400/20 border-t-red-400 animate-spin" />
              : <><Trash2 size={12} /> Delete</>}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Skeleton loader ────────────────────────────────────────────────── */
function Skeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map(i => (
        <div key={i} className="h-[72px] rounded-2xl nh-shimmer" style={{ opacity: 1 - i * 0.2 }} />
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   HOME PAGE
══════════════════════════════════════════════════════════════════════ */
export default function HomePage() {
  const router = useRouter();
  const [sessions, setSessions]           = useState<Session[]>([]);
  const [loading, setLoading]             = useState(true);
  const [creating, setCreating]           = useState(false);
  const [error, setError]                 = useState("");
  const [serverOk, setServerOk]           = useState<boolean | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Session | null>(null);
  const [deleting, setDeleting]           = useState(false);

  useEffect(() => {
    api.listSessions()
      .then(d => { setSessions(d); setServerOk(true); })
      .catch(() => { setError("Backend unreachable — start it on port 8000."); setServerOk(false); })
      .finally(() => setLoading(false));
  }, []);

  async function createNew() {
    setCreating(true);
    try {
      const s = await api.createSession();
      router.push(`/sessions/${s.id}`);
    } catch {
      setError("Failed to create session.");
      setCreating(false);
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await api.deleteSession(pendingDelete.id);
      setSessions(p => p.filter(s => s.id !== pendingDelete.id));
    } catch {
      setError("Delete failed — try again.");
    } finally {
      setDeleting(false);
      setPendingDelete(null);
    }
  }

  const grouped = GROUP_ORDER.reduce<Record<string, Session[]>>((acc, g) => {
    acc[g] = sessions.filter(s => (STATUS[s.status]?.group ?? "empty") === g);
    return acc;
  }, {});

  const active    = grouped.active?.length ?? 0;
  const completed = grouped.done?.length ?? 0;
  const total     = sessions.length;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#020912" }}>

      {/* ── Nav ─────────────────────────────────────────────────────── */}
      <nav
        className="sticky top-0 z-50 border-b"
        style={{ borderColor: "rgba(79,110,247,0.08)", background: "rgba(2,9,18,0.92)", backdropFilter: "blur(20px)" }}
      >
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className="w-6 h-6 rounded-lg flex items-center justify-center"
              style={{ background: "linear-gradient(135deg,#4f6ef7,#06b6d4)" }}
            >
              <Sparkles size={11} className="text-white" />
            </div>
            <span className="font-bold text-white text-sm tracking-tight">NextHire</span>
          </div>

          <div className="flex items-center gap-4">
            {serverOk !== null && (
              <div className="flex items-center gap-1.5">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${serverOk ? "bg-emerald-400" : "bg-red-400"}`}
                  style={serverOk ? { boxShadow: "0 0 5px rgba(16,185,129,0.7)" } : {}}
                />
                <span className="text-[#566b99] text-[11px] hidden sm:block">
                  {serverOk ? "Connected" : "Offline"}
                </span>
              </div>
            )}
            <button
              onClick={createNew}
              disabled={creating}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white transition-all disabled:opacity-60"
              style={{ background: "linear-gradient(135deg,#4f6ef7,#3b57db)", boxShadow: "0 0 20px rgba(79,110,247,0.25)" }}
            >
              {creating
                ? <span className="w-3 h-3 rounded-full border border-white/30 border-t-white animate-spin" />
                : <Plus size={12} />}
              New Session
            </button>
          </div>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────────── */}
      <section className="max-w-4xl mx-auto w-full px-6 pt-12 pb-10">
        <div className="flex items-center justify-between gap-8 nh-fade-up">

          {/* Left: text + CTA */}
          <div className="space-y-6 flex-1 min-w-0">
            <div className="space-y-3 max-w-xl">
              <h1 className="text-4xl sm:text-5xl font-black tracking-tight leading-[1.08] text-white">
                Stop guessing.<br />
                <span style={{
                  background: "linear-gradient(90deg,#4f6ef7,#06b6d4)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}>
                  Start scoring.
                </span>
              </h1>
              <p className="text-[#566b99] text-base leading-relaxed">
                AI screening that scores every resume against a structured rubric — objective, iterative, and bias-free.
              </p>
            </div>

            <div className="flex items-center gap-5">
              <button
                onClick={createNew}
                disabled={creating}
                className="nh-btn-primary flex items-center gap-2 px-6 py-3 text-sm"
              >
                {creating
                  ? <span className="w-4 h-4 rounded-full border-2 border-white/20 border-t-white animate-spin" />
                  : <Plus size={14} />}
                {creating ? "Creating…" : "New Screening Session"}
              </button>

              {!loading && total > 0 && (
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-[#3a5080]">{total} session{total !== 1 ? "s" : ""}</span>
                  {active > 0 && (
                    <span className="flex items-center gap-1 text-blue-400 font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                      {active} active
                    </span>
                  )}
                  {completed > 0 && (
                    <span className="text-emerald-500 font-medium">{completed} done</span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right: AI brain visual */}
          <div className="hidden md:block shrink-0 nh-float relative">
            {/* Ambient glow behind the circle */}
            <div
              className="absolute inset-0"
              style={{
                borderRadius: "50%",
                background: "radial-gradient(circle, rgba(79,110,247,0.28) 0%, transparent 70%)",
                filter: "blur(24px)",
                transform: "scale(1.4)",
              }}
            />
            {/* Circular image clip */}
            <div
              className="relative overflow-hidden"
              style={{
                width: 210,
                height: 210,
                borderRadius: "50%",
                border: "1px solid rgba(79,110,247,0.28)",
                boxShadow: "0 0 0 4px rgba(79,110,247,0.06), 0 0 40px rgba(79,110,247,0.2)",
              }}
            >
              <Image
                src="/ai-brain.png"
                alt="AI-powered screening"
                width={210}
                height={210}
                priority
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── Sessions ────────────────────────────────────────────────── */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-6 pb-16">

        {/* Error banner */}
        {error && (
          <div
            className="mb-8 flex items-center gap-3 px-5 py-3.5 rounded-xl"
            style={{ background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.15)" }}
          >
            <AlertCircle size={13} className="text-red-400 shrink-0" />
            <p className="text-red-400 text-xs flex-1">{error}</p>
            <button onClick={() => setError("")}>
              <X size={12} className="text-red-700 hover:text-red-400" />
            </button>
          </div>
        )}

        {loading && <Skeleton />}

        {/* Empty state */}
        {!loading && sessions.length === 0 && !error && (
          <div className="flex flex-col items-center py-16 space-y-8 nh-fade-up">
            <div className="text-center space-y-2">
              <p className="text-white font-semibold text-lg">No sessions yet</p>
              <p className="text-[#3a5080] text-sm leading-relaxed max-w-xs mx-auto">
                Create a screening session to start evaluating candidates with AI precision.
              </p>
            </div>

            <button
              onClick={createNew}
              disabled={creating}
              className="nh-btn-primary flex items-center gap-2 px-7 py-3 text-sm"
            >
              <Plus size={14} /> {creating ? "Creating…" : "Create Your First Session"}
            </button>

            {/* Product preview */}
            <div className="relative mt-4 w-full max-w-lg mx-auto">
              <div
                className="rounded-2xl overflow-hidden"
                style={{
                  border: "1px solid rgba(79,110,247,0.15)",
                  boxShadow: "0 0 60px rgba(79,110,247,0.12), 0 24px 80px rgba(0,0,0,0.5)",
                }}
              >
                <Image
                  src="/scoring-dashboard.png"
                  alt="Candidate scoring dashboard preview"
                  width={600}
                  height={600}
                  className="w-full opacity-75"
                />
              </div>
              {/* Fade gradient at bottom */}
              <div
                className="absolute bottom-0 left-0 right-0 h-24 rounded-b-2xl"
                style={{ background: "linear-gradient(to top, #020912 0%, transparent 100%)" }}
              />
              <p className="absolute bottom-4 left-0 right-0 text-center text-[#2a3a5a] text-xs">
                Your candidate results will look like this
              </p>
            </div>
          </div>
        )}

        {/* Session groups */}
        {!loading && sessions.length > 0 && (
          <div className="space-y-10">
            {GROUP_ORDER.map(g => {
              const grp = grouped[g];
              if (!grp?.length) return null;
              return (
                <div key={g}>
                  {/* Group header */}
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-xs font-semibold uppercase tracking-widest text-[#566b99]">
                      {GROUP_LABELS[g]}
                    </span>
                    <span
                      className="text-[10px] font-mono text-[#3a5080] px-1.5 py-0.5 rounded"
                      style={{ background: "rgba(79,110,247,0.06)" }}
                    >
                      {grp.length}
                    </span>
                    <div className="flex-1 h-px" style={{ background: "rgba(79,110,247,0.07)" }} />
                  </div>

                  {/* Cards */}
                  <div className="space-y-2.5">
                    {grp.map((session, i) => {
                      const jd      = session.jd_analysis as Record<string, unknown> | null;
                      const role    = jd ? String(jd.role ?? "Unnamed Role") : "New Session";
                      const cfg     = STATUS[session.status] ?? STATUS.created;
                      const date    = new Date(session.created_at);
                      const dateStr = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                      const iters   = session.preview_iteration_count;

                      return (
                        <div
                          key={session.id}
                          onClick={() => router.push(`/sessions/${session.id}`)}
                          className="group flex items-center gap-5 px-5 py-4 rounded-2xl cursor-pointer transition-all nh-fade-up"
                          style={{
                            animationDelay: `${i * 40}ms`,
                            background: "rgba(6,13,38,0.55)",
                            border: "1px solid rgba(79,110,247,0.07)",
                            borderLeft: `3px solid ${cfg.color}`,
                          }}
                          onMouseEnter={e => {
                            const el = e.currentTarget as HTMLElement;
                            el.style.background = "rgba(10,20,55,0.72)";
                            el.style.boxShadow = `0 4px 24px rgba(0,0,0,0.35), 0 0 0 1px ${cfg.color}18`;
                          }}
                          onMouseLeave={e => {
                            const el = e.currentTarget as HTMLElement;
                            el.style.background = "rgba(6,13,38,0.55)";
                            el.style.boxShadow = "none";
                          }}
                        >
                          {/* Main content */}
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-[#d8e8ff] text-[15px] truncate leading-snug">
                              {role}
                            </p>
                            <div className="flex items-center gap-3 mt-1.5">
                              <span className="flex items-center gap-1.5 text-[11px] text-[#3a5080]">
                                <Clock size={9} /> {dateStr}
                              </span>
                              {iters > 0 && (
                                <span className="flex items-center gap-1.5 text-[11px] text-[#3a5080]">
                                  <TrendingUp size={9} /> {iters} iteration{iters !== 1 ? "s" : ""}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Status + actions */}
                          <div className="flex items-center gap-3 shrink-0">
                            {cfg.pulse && (
                              <span
                                className="w-1.5 h-1.5 rounded-full animate-pulse shrink-0"
                                style={{ background: cfg.color }}
                              />
                            )}
                            <span
                              className="text-[11px] font-semibold px-2.5 py-1 rounded-full hidden sm:block"
                              style={{
                                color: cfg.color,
                                background: `${cfg.color}18`,
                                border: `1px solid ${cfg.color}30`,
                              }}
                            >
                              {cfg.label}
                            </span>

                            <button
                              onClick={e => { e.stopPropagation(); setPendingDelete(session); }}
                              className="w-7 h-7 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shrink-0"
                              style={{ background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.15)" }}
                            >
                              <Trash2 size={11} className="text-red-400" />
                            </button>

                            <ChevronRight
                              size={14}
                              className="text-[#2a3a5a] group-hover:text-[#6c80a8] transition-all group-hover:translate-x-0.5"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* New session row */}
            <div>
              <button
                onClick={createNew}
                disabled={creating}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-xs text-[#3a5080] hover:text-[#566b99] transition-all"
                style={{ border: "1px dashed rgba(79,110,247,0.12)" }}
              >
                <Plus size={12} /> New Session
              </button>
            </div>
          </div>
        )}
      </main>

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <footer
        className="max-w-4xl mx-auto w-full px-6 py-8 flex items-center justify-between border-t"
        style={{ borderColor: "rgba(79,110,247,0.06)" }}
      >
        <span className="text-[#3a5080] text-xs font-semibold">NextHire</span>
        <span className="text-[#2a3a5a] text-xs">Structured · Objective · Scalable</span>
      </footer>

      {/* ── Delete confirm ───────────────────────────────────────────── */}
      {pendingDelete && (
        <ConfirmDelete
          name={(() => {
            const jd = pendingDelete.jd_analysis as Record<string, unknown> | null;
            return jd ? String(jd.role ?? "Unnamed Role") : "New Session";
          })()}
          onConfirm={confirmDelete}
          onCancel={() => setPendingDelete(null)}
          deleting={deleting}
        />
      )}
    </div>
  );
}
