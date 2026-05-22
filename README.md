# AI Candidate Screening & Mock Interview Platform

An AI-powered recruitment pipeline with resume screening, explainable scoring, personalized voice mock interviews, and dual portals for recruiters and candidates.

## Features

### Recruiter screening pipeline
- Multi-sheet Excel upload with intelligent test-sheet detection
- Resume processing from Google Drive PDF links
- AI evaluation (Gemini/Groq/DeepSeek/Qwen) with structured JSON + semantic embeddings
- GitHub analysis, statistical ranking, fuzzy name matching for test scores
- Automated SMTP emails and Jitsi/Calendar interview scheduling
- Real-time pipeline Kanban and score breakdown tooltips

### Mock interviews
- **Personalized questions** from job description + candidate resume + prior evaluation
- **Voice interviews** via browser Web Speech API (Chrome/Edge) — no Vapi or paid voice APIs
- **Multi-model LLM** fallback: Groq (Llama/Gemma), DeepSeek, Qwen, Gemini
- **Structured feedback** with category scores, strengths, and improvement areas
- **Candidate portal** at `/candidate` with Supabase Auth
- **Recruiter review** of mock interview feedback on candidate detail pages

## Tech Stack

- **Frontend**: Next.js 16 + React 19 + Supabase Auth + Tailwind + shadcn/ui
- **Backend**: FastAPI (Python 3.11+)
- **Database**: Supabase PostgreSQL (via `supabase-py` service role)
- **LLM**: LiteLLM with task-specific chains (screening, generate, turn, feedback)
- **Embeddings**: Google GenAI (`gemini-embedding-001`)
- **Voice**: Web Speech API (STT/TTS) + Groq-powered dialogue

## Quick Start

### Prerequisites

- Python 3.11+, Node.js 20+
- Supabase project (free tier)
- API keys: Gemini, Groq (recommended), DeepSeek/Qwen (optional)

### Supabase setup

1. Create a project at [supabase.com](https://supabase.com)
2. Run the SQL migration in [`supabase/migrations/001_initial_schema.sql`](supabase/migrations/001_initial_schema.sql) via the SQL Editor
3. Enable **Google** under Authentication → Providers; add redirect URL `http://localhost:3000/auth/callback`
4. Copy **Project URL**, **anon key**, and **service_role key** to env files (see `.env.example`)

Full steps: [`supabase/README.md`](supabase/README.md)

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate          # Windows
pip install -r requirements.txt
cp .env.example .env           # fill in Supabase + API keys
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env.local     # fill in API URL + Supabase keys
npm run dev
```

- Recruiter dashboard: http://localhost:3000
- Recruiter sign-in: http://localhost:3000/sign-in
- Candidate portal: http://localhost:3000/candidate

## Workflow

1. **Recruiter** creates job → uploads candidates → runs AI evaluation → ranks
2. **Recruiter** assigns mock interviews (optional email invite)
3. **Candidate** signs up at `/candidate/sign-up` with invitation email
4. **Candidate** takes voice mock interview → receives AI feedback
5. **Recruiter** reviews feedback on candidate detail page
6. Continue pipeline: test emails → results upload → schedule live Jitsi interview

## Environment Variables

See [`backend/.env.example`](backend/.env.example) and [`frontend/.env.example`](frontend/.env.example).

Key backend vars: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GROQ_API_KEY`, `GEMINI_API_KEY`

Key frontend vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_API_URL`

## Deployment

- **Backend**: Render (Docker) — set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
- **Frontend**: Vercel — set `NEXT_PUBLIC_SUPABASE_*` + `NEXT_PUBLIC_API_URL`
- **Database**: apply migrations from `supabase/migrations/`

## Reference

The original Vapi-based tutorial project is archived at [`ai_mock_interviews-main/`](ai_mock_interviews-main/ARCHIVED.md).
