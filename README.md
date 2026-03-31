# ATS Frontend

Next.js frontend for the ATS Prompt Lab. Multi-step wizard for AI-powered resume shortlisting with iterative criteria refinement and field-level scoring.

## Stack

- **Framework**: Next.js App Router + TypeScript
- **UI**: shadcn/ui + Tailwind CSS
- **API**: Connects to ATS Backend (FastAPI)

## Local Development

```bash
npm install
cp .env.example .env.local   # set NEXT_PUBLIC_API_URL=http://localhost:8000
npm run dev
```

Open http://localhost:3000. Requires [ATS Backend](https://github.com/rish106-hub/ats-backend) running on port 8000.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | FastAPI backend URL |

## Production Deployment

Deploy on [Vercel](https://vercel.com) (recommended for Next.js):

1. Import this repo in the Vercel dashboard
2. Add environment variable:
   - `NEXT_PUBLIC_API_URL` → your Railway backend public URL (e.g. `https://ats-backend-production.up.railway.app`)
3. Deploy

The backend must be deployed and reachable before the frontend can function.

## How It Works

| Step | Action |
|------|--------|
| 1 | Paste a job description → AI extracts baseline skills + P0 signals |
| 2 | Upload PDF resumes → parsed into structured JSON |
| 3 | Preview loop: field-level scoring on 6 resumes, add include/exclude params, AI synthesizes all into refined rubric. Repeat. |
| 4 | Accept → full evaluation runs on all resumes |
