from fastapi import APIRouter, HTTPException
from app.supabase_repo import get_db
from app.schemas.job import JobCreate, JobResponse

router = APIRouter()


@router.post("", response_model=JobResponse)
async def create_job(job: JobCreate):
    db = get_db()
    data = {
        "title": job.title,
        "description": job.description,
        "weight_config": job.weight_config.model_dump(),
    }
    result = db.insert("jobs", data)
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create job")
    row = result.data[0]
    row["candidate_count"] = 0
    return JobResponse(**row)


@router.get("", response_model=list[JobResponse])
async def list_jobs():
    db = get_db()
    result = db.query("jobs", order_by="created_at", order_desc=True)
    job_ids = [row["id"] for row in result.data]
    count_map: dict[str, int] = {}
    if job_ids:
        all_candidates = db.query("candidates", filters=[("job_id", "in", job_ids)])
        for c in all_candidates.data:
            count_map[c["job_id"]] = count_map.get(c["job_id"], 0) + 1
    jobs = []
    for row in result.data:
        row["candidate_count"] = count_map.get(row["id"], 0)
        jobs.append(JobResponse(**row))
    return jobs


@router.get("/{job_id}", response_model=JobResponse)
async def get_job(job_id: str):
    db = get_db()
    result = db.get_by_id("jobs", job_id)
    if not result.data:
        raise HTTPException(status_code=404, detail="Job not found")
    row = result.data[0]
    row["candidate_count"] = db.count("candidates", filters=[("job_id", "eq", job_id)])
    return JobResponse(**row)


@router.put("/{job_id}", response_model=JobResponse)
async def update_job(job_id: str, job: JobCreate):
    db = get_db()
    data = {
        "title": job.title,
        "description": job.description,
        "weight_config": job.weight_config.model_dump(),
    }
    existing = db.get_by_id("jobs", job_id)
    if not existing.data:
        raise HTTPException(status_code=404, detail="Job not found")
    db.update("jobs", job_id, data)
    result = db.get_by_id("jobs", job_id)
    row = result.data[0]
    row["candidate_count"] = db.count("candidates", filters=[("job_id", "eq", job_id)])
    return JobResponse(**row)


@router.delete("/{job_id}")
async def delete_job(job_id: str):
    db = get_db()
    db.delete_where("candidates", "job_id", job_id)
    db.delete("jobs", job_id)
    return {"status": "deleted"}
