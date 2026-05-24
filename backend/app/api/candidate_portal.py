from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from app.deps.auth import require_candidate
from app.services.hiring_rounds_service import get_rounds_for_candidate, is_candidate_eliminated, elimination_message
from app.services import assessment_service as assessment_svc
from app.supabase_repo import get_db

router = APIRouter()


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _enrich_round(round_row: dict) -> dict:
    db = get_db()
    ref = round_row.get("reference_id")
    rtype = round_row.get("round_type")
    detail = {}

    if rtype == "platform_test" and ref:
        assignment = assessment_svc.get_assignment(str(ref), include_answers=True)
        if assignment:
            detail = {
                "assignment": assignment,
                "section_scores": (assignment.get("result") or {}).get("section_scores"),
                "review": (assignment.get("result") or {}).get("review"),
            }
    elif rtype == "ai_interview" and ref:
        iv = db.get_by_id("mock_interviews", str(ref))
        fb = db.query("mock_feedback", filters=[("interview_id", "eq", str(ref))])
        detail = {
            "interview": iv.data[0] if iv.data else None,
            "feedback": fb.data[0] if fb.data else None,
        }
    elif rtype == "live_interview" and ref:
        si = db.get_by_id("scheduled_interviews", str(ref))
        detail = {"interview": si.data[0] if si.data else None}

    return {**round_row, "detail": detail}


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

        rounds = get_rounds_for_candidate(c["id"], c["job_id"])
        latest = rounds[-1] if rounds else None
        eliminated = is_candidate_eliminated(c["id"], c["job_id"])
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
            "current_round": latest.get("round_type") if latest else None,
            "latest_outcome": latest.get("outcome") if latest else None,
            "is_eliminated": eliminated,
            "elimination_message": elimination_message(c["id"], c["job_id"]) if eliminated else None,
        })
    return {"applications": applications, "total": len(applications)}


@router.get("/applications/{candidate_id}/rounds")
async def get_application_rounds(candidate_id: str, user: dict = Depends(require_candidate)):
    db = get_db()
    candidate = db.get_by_id("candidates", candidate_id)
    if not candidate.data:
        raise HTTPException(status_code=404, detail="Application not found")
    c = candidate.data[0]
    if c.get("user_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Not your application")

    job = db.get_by_id("jobs", c["job_id"]).data[0]
    rounds = get_rounds_for_candidate(candidate_id, c["job_id"])
    enriched = [_enrich_round(r) for r in rounds]

    return {
        "candidate_id": candidate_id,
        "job_id": c["job_id"],
        "job_title": job.get("title"),
        "pipeline_stage": c.get("pipeline_stage"),
        "status_message": c.get("status_message"),
        "is_eliminated": is_candidate_eliminated(candidate_id, c["job_id"]),
        "elimination_message": elimination_message(candidate_id, c["job_id"]),
        "rounds": enriched,
    }


@router.get("/assessments")
async def list_my_assessments(user: dict = Depends(require_candidate)):
    assignments = assessment_svc.get_assignments_for_user(user["id"], user.get("email"))
    return {"assignments": assignments, "total": len(assignments)}


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
