# Mieru — Recruiter Workspace

> Evidence-first resume shortlisting with role calibration, rubric teaching, recruiter notes, and grounded candidate scoring.

The frontend is a Next.js 16 (App Router) application that drives a multi-step recruiter workflow: authenticate with Supabase, complete company onboarding, paste a job description, upload resumes, run preview evaluations, refine criteria in natural language, and accept a final shortlist run.

---

## Table of Contents

- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Application Workflow](#application-workflow)
- [Key Components](#key-components)
- [API Layer](#api-layer)
- [Production Deployment](#production-deployment)
- [Related Repositories](#related-repositories)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | [Next.js 16](https://nextjs.org) — App Router, React 19 |
| Language | TypeScript 5 |
| Styling | Tailwind CSS v4 |
| UI Components | [shadcn/ui](https://ui.shadcn.com) + Base UI |
| Icons | Lucide React |
| Font | Geist Sans / Geist Mono (next/font) |
| Backend | FastAPI (separate repo) |

---

## Project Structure

```
ats-frontend/
├── app/
│   ├── layout.tsx              # Root layout — fonts, metadata
│   ├── page.tsx                # Sessions dashboard (list + create)
│   └── sessions/
│       └── [id]/
│           └── page.tsx        # Full session wizard (JD → Resumes → Preview → Results)
├── components/
│   ├── field-match-table.tsx   # Per-candidate field-level score table
│   ├── resume-drawer.tsx       # Slide-in panel: PDF viewer + AI lens + field matches
│   └── ui/                     # shadcn/ui primitives (button, card, input, …)
├── lib/
│   └── api.ts                  # Typed fetch client — all backend calls live here
├── public/                     # Static assets
├── next.config.ts
└── tsconfig.json
```

---

## Prerequisites

- **Node.js** 20+ (LTS recommended)
- **npm** 9+
- **ATS Backend** running on `http://localhost:8000` — see [ats-backend](https://github.com/rish106-hub/ats-backend)

---

## Getting Started

```bash
# 1. Clone the repo
git clone https://github.com/rish106-hub/ats-frontend.git
cd ats-frontend

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env.local
# Edit .env.local and set NEXT_PUBLIC_API_URL if needed

# 4. Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The backend must be reachable before any API calls will succeed.

### Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Production build |
| `npm run start` | Start production server (requires build) |

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | Base URL of the FastAPI backend |
| `NEXT_PUBLIC_SUPABASE_URL` | — | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | — | Supabase anon or publishable key |

Create a `.env.local` file (never commit it):

```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-publishable-or-anon-key
```

For production, set this to your deployed backend URL (e.g. Railway, Render, etc.).

---

## Application Workflow

The session wizard progresses through five steps driven by the backend session status:

```
created → jd_analyzed → resumes_uploaded → preview_active → running_full_eval → completed
```

| Step | UI State | What happens |
|---|---|---|
| **1 — JD** | `jd` | Paste a job description. AI extracts role, baseline signals, P0 signals, red-flag checks, and gap questions. |
| **2 — Resumes** | `resumes` | Upload PDF resumes (multi-select). Parsed to structured JSON. Optionally mark exemplars to seed the rubric. |
| **3 — Preview** | `preview` | Scores a sample of ~6 resumes with field-level match detail. Use plain-English instructions or per-candidate feedback to refine the rubric. Repeat as many times as needed. |
| **4 — Running** | `running` | Full evaluation kicked off in the background. Live progress polling every 3 s. |
| **5 — Results** | `results` | All candidates ranked P0 / Baseline / Reject with scores, field breakdowns, red flags, and a per-candidate AI lens. Download PDF from the drawer. |

---

## Key Components

### `app/sessions/[id]/page.tsx`
The main session wizard. Manages all local form state, orchestrates API calls, and renders the correct step UI. Includes:
- Real-time full-eval progress polling (3 s interval)
- Exemplar management panel
- Interpret-before-refine flow (AI explains what it will change before applying)
- Lessons-learned history panel
- Rubric editor (baseline checks, P0 weights, red-flag checks)

### `components/field-match-table.tsx`
Renders a per-candidate breakdown of every field evaluated — value extracted from the resume, the criteria checked, a pass/fail/partial badge, and the AI's note.

### `components/resume-drawer.tsx`
Slide-in side panel triggered from any candidate card. Shows:
- Embedded PDF viewer (streamed from the backend)
- AI Resume Lens (ownership arc, domain proximity, craft signals, trajectory, HM flag, red-flag notes)
- Full field-match table for that candidate
- Escape-key and backdrop-click to close

### `lib/api.ts`
Typed thin wrapper around `fetch`. All types (`Session`, `CandidateResult`, `JdAnalysis`, etc.) and every backend endpoint are defined here. Import `api.*` anywhere in the app — no raw `fetch` calls outside this file.

---

## API Layer

The client communicates with one backend service. Portal calls attach the Supabase access token so roles, resumes, notes, and onboarding data are scoped to the authenticated workspace.

Key endpoints consumed:

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/sessions` | List all sessions |
| `POST` | `/api/sessions` | Create a new session |
| `GET` | `/api/sessions/:id` | Get session state |
| `POST` | `/api/sessions/:id/jd` | Analyze job description |
| `POST` | `/api/sessions/:id/resumes` | Upload resume PDFs |
| `POST` | `/api/sessions/:id/preview` | Start preview evaluation |
| `POST` | `/api/sessions/:id/preview/refine` | Refine rubric with instructions + feedback |
| `POST` | `/api/sessions/:id/preview/interpret` | Preview what a refinement will do |
| `POST` | `/api/sessions/:id/accept` | Lock rubric and start full eval |
| `GET` | `/api/sessions/:id/full-eval-status` | Poll background job progress |
| `PATCH` | `/api/sessions/:id/rubric` | Directly edit rubric fields |
| `PATCH` | `/api/sessions/:id/resumes/:file/mark-exemplar` | Toggle exemplar flag |
| `POST` | `/api/sessions/:id/rubric-from-exemplars` | Generate rubric from marked exemplars |

---

## Production Deployment

### Vercel (recommended)

1. Import this repository in the [Vercel dashboard](https://vercel.com/new)
2. Add environment variable:
   - `NEXT_PUBLIC_API_URL` → your deployed backend URL (e.g. `https://ats-backend-production-89fc.up.railway.app`)
3. Deploy

Vercel auto-detects Next.js — no additional configuration needed.

### Self-hosted

```bash
npm run build
npm run start          # listens on port 3000 by default
# or
PORT=8080 npm run start
```

The app is a standard Node.js server. Put it behind Nginx or any reverse proxy.

---

## Related Repositories

| Repo | Description |
|---|---|
| [ats-backend](https://github.com/rish106-hub/ats-backend) | FastAPI backend — AI evaluation engine, resume parsing, session management |

---

## License

Private — all rights reserved.
