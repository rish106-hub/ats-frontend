export const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export type SessionStatus =
  | "created"
  | "jd_analyzed"
  | "resumes_uploaded"
  | "rubric_ready"
  | "preview_active"
  | "running_full_eval"
  | "completed";

export interface FullEvalProgress {
  status: "idle" | "queued" | "running" | "completed" | "error";
  scored?: number;
  total?: number;
  error?: string | null;
}

export interface FullEvalStatus {
  progress: FullEvalProgress;
  results_count: number;
  status: SessionStatus;
}

export interface FieldMatch {
  field: string;
  value_from_resume: string;
  criteria_checked: string;
  match: "pass" | "fail" | "partial";
  note: string;
}

export interface RedFlag {
  flag: string;
  risk_type: string;
  lens?: string;
}

export interface RoleContext {
  org_stage?: string;
  seniority_level?: string;
  archetype?: string;
}

export interface JdAnalysis {
  role?: string;
  role_type?: string;
  role_context?: RoleContext;
  one_liner?: string;
  baseline_signals?: string[];
  p0_signals?: string[];
  red_flags?: RedFlag[];
  jd_quality_score?: number;
  vague_requirements?: string[];
  conflicting_requirements?: string[];
  inferred_not_explicit?: boolean;
  gap_questions?: Array<{
    question: string;
    options: string[];
    impacts: string;
    field_target: string;
  }>;
}

export interface P0Match {
  signal: string;
  score: number;
}

export interface CandidateResult {
  candidate_name: string;
  file_name?: string;
  field_matches: FieldMatch[];
  baseline_pass: boolean;
  baseline_failures: string[];
  p0_score: number;
  p0_matches: P0Match[];
  extra_param_matches: string[];
  red_flags_found: string[];
  overall_score: number;
  classification: "P0" | "Baseline" | "Reject";
  reasoning: string;
  confidence?: "high" | "medium" | "low";
}

export interface SkippedEntry {
  file_name: string;
  reason: string;
  quality?: any;
}

export interface SkippedInfo {
  unreadable: SkippedEntry[];
  sampled_out: SkippedEntry[];
  model_dropped: SkippedEntry[];
}

export interface PreviewResults {
  results: CandidateResult[];
  summary: { total_evaluated: number; p0_count: number; baseline_count: number; reject_count: number };
  _skipped?: SkippedInfo;
}

export interface CandidateFeedback {
  file_name: string;
  action: string;
  reason: string;
}

export interface ResumeLens {
  file_name?: string;
  ownership_arc?: string;
  domain_proximity?: string;
  craft_signals?: string;
  experience_profile?: string;
  trajectory?: string;
  hm_flag?: string;
  red_flag_notes?: string;
}

export interface InterpretResponse {
  interpretation: string;
  will_do: string[];
  confirmation_prompt: string;
}

export interface LessonLearned {
  candidate?: string;
  action?: string;
  reason_given?: string;
  lesson?: string;
  rubric_change?: string;
}

export interface ResumeListItem {
  id: string;
  session_id: string;
  file_name: string;
  resume_json: any;
  quality: any;
  keyword_score: number;
  resume_lens?: ResumeLens | null;
  is_exemplar: boolean;
}

export interface Session {
  id: string;
  status: SessionStatus;
  created_at: string;
  jd_text: string | null;
  jd_analysis: JdAnalysis | null;
  base_criteria: Record<string, unknown> | null;
  synthesized_config: Record<string, unknown> | null;
  final_config: Record<string, unknown> | null;
  preview_iteration_count: number;
  extra_params_history: Array<{
    iteration: number;
    include: string;
    exclude: string;
    update_baseline?: string;
    update_p0?: string;
  }>;
  candidate_feedback_history: Array<Record<string, unknown>>;
  preview_field_results: PreviewResults | null;
  full_results: PreviewResults | null;
  full_eval_progress?: FullEvalProgress | null;
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

  refinePreview: (
    id: string,
    instructions: string,
    candidate_feedback: CandidateFeedback[] = [],
    apiKey?: string,
  ) =>
    req<Session>(`/api/sessions/${id}/preview/refine`, {
      method: "POST",
      body: JSON.stringify({ instructions, candidate_feedback, api_key: apiKey }),
    }),

  reloadPreview: (id: string, apiKey?: string) =>
    req<Session>(`/api/sessions/${id}/preview/reload`, {
      method: "POST",
      body: JSON.stringify({ api_key: apiKey }),
    }),

  accept: (id: string, apiKey?: string) =>
    req<Session>(`/api/sessions/${id}/accept`, {
      method: "POST",
      body: JSON.stringify({ api_key: apiKey }),
    }),

  listResumes: (id: string) =>
    req<ResumeListItem[]>(`/api/sessions/${id}/resumes`),

  fullEvalStatus: (id: string) =>
    req<FullEvalStatus>(`/api/sessions/${id}/full-eval-status`),

  markExemplar: (sessionId: string, fileName: string, isExemplar: boolean) =>
    req<ResumeListItem>(`/api/sessions/${sessionId}/resumes/${encodeURIComponent(fileName)}/mark-exemplar`, {
      method: "PATCH",
      body: JSON.stringify({ is_exemplar: isExemplar }),
    }),

  rubricFromExemplars: (sessionId: string, apiKey?: string) =>
    req<Session>(`/api/sessions/${sessionId}/rubric-from-exemplars`, {
      method: "POST",
      body: JSON.stringify({ api_key: apiKey }),
    }),

  patchRubric: (
    sessionId: string,
    patch: { baseline_checks?: any[]; p0_weights?: any[]; red_flag_checks?: any[] },
    apiKey?: string,
  ) =>
    req<Session>(`/api/sessions/${sessionId}/rubric`, {
      method: "PATCH",
      body: JSON.stringify({ ...patch, api_key: apiKey }),
    }),

  reclassifyPreview: (sessionId: string, apiKey?: string) =>
    req<Session>(`/api/sessions/${sessionId}/preview/reclassify`, {
      method: "POST",
      body: JSON.stringify({ api_key: apiKey }),
    }),

  interpretInstructions: (id: string, instructions: string, apiKey?: string) =>
    req<InterpretResponse>(`/api/sessions/${id}/preview/interpret`, {
      method: "POST",
      body: JSON.stringify({ instructions, api_key: apiKey }),
    }),

  deleteSession: (id: string) =>
    req<{ ok: boolean }>(`/api/sessions/${id}`, { method: "DELETE" }),
};
