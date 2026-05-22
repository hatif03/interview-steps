from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.api import jobs, candidates, evaluations, tests, interviews, mock_interviews, auth

app = FastAPI(
    title="AI Candidate Screening Platform",
    description="AI-powered recruitment pipeline with mock voice interviews",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(jobs.router, prefix="/api/jobs", tags=["Jobs"])
app.include_router(candidates.router, prefix="/api/candidates", tags=["Candidates"])
app.include_router(evaluations.router, prefix="/api/evaluations", tags=["Evaluations"])
app.include_router(tests.router, prefix="/api/tests", tags=["Tests"])
app.include_router(interviews.router, prefix="/api/interviews", tags=["Interviews"])
app.include_router(mock_interviews.router, prefix="/api/mock-interviews", tags=["Mock Interviews"])
app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])


@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "version": "2.0.0", "database": "supabase"}
