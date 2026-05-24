"""RQ worker entrypoints — must be importable top-level callables."""

from __future__ import annotations

import asyncio


def _run(coro):
    return asyncio.run(coro)


def process_resumes(job_id: str) -> dict:
    from app.services.resume_service import process_resumes_for_job

    _run(process_resumes_for_job(job_id))
    return {"job_id": job_id, "type": "process_resumes"}


def run_evaluations(job_id: str, candidate_ids: list[str] | None = None) -> dict:
    from app.services.evaluation_service import run_evaluation_pipeline

    _run(run_evaluation_pipeline(job_id, candidate_ids))
    return {"job_id": job_id, "type": "evaluations", "candidate_ids": candidate_ids}


def analyze_github(job_id: str) -> dict:
    from app.services.github_service import analyze_github_for_job

    _run(analyze_github_for_job(job_id))
    return {"job_id": job_id, "type": "github"}


def compute_rankings(job_id: str) -> dict:
    from app.services.scoring_engine import compute_rankings as _compute

    return _run(_compute(job_id))


def retry_resume(candidate_id: str) -> dict:
    from app.services.resume_service import process_single_resume
    from app.supabase_repo import get_db

    db = get_db()
    result = db.get_by_id("candidates", candidate_id)
    if not result.data:
        raise ValueError("Candidate not found")
    candidate = result.data[0]

    db.update(
        "candidates",
        candidate_id,
        {"pipeline_stage": "uploaded", "status_message": "Retrying resume processing..."},
    )
    try:
        updates = _run(process_single_resume(candidate))
        db.update("candidates", candidate_id, updates)
    except Exception as e:
        db.update(
            "candidates",
            candidate_id,
            {"pipeline_stage": "error", "status_message": f"Resume retry failed: {e}"},
        )
        raise
    return {"candidate_id": candidate_id, "type": "retry_resume"}


def retry_evaluation(candidate_id: str) -> dict:
    from app.services.evaluation_service import run_evaluation_pipeline
    from app.supabase_repo import get_db

    db = get_db()
    result = db.get_by_id("candidates", candidate_id)
    if not result.data:
        raise ValueError("Candidate not found")
    candidate = result.data[0]
    _run(run_evaluation_pipeline(candidate["job_id"], [candidate_id]))
    return {"candidate_id": candidate_id, "type": "retry_evaluation"}
