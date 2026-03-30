"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, type Session } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const STATUS_STYLE: Record<string, string> = {
  created: "bg-zinc-700 text-zinc-200",
  jd_analyzed: "bg-blue-700 text-blue-100",
  resumes_uploaded: "bg-yellow-700 text-yellow-100",
  preview_active: "bg-purple-700 text-purple-100",
  completed: "bg-green-700 text-green-100",
};

const STATUS_LABEL: Record<string, string> = {
  created: "New",
  jd_analyzed: "JD Analyzed",
  resumes_uploaded: "Resumes Ready",
  preview_active: "Previewing",
  completed: "Complete",
};

export default function HomePage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.listSessions()
      .then(setSessions)
      .catch(() => setError("Cannot reach backend. Is it running on port 8000?"))
      .finally(() => setLoading(false));
  }, []);

  async function handleNew() {
    setCreating(true);
    try {
      const s = await api.createSession();
      router.push(`/sessions/${s.id}`);
    } catch {
      setError("Failed to create session.");
      setCreating(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-start justify-between mb-10">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">ATS Prompt Lab</h1>
            <p className="text-zinc-400 mt-1 text-sm">
              AI-powered resume shortlisting · iterative criteria refinement · field-level scoring
            </p>
          </div>
          <Button
            onClick={handleNew}
            disabled={creating}
            className="bg-white text-zinc-950 hover:bg-zinc-200 font-semibold"
          >
            {creating ? "Creating…" : "+ New Session"}
          </Button>
        </div>

        {error && (
          <div className="mb-6 rounded-md bg-red-950 border border-red-800 text-red-300 px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-zinc-500">Loading…</p>
        ) : sessions.length === 0 ? (
          <Card className="bg-zinc-900 border-zinc-800 text-center py-20">
            <CardContent>
              <p className="text-zinc-400 mb-6 text-sm">No sessions yet. Create one to get started.</p>
              <Button onClick={handleNew} disabled={creating} variant="outline" className="border-zinc-700">
                Start first session
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {sessions.map((s) => {
              const jd = s.jd_analysis as Record<string, unknown> | null;
              const style = STATUS_STYLE[s.status] ?? "bg-zinc-700 text-zinc-200";
              const label = STATUS_LABEL[s.status] ?? s.status;
              const tokens = (s.token_totals as Record<string, unknown>)?._total_tokens as number | undefined;
              return (
                <Card
                  key={s.id}
                  className="bg-zinc-900 border-zinc-800 hover:border-zinc-600 cursor-pointer transition-colors"
                  onClick={() => router.push(`/sessions/${s.id}`)}
                >
                  <CardHeader className="pb-2 pt-4">
                    <div className="flex items-center justify-between gap-3">
                      <CardTitle className="text-sm font-semibold text-zinc-100 truncate">
                        {jd ? String(jd.role ?? "Unnamed role") : "New session"}
                      </CardTitle>
                      <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${style}`}>
                        {label}
                      </span>
                    </div>
                    <CardDescription className="text-zinc-500 text-xs mt-1">
                      {new Date(s.created_at).toLocaleString()}
                      {s.preview_iteration_count > 0 && ` · ${s.preview_iteration_count} preview iterations`}
                      {tokens ? ` · ${tokens.toLocaleString()} tokens` : ""}
                    </CardDescription>
                  </CardHeader>
                  {s.jd_text && (
                    <CardContent className="pt-0 pb-4">
                      <p className="text-zinc-500 text-xs line-clamp-1">{s.jd_text}</p>
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
