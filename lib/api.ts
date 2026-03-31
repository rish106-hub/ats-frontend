const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export type SessionStatus =
  | "created"
  | "jd_analyzed"
  | "resumes_uploaded"
  | "preview_active"
  | "completed";

export interface FieldMatch {
  field: string;
  value_from_resume: string;
  criteria_checked: string;
  match: "pass" | "fail" | "partial";
  note: string;
}

export interface P0Match {
  signal: string;
  score: number;
}

export interface CandidateResult {
  candidate_name: string;
  field_matches: FieldMatch[];
  baseline_pass: boolean;
  baseline_failures: string[];
  p0_score: number;
  p0_matches: P0Match[] | string[];
  extra_param_matches: string[];
  red_flags_found: string[];
  overall_score: number;
  classification: "P0" | "Baseline" | "Reject";
  reasoning: string;
  confidence?: "high" | "medium" | "low";
}

export interface PreviewResults {
  results: CandidateResult[];
  summary: { total_evaluated: number; p0_count: number; baseline_count: number; reject_count: number };
}

export interface CandidateFeedback {
  file_name: string;
  action: string;
  reason: string;
}

export interface Session {
  id: string;
  status: SessionStatus;
  created_at: string;
  jd_text: string | null;
  jd_analysis: Record<string, unknown> | null;
  base_criteria: Record<string, unknown> | null;
  synthesized_config: Record<string, unknown> | null;
  final_config: Record<string, unknown> | null;
  preview_iteration_count: number;
  extra_params_history: Array<{ iteration: number; include: string; exclude: string }>;
  preview_field_results: PreviewResults | null;
  full_results: PreviewResults | null;
  token_totals: Record<string, unknown>;
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    let msg = "Request failed";
    if (typeof err.detail === "string") {
      msg = err.detail;
    } else if (Array.isArray(err.detail)) {
      msg = err.detail.map((d: any) => d.msg || JSON.stringify(d)).join(", ");
    } else if (err.message) {
      msg = err.message;
    }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

export const api = {
  listSessions: () => req<Session[]>("/api/sessions"),

  createSession: () =>
    req<Session>("/api/sessions", { method: "POST", body: "{}" }),

  getSession: (id: string) => req<Session>(`/api/sessions/${id}`),

  analyzeJD: (id: string, jdText: string, apiKey?: string) =>
    req<Session>(`/api/sessions/${id}/jd`, {
      method: "POST",
      body: JSON.stringify({ jd_text: jdText, api_key: apiKey }),
    }),

  uploadResumes: (id: string, files: File[], apiKey?: string) => {
    const form = new FormData();
    files.forEach((f) => form.append("files", f));
    if (apiKey) form.append("api_key", apiKey);
    return fetch(`${BASE}/api/sessions/${id}/resumes`, {
      method: "POST",
      body: form,
    }).then(async (r) => {
      if (!r.ok) {
        const err = await r.json().catch(() => ({ detail: r.statusText }));
        let msg = "Upload failed";
        if (typeof err.detail === "string") msg = err.detail;
        else if (Array.isArray(err.detail)) msg = err.detail.map((d: any) => d.msg || JSON.stringify(d)).join(", ");
        else if (err.message) msg = err.message;
        throw new Error(msg);
      }
      return r.json() as Promise<Session>;
    });
  },

  startPreview: (id: string, apiKey?: string) =>
    req<Session>(`/api/sessions/${id}/preview`, {
      method: "POST",
      body: JSON.stringify({ api_key: apiKey }),
    }),

  refinePreview: (id: string, include: string, exclude: string, candidate_feedback: CandidateFeedback[] = [], apiKey?: string) =>
    req<Session>(`/api/sessions/${id}/preview/refine`, {
      method: "POST",
      body: JSON.stringify({ include, exclude, candidate_feedback, api_key: apiKey }),
    }),

  accept: (id: string, apiKey?: string) =>
    req<Session>(`/api/sessions/${id}/accept`, {
      method: "POST",
      body: JSON.stringify({ api_key: apiKey }),
    }),
};
