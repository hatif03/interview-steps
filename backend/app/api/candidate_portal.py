from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from app.deps.auth import require_candidate
from app.schemas.profiles import ApplyFormData
from app.supabase_repo import get_db

router = APIRouter()


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@router.get("/applications")
async def list_my_applications(user: dict = Depends(require_candidate)):
    db = get_db()
    candidates = db.query("candidates", filters=[("user_id", "eq", user["id"])], order_by="created_at", order_desc=True)
    applications = []
    for c in candidates.data:
        job_result = db.get_by_id("jobs", c["job_id"])
        job = job_result.data[0] if job_result.data else {}
        score_result = db.query("scores", filters=[("candidate_id", "eq", c["id"])])
        score = score_result.data[0] if score_result.data else None
        company_name = None
        if job.get("recruiter_id"):
            rp = db.get_by_field("recruiter_profiles", "user_id", job["recruiter_id"])
            if rp.data:
                company_name = rp.data[0].get("company_name")
        applications.append({
            "candidate_id": c["id"],
            "job_id": c["job_id"],
            "job_title": job.get("title", "Unknown"),
            "company_name": company_name,
            "pipeline_stage": c.get("pipeline_stage"),
            "status_message": c.get("status_message"),
            "source": c.get("source", "upload"),
            "applied_at": c.get("applied_at") or c.get("created_at"),
            "composite_score": score.get("composite_score") if score else None,
            "rank": score.get("rank") if score else None,
        })
    return {"applications": applications, "total": len(applications)}


@router.get("/interviews")
async def list_my_interviews(user: dict = Depends(require_candidate)):
    db = get_db()
    candidates = db.query("candidates", filters=[("user_id", "eq", user["id"])])
    candidate_ids = [c["id"] for c in candidates.data]
    if not candidate_ids:
        return {"interviews": [], "total": 0}

    all_interviews = []
    for cid in candidate_ids:
        rows = db.query("scheduled_interviews", filters=[("candidate_id", "eq", cid)])
        for row in rows.data:
            job_result = db.get_by_id("jobs", row["job_id"])
            job = job_result.data[0] if job_result.data else {}
            cand = next((c for c in candidates.data if c["id"] == cid), {})
            all_interviews.append({
                **row,
                "job_title": job.get("title"),
                "candidate_name": cand.get("name"),
            })

    all_interviews.sort(key=lambda x: x.get("scheduled_at", ""), reverse=True)
    return {"interviews": all_interviews, "total": len(all_interviews)}
