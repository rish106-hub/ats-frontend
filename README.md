# ATS Frontend

Next.js frontend for the ATS Prompt Lab. Multi-step wizard for AI-powered resume shortlisting with iterative criteria refinement and field-level scoring.

## Stack

- **Framework**: Next.js App Router + TypeScript
- **UI**: shadcn/ui + Tailwind CSS
- **API**: Connects to ATS Backend (FastAPI)

## Setup

```bash
npm install
cp .env.example .env.local   # set NEXT_PUBLIC_API_URL=http://localhost:8000
npm run dev
```

Open http://localhost:3000. Requires ATS Backend running on port 8000.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | FastAPI backend URL |
