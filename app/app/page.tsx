"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api, type Session } from "@/lib/api";
import { MieruLogo } from "@/components/mieru-logo";
import {
  AlertCircle,
  ArrowRight,
  BriefcaseBusiness,
  CheckCircle2,
  ClipboardList,
  Clock3,
  FileText,
  Gauge,
  Layers3,
  Loader2,
  Plus,
  Radar,
  Trash2,
  TriangleAlert,
  UsersRound,
  X,
} from "lucide-react";

type StatusTone = {
  label: string;
  desk: string;
  action: string;
  tone: string;
  bg: string;
  border: string;
};

const STATUS: Record<string, StatusTone> = {
  created: {
    label: "Needs JD",
    desk: "Draft the role brief",
    action: "Add JD",
    tone: "#f59e0b",
    bg: "rgba(245,158,11,.08)",
    border: "rgba(245,158,11,.22)",
  },
  jd_analyzed: {
    label: "Needs resumes",
    desk: "Upload candidate batch",
    action: "Upload resumes",
    tone: "#38bdf8",
    bg: "rgba(14,165,233,.08)",
    border: "rgba(14,165,233,.22)",
  },
  resumes_uploaded: {
    label: "Ready to calibrate",
    desk: "Start model calibration",
    action: "Calibrate",
    tone: "#22c55e",
    bg: "rgba(34,197,94,.08)",
    border: "rgba(34,197,94,.22)",
  },
  rubric_ready: {
    label: "Rubric ready",
    desk: "Review first candidates",
    action: "Start review",
    tone: "#22c55e",
    bg: "rgba(34,197,94,.08)",
    border: "rgba(34,197,94,.22)",
  },
  preview_active: {
    label: "Calibration live",
    desk: "Tune the shortlist logic",
    action: "Review queue",
    tone: "#f97316",
    bg: "rgba(249,115,22,.08)",
    border: "rgba(249,115,22,.22)",
  },
  running_full_eval: {
    label: "Shortlist running",
    desk: "Monitor the final run",
    action: "Track run",
    tone: "#06b6d4",
    bg: "rgba(6,182,212,.08)",
    border: "rgba(6,182,212,.22)",
  },
  completed: {
    label: "Decision packet ready",
    desk: "Review final shortlist",
    action: "Open results",
    tone: "#a3e635",
    bg: "rgba(163,230,53,.08)",
    border: "rgba(163,230,53,.22)",
  },
};

const FALLBACK = STATUS.created;

function roleName(session: Session) {
  return String((session.jd_analysis as any)?.role || "Untitled hiring role");
}

function roleBrief(session: Session) {
  return String((session.jd_analysis as any)?.one_liner || "Create the role brief, upload resumes, calibrate the model, then run the shortlist.");
}

function statusFor(session: Session) {
  return STATUS[session.status] || FALLBACK;
}

function candidatesNeedingWork(session: Session) {
  if (session.status === "created") return "JD missing";
  if (session.status === "jd_analyzed") return "Resume batch missing";
  if (session.status === "resumes_uploaded") return "Calibration not started";
  if (session.status === "rubric_ready") return "Review candidates";
  if (session.status === "preview_active") return "Recruiter review needed";
  if (session.status === "running_full_eval") return "Final run in progress";
  return "Shortlist ready";
}

function DeskSignal({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-white/10 bg-white/[.06] px-3 py-2">
      <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#c7b18b]">{label}</p>
      <p className="mt-1 truncate text-sm font-black text-white" title={value}>{value}</p>
    </div>
  );
}

export default function HomePage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [deskNote, setDeskNote] = useState("");

  useEffect(() => {
    async function loadWorkspace() {
      try {
        const me = await api.me();
        if (!me.onboarding_completed) {
          router.replace("/onboarding");
          return;
        }
        setSessions(await api.listSessions());
      } catch (err) {
        setError((err as Error).message || "Backend is not reachable on the configured API URL.");
      } finally {
        setLoading(false);
      }
    }
    loadWorkspace();
  }, [router]);

  useEffect(() => {
    setDeskNote(window.localStorage.getItem("mieru:hiring-desk-note") || "");
  }, []);

  function updateDeskNote(value: string) {
    setDeskNote(value);
    window.localStorage.setItem("mieru:hiring-desk-note", value);
  }

  async function createRole() {
    setCreating(true);
    setError("");
    try {
      const session = await api.createSession();
      router.push(`/sessions/${session.id}`);
    } catch (e) {
      setError((e as Error).message || "Could not create role.");
      setCreating(false);
    }
  }

  async function deleteRole(session: Session) {
    setDeletingId(session.id);
    try {
      await api.deleteSession(session.id);
      setSessions((items) => items.filter((item) => item.id !== session.id));
    } catch (e) {
      setError((e as Error).message || "Delete failed.");
    } finally {
      setDeletingId(null);
    }
  }

  const desk = useMemo(() => {
    const needsJd = sessions.filter((s) => s.status === "created").length;
    const needsCalibration = sessions.filter((s) => ["resumes_uploaded", "rubric_ready", "preview_active"].includes(s.status)).length;
    const ready = sessions.filter((s) => s.status === "completed").length;
    return [
      { label: "Needs role brief", value: needsJd, icon: FileText, tone: "#f59e0b", copy: "Draft the JD before resumes enter the review lane." },
      { label: "Needs calibration", value: needsCalibration, icon: Radar, tone: "#22c55e", copy: "Review evidence and teach the model what good looks like." },
      { label: "Ready for decision", value: ready, icon: CheckCircle2, tone: "#a3e635", copy: "Open final shortlists and inspect evidence before outreach." },
    ];
  }, [sessions]);

  const activeRoles = sessions.filter((s) => s.status !== "completed");
  const completedRoles = sessions.filter((s) => s.status === "completed");
  const ordered = [...activeRoles, ...completedRoles];
  const focusRole = ordered.find((s) => ["preview_active", "resumes_uploaded", "rubric_ready"].includes(s.status)) || ordered[0];
  const focusStatus = focusRole ? statusFor(focusRole) : null;

  return (
    <main className="min-h-screen bg-[#f5f2ea] text-[#151411]">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[248px_minmax(0,1fr)]">
        <aside className="border-b border-[#ded8cc] bg-[#f9f7f1] px-5 py-5 lg:border-b-0 lg:border-r lg:py-6">
          <div className="flex items-center justify-between gap-4 lg:block">
            <button onClick={() => router.push("/app")} className="flex items-center gap-3 text-left">
              <MieruLogo />
            </button>
            <button
              onClick={createRole}
              disabled={creating}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#151411] px-3 text-xs font-semibold text-white transition hover:bg-[#2a2823] disabled:opacity-60 lg:mt-8 lg:w-full lg:justify-center"
            >
              {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              New role
            </button>
          </div>

          <nav className="mt-6 hidden space-y-1 lg:block">
            {[
              { label: "Hiring desk", icon: BriefcaseBusiness, active: true },
              { label: "Review queues", icon: UsersRound },
              { label: "Calibration", icon: Gauge },
              { label: "Decision packets", icon: ClipboardList },
            ].map((item) => (
              <div
                key={item.label}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${item.active ? "bg-[#ede7da] text-[#151411]" : "text-[#777064]"}`}
              >
                <item.icon size={15} />
                {item.label}
              </div>
            ))}
          </nav>

          <div className="mt-6 hidden rounded-xl border border-[#ded8cc] bg-white p-4 lg:block">
            <p className="text-xs font-bold uppercase tracking-[.18em] text-[#9b6a2f]">Today</p>
            <p className="mt-2 text-sm leading-5 text-[#4d473d]">Start with roles blocked by missing evidence, not vanity counters.</p>
          </div>

          <form action="/auth/signout" method="post" className="mt-3 hidden lg:block">
            <button className="w-full rounded-lg border border-[#ded8cc] bg-white px-3 py-2 text-xs font-bold text-[#4d473d] transition hover:border-[#151411]">
              Sign out
            </button>
          </form>
        </aside>

        <section className="px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
          <div className="mx-auto flex max-w-7xl flex-col gap-5">
            <header className="grid gap-4">
              <div className="rounded-2xl border border-[#ded8cc] bg-[#151411] p-4 text-white shadow-sm sm:p-5">
                <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-[.18em] text-[#c7b18b]">Recruiter command center</p>
                    <h1 className="mt-2 truncate text-2xl font-black tracking-tight sm:text-3xl">
                      Today's hiring desk
                    </h1>
                    <p className="mt-2 max-w-2xl text-sm leading-5 text-[#d6d0c5]">
                      Work the next blocked role, capture context, then move into calibration or shortlist review.
                    </p>
                    <div className="mt-4 grid gap-2 sm:grid-cols-3">
                      <DeskSignal label="Focus" value={focusRole ? focusStatus?.label || "Open role" : "Create role"} />
                      <DeskSignal label="Queue" value={focusRole ? candidatesNeedingWork(focusRole) : "No active roles"} />
                      <DeskSignal label="Action" value={focusStatus?.action || "New role"} />
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[.06] p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[11px] font-bold uppercase tracking-[.16em] text-[#c7b18b]">Recruiter scratchpad</p>
                        <p className="mt-1 truncate text-xs text-[#d6d0c5]">Role context, hiring manager notes, or must-check criteria.</p>
                      </div>
                      <button
                        onClick={() => focusRole ? router.push(`/sessions/${focusRole.id}`) : createRole()}
                        disabled={creating}
                        className="shrink-0 rounded-lg bg-white px-3 py-2 text-xs font-black text-[#151411] disabled:opacity-60"
                      >
                        {focusStatus?.action || "New role"}
                      </button>
                    </div>
                    <textarea
                      value={deskNote}
                      onChange={(e) => updateDeskNote(e.target.value)}
                      rows={3}
                      placeholder="Example: prioritize PM ownership, consumer launch proof, and stakeholder evidence."
                      className="mt-3 w-full resize-none rounded-lg border border-white/15 bg-white/[.08] px-3 py-2 text-sm text-white placeholder:text-[#a9a296] focus:border-white/40 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {desk.map((item) => (
                  <div key={item.label} className="rounded-2xl border border-[#ded8cc] bg-white p-4 shadow-sm">
                    <div className="flex items-start gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ background: `${item.tone}18`, color: item.tone }}>
                        <item.icon size={17} />
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-baseline gap-2">
                          <p className="text-2xl font-black leading-none">{item.value}</p>
                          <p className="truncate text-xs font-semibold text-[#5f584e]">{item.label}</p>
                        </div>
                        <p className="mt-1 text-xs leading-5 text-[#777064]">{item.copy}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </header>

            {error && (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                <span className="flex items-center gap-2"><AlertCircle size={15} /> {error}</span>
                <button onClick={() => setError("")}><X size={14} /></button>
              </div>
            )}

            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
              <section className="rounded-2xl border border-[#ded8cc] bg-white shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#ebe5d9] px-4 py-4 sm:px-5">
                  <div>
                    <h2 className="text-base font-black">Hiring roles</h2>
                    <p className="mt-1 text-xs text-[#777064]">Every card has a job: unblock JD, calibrate candidates, or inspect the shortlist.</p>
                  </div>
                  <button
                    onClick={createRole}
                    disabled={creating}
                    className="inline-flex items-center gap-2 rounded-lg border border-[#151411] bg-[#151411] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#2a2823] disabled:opacity-60"
                  >
                    {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                    Create role
                  </button>
                </div>

                {loading ? (
                  <div className="grid gap-3 p-4 sm:p-5">
                    {[0, 1, 2].map((i) => <div key={i} className="h-28 animate-pulse rounded-xl bg-[#f0ece3]" />)}
                  </div>
                ) : ordered.length === 0 ? (
                  <div className="grid min-h-[360px] place-items-center p-6 text-center">
                    <div className="max-w-sm">
                      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#ede7da] text-[#151411]"><BriefcaseBusiness size={21} /></div>
                      <h3 className="mt-4 text-lg font-black">Create your first hiring role</h3>
                      <p className="mt-2 text-sm leading-6 text-[#777064]">Start with a JD. The workspace will guide you through resumes, calibration, and the final shortlist.</p>
                      <button onClick={createRole} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#151411] px-4 py-2 text-sm font-semibold text-white">
                        <Plus size={15} /> New role
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-3 p-4 sm:p-5">
                    {ordered.map((session) => {
                      const status = statusFor(session);
                      const date = new Date(session.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
                      const preview = session.preview_field_results?.summary;
                      const final = session.full_results?.summary;
                      const summary = final || preview;
                      return (
                        <article key={session.id} className="group rounded-xl border border-[#e4ded2] bg-[#fffdf8] p-4 transition hover:border-[#c9bda9] hover:shadow-sm">
                          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                            <button onClick={() => router.push(`/sessions/${session.id}`)} className="min-w-0 flex-1 text-left">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ color: status.tone, background: status.bg, border: `1px solid ${status.border}` }}>
                                  {status.label}
                                </span>
                                <span className="text-xs text-[#8b8376]">Created {date}</span>
                                {session.preview_iteration_count > 0 && <span className="text-xs text-[#8b8376]">{session.preview_iteration_count} calibration pass{session.preview_iteration_count > 1 ? "es" : ""}</span>}
                              </div>
                              <h3 className="mt-3 truncate text-lg font-black tracking-tight">{roleName(session)}</h3>
                              <p className="mt-1 line-clamp-2 max-w-3xl text-sm leading-6 text-[#645d52]">{roleBrief(session)}</p>
                            </button>

                            <div className="grid min-w-[260px] gap-2 sm:grid-cols-2 md:max-w-[360px]">
                              <div className="rounded-lg border border-[#ebe5d9] bg-white px-3 py-2">
                                <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#9b6a2f]">Attention</p>
                                <p className="mt-1 text-xs font-semibold text-[#2c2924]">{candidatesNeedingWork(session)}</p>
                              </div>
                              <div className="rounded-lg border border-[#ebe5d9] bg-white px-3 py-2">
                                <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#9b6a2f]">Evidence</p>
                                <p className="mt-1 text-xs font-semibold text-[#2c2924]">
                                  {summary ? `${summary.p0_count} P0 / ${summary.reject_count} blocked` : "Waiting for resumes"}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 md:justify-end">
                              <button
                                onClick={() => router.push(`/sessions/${session.id}`)}
                                className="inline-flex items-center gap-2 rounded-lg bg-[#151411] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#2a2823]"
                              >
                                {status.action} <ArrowRight size={13} />
                              </button>
                              <button
                                onClick={() => deleteRole(session)}
                                disabled={deletingId === session.id}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#ead7d2] text-red-500 transition hover:bg-red-50 disabled:opacity-50"
                                title="Delete role"
                              >
                                {deletingId === session.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                              </button>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>

              <aside className="grid gap-5 content-start">
                <section className="rounded-2xl border border-[#ded8cc] bg-white p-5 shadow-sm">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#ede7da] text-[#151411]"><Layers3 size={18} /></span>
                    <div>
                      <h2 className="text-sm font-black">Recruiter copilot loop</h2>
                      <p className="text-xs text-[#777064]">The system improves after recruiter judgment.</p>
                    </div>
                  </div>
                  <div className="mt-5 space-y-3">
                    {[
                      "Turn the JD into evidence-based criteria.",
                      "Review a small calibration batch before trusting the model.",
                      "Mark ideal resumes and explain disagreements.",
                      "Run the final shortlist only after the rubric feels right.",
                    ].map((item, index) => (
                      <div key={item} className="flex gap-3 rounded-xl border border-[#ebe5d9] bg-[#fffdf8] p-3">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#151411] text-[11px] font-bold text-white">{index + 1}</span>
                        <p className="text-sm leading-5 text-[#4d473d]">{item}</p>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="rounded-2xl border border-[#ded8cc] bg-[#2b261f] p-5 text-white shadow-sm">
                  <div className="flex items-center gap-2 text-[#e6c78e]"><TriangleAlert size={15} /><p className="text-xs font-bold uppercase tracking-[.16em]">Design rule</p></div>
                  <p className="mt-3 text-sm leading-6 text-[#f1eadf]">Nothing on this screen is decorative filler. If a card does not help a recruiter decide, calibrate, or unblock work, it does not belong here.</p>
                </section>
              </aside>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
