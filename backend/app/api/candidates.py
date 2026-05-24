import io
import re
import logging
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
import pandas as pd
from app.supabase_repo import get_db
from app.schemas.candidate import CandidateResponse, CandidateListResponse, PipelineStageUpdate
from app.tasks.queue import enqueue_task

logger = logging.getLogger(__name__)

router = APIRouter()

PIPELINE_STAGES = [
    "uploaded",
    "resume_processed",
    "evaluating",
    "evaluated",
    "ranked",
    "assessment_assigned",
    "assessment_completed",
    "test_sent",
    "test_completed",
    "shortlisted",
    "ai_interview_assigned",
    "ai_interview_completed",
    "mock_interview_assigned",
    "mock_interview_completed",
    "interview_scheduled",
    "error",
]

# Exclude resume_text — can be megabytes per candidate and is not needed for list views.
CANDIDATE_LIST_COLUMNS = (
    "id,job_id,s_no,name,email,college,branch,cgpa,best_ai_project,research_work,"
    "github_url,resume_url,pipeline_stage,status_message,user_id,created_at"
)

CANDIDATE_STATUS_COLUMNS = (
    "id,job_id,name,email,pipeline_stage,status_message,created_at"
)


@router.post("/upload")
async def upload_candidates(
    file: UploadFile = File(...),
    job_id: str = Form(...),
):
    if not file.filename.endswith((".csv", ".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="File must be CSV or Excel format")

    contents = await file.read()
    test_scores_df = None

    if file.filename.endswith(".csv"):
        df = pd.read_csv(io.BytesIO(contents))
    else:
        xl = pd.ExcelFile(io.BytesIO(contents))
        logger.info(f"Candidate upload sheets: {xl.sheet_names}")
        df = xl.parse(0)
        found_sheets = []
        for sheet_name in xl.sheet_names:
            sheet_df = xl.parse(sheet_name)
            cols = [c.strip().lower().replace(" ", "_") for c in sheet_df.columns]
            if "test_la" in cols or "test_code" in cols:
                found_sheets.append((sheet_name, sheet_df, cols))
                logger.info(f"Sheet '{sheet_name}' has test columns: {cols}")
        if found_sheets:
            chosen = found_sheets[-1] if len(found_sheets) > 1 else found_sheets[0]
            test_scores_df = chosen[1]
            test_scores_df.columns = chosen[2]
            logger.info(f"Using sheet '{chosen[0]}' for test scores ({len(test_scores_df)} rows)")

    column_map = {
        "s_no": "s_no",
        "name": "name",
        "email": "email",
        "college": "college",
        "branch": "branch",
        "cgpa": "cgpa",
        "best_ai_project": "best_ai_project",
        "research_work": "research_work",
        "github": "github_url",
        "github_profile": "github_url",
        "resume": "resume_url",
        "resume_link": "resume_url",
        "test_la": "test_la",
        "test_code": "test_code",
    }

    df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]
    df = df.rename(columns={k: v for k, v in column_map.items() if k in df.columns})

    if test_scores_df is not None:
        test_lookup = {}
        for _, trow in test_scores_df.iterrows():
            key_email = str(trow.get("email", "")).strip().lower()
            key_name = str(trow.get("name", "")).strip().lower()
            tla = trow.get("test_la")
            tco = trow.get("test_code")
            entry = {}
            if pd.notna(tla):
                try:
                    entry["test_la"] = float(tla)
                except (ValueError, TypeError):
                    pass
            if pd.notna(tco):
                try:
                    entry["test_code"] = float(tco)
                except (ValueError, TypeError):
                    pass
            if entry:
                if key_email:
                    test_lookup[("email", key_email)] = entry
                if key_name:
                    test_lookup[("name", key_name)] = entry

    db = get_db()
    candidates_created = []
    test_inserted = 0

    for _, row in df.iterrows():
        candidate_data = {
            "job_id": job_id,
            "s_no": int(row.get("s_no", 0)) if pd.notna(row.get("s_no")) else None,
            "name": str(row.get("name", "")),
            "email": str(row.get("email", "")),
            "college": str(row.get("college", "")) if pd.notna(row.get("college")) else None,
            "branch": str(row.get("branch", "")) if pd.notna(row.get("branch")) else None,
            "cgpa": float(row["cgpa"]) if pd.notna(row.get("cgpa")) else None,
            "best_ai_project": str(row.get("best_ai_project", "")) if pd.notna(row.get("best_ai_project")) else None,
            "research_work": str(row.get("research_work", "")) if pd.notna(row.get("research_work")) else None,
            "github_url": str(row.get("github_url", "")) if pd.notna(row.get("github_url")) else None,
            "resume_url": str(row.get("resume_url", "")) if pd.notna(row.get("resume_url")) else None,
            "pipeline_stage": "uploaded",
            "status_message": "Uploaded, awaiting processing",
        }
        result = db.insert("candidates", candidate_data)
        if result.data:
            candidates_created.append(result.data[0])
            cid = result.data[0]["id"]
            test_entry = None

            if test_scores_df is not None:
                raw_name = str(row.get("name", "")).strip()
                name_key = re.sub(r"\s+", " ", raw_name.lower()).strip()
                test_entry = test_lookup.get(("name", name_key))
                if not test_entry:
                    norm_key = re.sub(r"[.\-_,;:'\"]", " ", name_key)
                    norm_key = re.sub(r"\s+", " ", norm_key).strip()
                    test_entry = test_lookup.get(("name", norm_key))
            else:
                te = {}
                tla = row.get("test_la")
                tco = row.get("test_code")
                if tla is not None and pd.notna(tla):
                    try:
                        te["test_la"] = float(tla)
                    except (ValueError, TypeError):
                        pass
                if tco is not None and pd.notna(tco):
                    try:
                        te["test_code"] = float(tco)
                    except (ValueError, TypeError):
                        pass
                if te:
                    test_entry = te

            if test_entry:
                test_data = {"candidate_id": cid, "job_id": job_id, **test_entry}
                db.upsert("test_results", cid, test_data)
                test_inserted += 1
                logger.info(f"Inserted test scores for {candidate_data['name']}: {test_entry}")

    logger.info(f"Created {len(candidates_created)} candidates, {test_inserted} with test scores")
    task = enqueue_task("process_resumes", job_id)

    return {
        "message": f"Uploaded {len(candidates_created)} candidates",
        "count": len(candidates_created),
        "job_id": job_id,
        **task,
    }


@router.get("", response_model=CandidateListResponse)
def list_candidates(
    job_id: str = None,
    stage: str = None,
    limit: int = 100,
    offset: int = 0,
    summary: bool = False,
    include_scores: bool = True,
):
    db = get_db()
    filters = []
    if job_id:
        filters.append(("job_id", "eq", job_id))
    if stage:
        filters.append(("pipeline_stage", "eq", stage))
    result = db.query(
        "candidates",
        columns=CANDIDATE_STATUS_COLUMNS if summary else CANDIDATE_LIST_COLUMNS,
        filters=filters or None,
        order_by="created_at",
        limit=limit,
        offset=offset,
    )

    scores_map: dict[str, dict] = {}
    if include_scores and result.data:
        candidate_ids = [row["id"] for row in result.data]
        scores_map = db.get_candidate_with_scores(candidate_ids)

    candidates = []
    for row in result.data:
        row["scores"] = scores_map.get(row["id"]) if include_scores else None
        candidates.append(CandidateResponse(**row))

    return CandidateListResponse(candidates=candidates, total=result.count or len(candidates))


@router.get("/pipeline/summary")
def pipeline_summary(job_id: str):
    db = get_db()
    rows = db.query(
        "candidates",
        columns="pipeline_stage",
        filters=[("job_id", "eq", job_id)],
    )
    summary = {stage: 0 for stage in PIPELINE_STAGES}
    for row in rows.data:
        stage = row.get("pipeline_stage")
        if stage in summary:
            summary[stage] += 1
    return {"job_id": job_id, "stages": summary}


@router.put("/pipeline-stage")
async def update_pipeline_stage(update: PipelineStageUpdate):
    if update.stage not in PIPELINE_STAGES:
        raise HTTPException(status_code=400, detail=f"Invalid stage. Must be one of: {PIPELINE_STAGES}")
    db = get_db()
    for cid in update.candidate_ids:
        db.update("candidates", cid, {"pipeline_stage": update.stage})
    return {"message": f"Updated {len(update.candidate_ids)} candidates to stage '{update.stage}'"}


@router.post("/process-resumes")
def trigger_resume_processing(job_id: str):
    return enqueue_task("process_resumes", job_id)


@router.post("/analyze-github")
def trigger_github_analysis(job_id: str):
    return enqueue_task("analyze_github", job_id)


@router.post("/{candidate_id}/retry-resume")
def retry_resume(candidate_id: str):
    db = get_db()
    result = db.get_by_id("candidates", candidate_id)
    if not result.data:
        raise HTTPException(status_code=404, detail="Candidate not found")
    return enqueue_task("retry_resume", candidate_id)


@router.post("/{candidate_id}/retry-evaluation")
def retry_evaluation(candidate_id: str):
    db = get_db()
    result = db.get_by_id("candidates", candidate_id)
    if not result.data:
        raise HTTPException(status_code=404, detail="Candidate not found")
    return enqueue_task("retry_evaluation", candidate_id)


@router.delete("/{candidate_id}")
async def delete_candidate(candidate_id: str):
    db = get_db()
    db.delete_where("evaluations", "candidate_id", candidate_id)
    db.delete_where("scores", "candidate_id", candidate_id)
    db.delete("test_results", candidate_id)
    db.delete_where("scheduled_interviews", "candidate_id", candidate_id)
    db.delete_where("email_logs", "candidate_id", candidate_id)
    db.delete("candidates", candidate_id)
    return {"status": "deleted"}


@router.get("/{candidate_id}", response_model=CandidateResponse)
async def get_candidate(candidate_id: str):
    db = get_db()
    result = db.get_by_id("candidates", candidate_id)
    if not result.data:
        raise HTTPException(status_code=404, detail="Candidate not found")
    row = result.data[0]
    score_result = db.query("scores", filters=[("candidate_id", "eq", candidate_id)])
    row["scores"] = score_result.data[0] if score_result.data else None
    return CandidateResponse(**row)
