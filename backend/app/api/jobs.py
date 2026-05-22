import re
import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from app.supabase_repo import get_db
from app.schemas.job import JobCreate, JobUpdate, JobResponse, SCORING_PRESETS
from app.schemas.profiles import DEFAULT_APPLY_FORM_CONFIG
from app.deps.auth import require_recruiter

router = APIRouter()


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _generate_slug(title: str) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")[:30]
    suffix = secrets.token_hex(3)
    return f"{base}-{suffix}" if base else suffix


def _enrich_job(row: dict, db) -> dict:
    row["candidate_count"] = db.count("candidates", filters=[("job_id", "eq", row["id"])])
    if row.get("recruiter_id"):
        rp = db.get_by_field("recruiter_profiles", "user_id", row["recruiter_id"])
        if rp.data:
            row["company_name"] = rp.data[0].get("company_name")
    return row


@router.post("", response_model=JobResponse)
async def create_job(job: JobCreate, user: dict = Depends(require_recruiter)):
    db = get_db()
    preset = "balanced"
    rp = db.get_by_field("recruiter_profiles", "user_id", user["id"])
    if rp.data:
        preset = rp.data[0].get("default_scoring_preset") or "balanced"

    weights = job.weight_config.model_dump()
    if not job.weight_config or all(v == SCORING_PRESETS["balanced"].get(k, 0) for k, v in weights.items()):
        weights = SCORING_PRESETS.get(preset, SCORING_PRESETS["balanced"])

    data = {
        "title": job.title,
        "description": job.description,
        "weight_config": weights,
        "recruiter_id": user["id"],
        "apply_enabled": job.apply_enabled,
        "apply_form_config": job.apply_form_config or DEFAULT_APPLY_FORM_CONFIG,
        "status": job.status,
        "location": job.location,
        "job_type": job.job_type,
    }
    if job.apply_enabled:
        data["apply_slug"] = _generate_slug(job.title)

    result = db.insert("jobs", data)
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create job")
    row = _enrich_job(result.data[0], db)
    return JobResponse(**row)


@router.get("", response_model=list[JobResponse])
async def list_jobs(user: dict = Depends(require_recruiter)):
    db = get_db()
    result = db.query("jobs", order_by="created_at", order_desc=True)
    jobs = []
    for row in result.data:
        rid = row.get("recruiter_id")
        if rid and rid != user["id"]:
            continue
        jobs.append(JobResponse(**_enrich_job(row, db)))
    return jobs


@router.get("/{job_id}", response_model=JobResponse)
async def get_job(job_id: str, user: dict = Depends(require_recruiter)):
    db = get_db()
    result = db.get_by_id("jobs", job_id)
    if not result.data:
        raise HTTPException(status_code=404, detail="Job not found")
    row = result.data[0]
    rid = row.get("recruiter_id")
    if rid and rid != user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    return JobResponse(**_enrich_job(row, db))


@router.put("/{job_id}", response_model=JobResponse)
async def update_job(job_id: str, job: JobUpdate, user: dict = Depends(require_recruiter)):
    db = get_db()
    existing = db.get_by_id("jobs", job_id)
    if not existing.data:
        raise HTTPException(status_code=404, detail="Job not found")
    row = existing.data[0]
    if row.get("recruiter_id") and row["recruiter_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")

    data = {k: v for k, v in job.model_dump(exclude_unset=True, exclude={"regenerate_slug"}).items() if v is not None}
    if job.weight_config:
        data["weight_config"] = job.weight_config.model_dump()
    if job.regenerate_slug:
        data["apply_slug"] = _generate_slug(row.get("title", "job"))
    if job.apply_enabled is True and not row.get("apply_slug") and "apply_slug" not in data:
        data["apply_slug"] = _generate_slug(row.get("title", "job"))

    db.update("jobs", job_id, data)
    result = db.get_by_id("jobs", job_id)
    return JobResponse(**_enrich_job(result.data[0], db))


@router.delete("/{job_id}")
async def delete_job(job_id: str, user: dict = Depends(require_recruiter)):
    db = get_db()
    existing = db.get_by_id("jobs", job_id)
    if not existing.data:
        raise HTTPException(status_code=404, detail="Job not found")
    row = existing.data[0]
    if row.get("recruiter_id") and row["recruiter_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    db.delete_where("candidates", "job_id", job_id)
    db.delete("jobs", job_id)
    return {"status": "deleted"}
