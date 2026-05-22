from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from app.deps.auth import require_candidate
from app.schemas.profiles import ApplyFormData
from app.supabase_repo import get_db

router = APIRouter()


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@router.get("/jobs/{slug}")
async def get_public_job(slug: str):
    db = get_db()
    result = db.query("jobs", filters=[("apply_slug", "eq", slug)])
    if not result.data:
        raise HTTPException(status_code=404, detail="Job not found")
    job = result.data[0]
    if not job.get("apply_enabled"):
        raise HTTPException(status_code=404, detail="Applications not enabled for this job")
    if job.get("status") == "closed":
        raise HTTPException(status_code=410, detail="This job is no longer accepting applications")

    company_name = None
    if job.get("recruiter_id"):
        rp = db.get_by_field("recruiter_profiles", "user_id", job["recruiter_id"])
        if rp.data:
            company_name = rp.data[0].get("company_name")

    return {
        "slug": slug,
        "title": job["title"],
        "description": job["description"],
        "location": job.get("location"),
        "job_type": job.get("job_type"),
        "company_name": company_name,
        "apply_form_config": job.get("apply_form_config") or {},
        "status": job.get("status"),
    }


@router.post("/jobs/{slug}/apply")
async def apply_to_job(
    slug: str,
    body: ApplyFormData,
    background_tasks: BackgroundTasks,
    user: dict = Depends(require_candidate),
):
    db = get_db()
    result = db.query("jobs", filters=[("apply_slug", "eq", slug)])
    if not result.data:
        raise HTTPException(status_code=404, detail="Job not found")
    job = result.data[0]
    if not job.get("apply_enabled") or job.get("status") == "closed":
        raise HTTPException(status_code=400, detail="Job is not accepting applications")

    cp = db.get_by_field("candidate_profiles", "user_id", user["id"])
    profile = cp.data[0] if cp.data else {}

    if not profile.get("onboarding_completed"):
        raise HTTPException(status_code=400, detail="Complete onboarding before applying")

    email = user["email"].lower()
    existing = db.query(
        "candidates",
        filters=[("job_id", "eq", job["id"]), ("email", "eq", email)],
    )
    if existing.data:
        raise HTTPException(status_code=409, detail="You have already applied to this job")

    name = user.get("name") or profile.get("name") or email.split("@")[0]
    candidate_data = {
        "job_id": job["id"],
        "name": name,
        "email": email,
        "college": body.college or profile.get("college", ""),
        "branch": body.branch or profile.get("branch", ""),
        "cgpa": body.cgpa if body.cgpa is not None else profile.get("cgpa"),
        "best_ai_project": body.best_ai_project or profile.get("best_ai_project", ""),
        "research_work": body.research_work or profile.get("research_work", ""),
        "github_url": body.github_url or profile.get("github_url", ""),
        "resume_url": body.resume_url or profile.get("resume_url", ""),
        "resume_text": profile.get("resume_text"),
        "user_id": user["id"],
        "source": "form",
        "applied_at": _now_iso(),
        "pipeline_stage": "uploaded",
        "status_message": "Application submitted",
    }

    insert_result = db.insert("candidates", candidate_data)
    if not insert_result.data:
        raise HTTPException(status_code=500, detail="Failed to submit application")

    candidate = insert_result.data[0]

    try:
        from app.services.resume_service import process_resumes_for_job
        background_tasks.add_task(process_resumes_for_job, job["id"])
    except Exception:
        pass

    return {
        "success": True,
        "candidate_id": candidate["id"],
        "job_title": job["title"],
    }
