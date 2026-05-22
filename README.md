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

### Mock interviews (new)
- **Personalized questions** from job description + candidate resume + prior evaluation
- **Voice interviews** via browser Web Speech API (Chrome/Edge) — no Vapi or paid voice APIs
- **Multi-model LLM** fallback: Groq (Llama/Gemma), DeepSeek, Qwen, Gemini
- **Structured feedback** with category scores, strengths, and improvement areas
- **Candidate portal** at `/candidate` with Firebase Auth
- **Recruiter review** of mock interview feedback on candidate detail pages

## Tech Stack

- **Frontend**: Next.js 16 + React 19 + Firebase Auth + Tailwind + shadcn/ui
- **Backend**: FastAPI (Python 3.11+)
- **Database**: Firebase Firestore (via `firebase-admin`)
- **LLM**: LiteLLM with task-specific chains (screening, generate, turn, feedback)
- **Embeddings**: Google GenAI (`gemini-embedding-001`)
- **Voice**: Web Speech API (STT/TTS) + Groq-powered dialogue

## Quick Start

### Prerequisites

- Python 3.11+, Node.js 20+
- Firebase project with Firestore + Auth (email/password)
- API keys: Gemini, Groq (recommended), DeepSeek/Qwen (optional)

### Firebase setup

1. Create a project at [Firebase Console](https://console.firebase.google.com)
2. Enable **Firestore** and **Authentication** (email/password)
3. Generate a **service account key** → paste as `FIREBASE_CREDENTIALS_JSON` in backend `.env`
4. Add web app config → copy to `frontend/.env.local` (see `.env.example` files)
5. Deploy rules/indexes: `firebase deploy --only firestore` (requires Firebase CLI)

Schema reference: [`firebase/SCHEMA.md`](firebase/SCHEMA.md)

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate          # Windows
pip install -r requirements.txt
cp .env.example .env           # fill in Firebase + API keys
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env.local     # fill in API URL + Firebase web config
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

Key backend vars: `FIREBASE_PROJECT_ID`, `FIREBASE_CREDENTIALS_JSON`, `GROQ_API_KEY`, `GEMINI_API_KEY`, `DEEPSEEK_API_KEY`, `DASHSCOPE_API_KEY`

## Deployment

- **Backend**: Render (Docker) — set Firebase service account JSON as env var
- **Frontend**: Vercel — set `NEXT_PUBLIC_*` Firebase vars + `NEXT_PUBLIC_API_URL`
- **Firestore**: deploy rules from `firebase/` directory

## Reference

The original Vapi-based tutorial project is archived at [`ai_mock_interviews-main/`](ai_mock_interviews-main/ARCHIVED.md).
