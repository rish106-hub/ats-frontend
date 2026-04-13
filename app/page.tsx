"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, type Session } from "@/lib/api";

/* ── HR facts ─────────────────────────────────────────────────────── */
const FACTS = [
  { stat: "7.4 s",  desc: "Average time a recruiter spends on a resume",        src: "Ladders Study"          },
  { stat: "250+",   desc: "Applications the average job posting receives",       src: "Glassdoor"              },
  { stat: "10 days",desc: "Window before top candidates accept another offer",   src: "LinkedIn Talent Trends" },
  { stat: "60 %",   desc: "Reduction in time-to-hire using AI screening",        src: "Deloitte"               },
  { stat: "40 %",   desc: "Less employee turnover with AI-assisted hiring",      src: "McKinsey"               },
  { stat: "26 %",   desc: "Hiring accuracy gain from structured evaluation",     src: "Google Research"        },
];

const QUOTES = [
  { text: "Hire for attitude, train for skill.",                          author: "Herb Kelleher"  },
  { text: "A players hire A players. B players hire C players.",          author: "Steve Jobs"     },
  { text: "Every hire changes your culture. Choose wisely.",              author: ""               },
  { text: "The secret to hiring: find people who want to change the world.", author: "Marc Benioff"},
];

/* ── Status config ────────────────────────────────────────────────── */
const STATUS: Record<string, { label: string; dotCls: string; textCls: string }> = {
  created:           { label: "New",            dotCls: "nh-dot-blue",   textCls: "text-blue-400"   },
  jd_analyzed:       { label: "JD Analysed",    dotCls: "nh-dot-cyan",   textCls: "text-cyan-400"   },
  resumes_uploaded:  { label: "Resumes Ready",  dotCls: "nh-dot-amber",  textCls: "text-amber-400"  },
  rubric_ready:      { label: "Rubric Ready",   dotCls: "nh-dot-purple", textCls: "text-purple-400" },
  preview_active:    { label: "Previewing",     dotCls: "nh-dot-cyan",   textCls: "text-cyan-400"   },
  running_full_eval: { label: "Evaluating…",    dotCls: "nh-dot-blue",   textCls: "text-blue-400"   },
  completed:         { label: "Complete",       dotCls: "nh-dot-green",  textCls: "text-emerald-400"},
};

/* ── Tiny components ──────────────────────────────────────────────── */
function StatusPill({ status }: { status: string }) {
  const s = STATUS[status] ?? { label: status, dotCls: "nh-dot-blue", textCls: "text-blue-400" };
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${s.textCls}`}>
      <span className={s.dotCls} />
      {s.label}
    </span>
  );
}

function Spinner() {
  return <span className="inline-block w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />;
}

/* ── Rotating fact card ────────────────────────────────────────────── */
function FactCard() {
  const [i, setI] = useState(0);
  useEffect(() => { const t = setInterval(() => setI(n => (n + 1) % FACTS.length), 5000); return () => clearInterval(t); }, []);
  const f = FACTS[i];
  return (
    <div className="nh-card p-6 space-y-2 transition-all duration-500">
      <div className="text-4xl font-black font-mono text-nh-gradient tracking-tight">{f.stat}</div>
      <p className="text-[#a8b8d8] text-sm leading-relaxed">{f.desc}</p>
      <p className="text-[#3a5080] text-xs">{f.src}</p>
    </div>
  );
}

/* ── Rotating quote ────────────────────────────────────────────────── */
function QuoteCard() {
  const [i, setI] = useState(0);
  useEffect(() => { const t = setInterval(() => setI(n => (n + 1) % QUOTES.length), 7000); return () => clearInterval(t); }, []);
  const q = QUOTES[i];
  return (
    <div className="nh-card p-6 space-y-3">
      <div className="w-8 h-1 rounded-full" style={{ background: "linear-gradient(90deg,#3b82f6,#38bdf8)" }} />
      <p className="text-[#c8d8f0] text-sm italic leading-relaxed">"{q.text}"</p>
      {q.author && <p className="text-blue-400 text-xs font-medium">— {q.author}</p>}
    </div>
  );
}

/* ── Stats bar ────────────────────────────────────────────────────── */
function StatsBar({ sessions }: { sessions: Session[] }) {
  const total     = sessions.length;
  const active    = sessions.filter(s => !["created", "completed"].includes(s.status)).length;
  const completed = sessions.filter(s => s.status === "completed").length;
  return (
    <div className="grid grid-cols-3 gap-4">
      {[
        { label: "Total",     value: total,     cls: "text-white"       },
        { label: "Active",    value: active,    cls: "text-blue-400"    },
        { label: "Completed", value: completed, cls: "text-emerald-400" },
      ].map(({ label, value, cls }) => (
        <div key={label} className="nh-card p-5 text-center">
          <div className={`text-3xl font-black font-mono ${cls}`}>{value}</div>
          <div className="text-[#4a6080] text-xs mt-1 uppercase tracking-widest">{label}</div>
        </div>
      ))}
    </div>
  );
}

/* ── How it works ─────────────────────────────────────────────────── */
const HOW = [
  { n: "01", title: "Paste JD",         desc: "AI extracts baseline & priority signals" },
  { n: "02", title: "Upload Resumes",   desc: "PDFs parsed to structured JSON"          },
  { n: "03", title: "Preview & Refine", desc: "Score a batch, tweak in plain English"   },
  { n: "04", title: "Full Evaluation",  desc: "Score every candidate with your rubric"  },
];

/* ══════════════════════════════════════════════════════════════════
   HOME PAGE
═══════════════════════════════════════════════════════════════════ */
export default function HomePage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [creating, setCreating] = useState(false);
  const [error,    setError]    = useState("");

  useEffect(() => {
    api.listSessions()
      .then(setSessions)
      .catch(() => setError("Cannot reach backend — is it running on port 8000?"))
      .finally(() => setLoading(false));
  }, []);

  async function handleNew() {
    setCreating(true);
    try { const s = await api.createSession(); router.push(`/sessions/${s.id}`); }
    catch { setError("Failed to create session."); setCreating(false); }
  }

  return (
    <div className="min-h-screen flex flex-col">

      {/* ── Navbar ───────────────────────────────────────────────── */}
      <header className="nh-nav sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-8 h-16 flex items-center justify-between">

          {/* Logo */}
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center font-black text-white text-sm nh-glow"
              style={{ background: "linear-gradient(135deg,#2563eb,#0ea5e9)" }}
            >N</div>
            <span className="font-bold text-white text-lg tracking-tight">NextHire</span>
          </div>

          {/* Right */}
          <div className="flex items-center gap-4">
            <span className="text-[#3a5080] text-sm hidden md:block">AI-powered hiring intelligence</span>
            <button
              onClick={handleNew}
              disabled={creating}
              className="nh-btn-primary flex items-center gap-2 px-5 py-2.5 text-sm"
            >
              {creating ? <><Spinner /> Creating…</> : <>+ New Session</>}
            </button>
          </div>
        </div>
      </header>

      {/* ── Main ─────────────────────────────────────────────────── */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-8 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-10">

          {/* ── Left column ──────────────────────────────────────── */}
          <div className="space-y-8 min-w-0">

            {/* Hero card */}
            <div className="nh-card p-8 space-y-3">
              <h1 className="text-3xl font-black text-nh-gradient leading-tight">
                Hiring Sessions
              </h1>
              <p className="text-[#6c80a8] text-base leading-relaxed max-w-lg">
                Each session is a complete AI hiring workflow — analyze a JD, score resumes,
                iterate on criteria, then run a full evaluation on every candidate.
              </p>
            </div>

            {/* Stats */}
            {sessions.length > 0 && <StatsBar sessions={sessions} />}

            {/* Error */}
            {error && (
              <div className="nh-card p-4 border-red-500/30" style={{ background: "rgba(239,68,68,0.06)" }}>
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            {/* Loading skeletons */}
            {loading && (
              <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="nh-card h-24 nh-shimmer" />
                ))}
              </div>
            )}

            {/* Empty state */}
            {!loading && sessions.length === 0 && !error && (
              <div className="nh-card p-16 flex flex-col items-center text-center space-y-6">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl nh-float"
                  style={{ background: "rgba(37,99,235,0.12)", border: "1px solid rgba(96,165,250,0.2)" }}
                >🎯</div>

                <div className="space-y-2">
                  <h2 className="text-xl font-bold text-white">No sessions yet</h2>
                  <p className="text-[#6c80a8] text-sm max-w-xs leading-relaxed">
                    Create your first session to start AI-powered resume screening.
                  </p>
                </div>

                <button onClick={handleNew} disabled={creating} className="nh-btn-primary px-8 py-3 text-sm">
                  {creating ? <Spinner /> : "Start First Session"}
                </button>

                <div className="pt-2 border-t border-[rgba(96,165,250,0.1)] w-full text-[#2a3a5a] text-xs space-y-1">
                  <p>Paste JD → Upload resumes → AI scores → Iterate → Full eval</p>
                  <p>Powered by Google Gemini</p>
                </div>
              </div>
            )}

            {/* Session list */}
            {!loading && sessions.length > 0 && (
              <div className="space-y-3">
                <p className="text-[#3a5080] text-xs font-semibold uppercase tracking-widest px-1">
                  {sessions.length} Session{sessions.length !== 1 ? "s" : ""}
                </p>
                {sessions.map(s => {
                  const jd     = s.jd_analysis as Record<string, unknown> | null;
                  const tokens = (s.token_totals as Record<string, unknown>)?._total_tokens as number | undefined;
                  const iters  = s.preview_iteration_count;

                  return (
                    <div
                      key={s.id}
                      onClick={() => router.push(`/sessions/${s.id}`)}
                      className="nh-card nh-card-hover p-6 cursor-pointer group"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 space-y-2 flex-1">
                          {/* Title row */}
                          <div className="flex items-center gap-3 flex-wrap">
                            <h3 className="font-bold text-white text-base truncate">
                              {jd ? String(jd.role ?? "Unnamed Role") : "New Session"}
                            </h3>
                            {jd && (jd.role_context as any)?.seniority_level && (
                              <span className="text-[10px] px-2.5 py-1 rounded-full font-semibold uppercase tracking-wide shrink-0"
                                style={{ background: "rgba(37,99,235,0.15)", border: "1px solid rgba(96,165,250,0.25)", color: "#93c5fd" }}>
                                {(jd.role_context as any).seniority_level}
                              </span>
                            )}
                          </div>

                          {/* Meta row */}
                          <div className="flex items-center gap-4 flex-wrap">
                            <StatusPill status={s.status} />
                            <span className="text-[#3a5080] text-xs">
                              {new Date(s.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                            </span>
                            {iters > 0 && (
                              <span className="text-[#3a5080] text-xs">{iters} iteration{iters !== 1 ? "s" : ""}</span>
                            )}
                            {tokens && (
                              <span className="text-[#3a5080] text-xs font-mono">{tokens.toLocaleString()} tokens</span>
                            )}
                          </div>

                          {/* JD snippet */}
                          {s.jd_text && (
                            <p className="text-[#3a5080] text-xs leading-snug line-clamp-1 mt-1">{s.jd_text}</p>
                          )}
                        </div>

                        {/* Arrow */}
                        <div className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all group-hover:bg-blue-500/10"
                          style={{ border: "1px solid rgba(96,165,250,0.1)" }}>
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-[#3a5080] group-hover:text-blue-400 transition-colors">
                            <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Right sidebar ─────────────────────────────────────── */}
          <div className="space-y-5 lg:sticky lg:top-24 lg:self-start">

            {/* Fact card */}
            <FactCard />

            {/* Quote card */}
            <QuoteCard />

            {/* How it works */}
            <div className="nh-card p-6 space-y-5">
              <p className="text-[#3a5080] text-xs font-semibold uppercase tracking-widest">How It Works</p>
              <div className="space-y-4">
                {HOW.map(({ n, title, desc }) => (
                  <div key={n} className="flex gap-4">
                    <span className="text-blue-500/50 font-mono text-xs font-bold mt-0.5 w-5 shrink-0">{n}</span>
                    <div>
                      <p className="text-[#c8d8f0] text-sm font-semibold">{title}</p>
                      <p className="text-[#4a6080] text-xs leading-snug mt-0.5">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Stats list */}
            <div className="nh-card p-6 space-y-5">
              <p className="text-[#3a5080] text-xs font-semibold uppercase tracking-widest">Hiring by the Numbers</p>
              <div className="space-y-3">
                {FACTS.map((f, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-nh-gradient font-mono font-black text-sm w-16 text-right shrink-0">{f.stat}</span>
                    <p className="text-[#4a6080] text-xs leading-snug">{f.desc}</p>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}
