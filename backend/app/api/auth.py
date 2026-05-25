from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form

from app.schemas.mock_interview import RegisterUserRequest
from app.schemas.profiles import (
    RecruiterProfileUpdate,
    RecruiterProfileResponse,
    CandidateProfileUpdate,
    CandidateProfileResponse,
    ResumeParseResponse,
)
from app.supabase_repo import get_db
from app.deps.auth import get_current_user, require_recruiter, require_candidate
from app.services.resume_service import extract_text_from_pdf, get_resume_pdf_bytes
from app.services.resume_parser import extract_profile_from_resume_text
from app.services.resume_storage import upload_resume_pdf
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@router.post("/register")
async def register_user(body: RegisterUserRequest):
    db = get_db()
    db.upsert("users", body.uid, {
        "email": body.email.lower(),
        "name": body.name,
        "role": body.role,
    })

    if body.role == "candidate":
        candidates = db.query("candidates", filters=[("email", "eq", body.email.lower())])
        for c in candidates.data:
            db.update("candidates", c["id"], {"user_id": body.uid})
        db.upsert_by_key("candidate_profiles", "user_id", body.uid, {})
    elif body.role == "recruiter":
        db.upsert_by_key("recruiter_profiles", "user_id", body.uid, {})

    return {"success": True, "uid": body.uid, "role": body.role}


@router.get("/me")
async def get_me(user: dict = Depends(get_current_user)):
    return user


@router.post("/link-candidate")
async def link_candidate(user: dict = Depends(get_current_user)):
    email = (user.get("email") or "").lower()
    if not email:
        raise HTTPException(status_code=400, detail="Email required")

    db = get_db()
    candidates = db.query("candidates", filters=[("email", "eq", email)])
    linked = 0
    for c in candidates.data:
        db.update("candidates", c["id"], {"user_id": user["id"]})
        linked += 1

    return {"linked": linked, "email": email}


@router.get("/recruiter-profile", response_model=RecruiterProfileResponse)
async def get_recruiter_profile(user: dict = Depends(require_recruiter)):
    db = get_db()
    result = db.get_by_field("recruiter_profiles", "user_id", user["id"])
    if not result.data:
        return RecruiterProfileResponse(user_id=user["id"], onboarding_completed=False)
    row = result.data[0]
    row["user_id"] = user["id"]
    return RecruiterProfileResponse(**row)


@router.put("/recruiter-profile", response_model=RecruiterProfileResponse)
async def update_recruiter_profile(body: RecruiterProfileUpdate, user: dict = Depends(require_recruiter)):
    db = get_db()
    data = body.model_dump(exclude_unset=True)
    data["updated_at"] = _now_iso()
    db.upsert_by_key("recruiter_profiles", "user_id", user["id"], data)
    result = db.get_by_field("recruiter_profiles", "user_id", user["id"])
    row = result.data[0] if result.data else {"user_id": user["id"]}
    row["user_id"] = user["id"]
    return RecruiterProfileResponse(**row)


@router.get("/candidate-profile", response_model=CandidateProfileResponse)
async def get_candidate_profile(user: dict = Depends(require_candidate)):
    db = get_db()
    result = db.get_by_field("candidate_profiles", "user_id", user["id"])
    if not result.data:
        return CandidateProfileResponse(user_id=user["id"], onboarding_completed=False)
    row = result.data[0]
    row["user_id"] = user["id"]
    if row.get("skills") is None:
        row["skills"] = []
    return CandidateProfileResponse(**row)


@router.put("/candidate-profile", response_model=CandidateProfileResponse)
async def update_candidate_profile(body: CandidateProfileUpdate, user: dict = Depends(require_candidate)):
    db = get_db()
    data = body.model_dump(exclude_unset=True)
    data["updated_at"] = _now_iso()
    db.upsert_by_key("candidate_profiles", "user_id", user["id"], data)
    result = db.get_by_field("candidate_profiles", "user_id", user["id"])
    row = result.data[0] if result.data else {"user_id": user["id"]}
    row["user_id"] = user["id"]
    if row.get("skills") is None:
        row["skills"] = []
    return CandidateProfileResponse(**row)


def _upload_resume_file(user_id: str, filename: str, content: bytes) -> str:
    try:
        return upload_resume_pdf(user_id, filename, content)
    except Exception as exc:
        logger.error("Resume storage upload failed: %s", exc)
        raise HTTPException(
            status_code=500,
            detail="Failed to store resume. Ensure the Supabase 'resumes' storage bucket exists.",
        ) from exc


@router.post("/parse-resume", response_model=ResumeParseResponse)
async def parse_resume(
    user: dict = Depends(require_candidate),
    file: UploadFile | None = File(None),
    resume_url: str | None = Form(None),
):
    url = (resume_url or "").strip() or None
    file_bytes: bytes | None = None
    stored_url: str | None = None

    if file and file.filename:
        file_bytes = await file.read()
        if not file_bytes:
            raise HTTPException(status_code=400, detail="Uploaded file is empty")
        if not (file.filename.lower().endswith(".pdf") or (file.content_type or "").endswith("pdf")):
            raise HTTPException(status_code=400, detail="Resume must be a PDF file")
        stored_url = _upload_resume_file(user["id"], file.filename, file_bytes)

    if not file_bytes and not url:
        raise HTTPException(status_code=400, detail="Provide a resume PDF upload or a resume URL")

    pdf_bytes = await get_resume_pdf_bytes(url=url if not file_bytes else None, file_bytes=file_bytes)
    if not pdf_bytes:
        raise HTTPException(status_code=400, detail="Could not read resume PDF. Check the link or upload a PDF.")

    resume_text = extract_text_from_pdf(pdf_bytes)
    if not resume_text.strip():
        raise HTTPException(status_code=400, detail="No text could be extracted from the resume PDF")

    extracted = extract_profile_from_resume_text(resume_text)

    if not stored_url and url:
        stored_url = url

    db = get_db()
    profile_data = {
        "resume_text": resume_text,
        "updated_at": _now_iso(),
    }
    if stored_url:
        profile_data["resume_url"] = stored_url
    db.upsert_by_key("candidate_profiles", "user_id", user["id"], profile_data)

    return ResumeParseResponse(
        resume_text=resume_text,
        resume_url=stored_url,
        extracted=extracted,
    )
