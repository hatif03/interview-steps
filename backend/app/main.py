import asyncio
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.api import jobs, candidates, evaluations, tests, interviews, mock_interviews, auth, public, candidate_portal, assessments, tasks


class _SuppressReloadNoise(logging.Filter):
    """Hide CancelledError/KeyboardInterrupt tracebacks during uvicorn --reload on Windows."""

    def filter(self, record: logging.LogRecord) -> bool:
        if record.exc_info and record.exc_info[0] in (asyncio.CancelledError, KeyboardInterrupt):
            return False
        return True


for _logger_name in ("uvicorn.error", "uvicorn"):
    logging.getLogger(_logger_name).addFilter(_SuppressReloadNoise())

app = FastAPI(
    title="Interview Steps",
    description="Candidate screening, pipeline management, and automated AI interviews",
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
app.include_router(mock_interviews.router, prefix="/api/mock-interviews", tags=["AI Interviews"])
app.include_router(assessments.router, prefix="/api/assessments", tags=["Assessments"])
app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])
app.include_router(public.router, prefix="/api/public", tags=["Public"])
app.include_router(candidate_portal.router, prefix="/api/candidate", tags=["Candidate Portal"])
app.include_router(tasks.router, prefix="/api/tasks", tags=["Tasks"])


@app.get("/api/health")
def health_check():
    from app.tasks.queue import _get_redis_queue

    queue = _get_redis_queue()
    return {
        "status": "healthy",
        "version": "2.0.0",
        "database": "supabase",
        "task_queue": "rq" if queue else "thread",
    }
