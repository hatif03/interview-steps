from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Depends

from app.schemas.mock_interview import RegisterUserRequest
from app.schemas.profiles import (
    RecruiterProfileUpdate,
    RecruiterProfileResponse,
    CandidateProfileUpdate,
    CandidateProfileResponse,
)
from app.supabase_repo import get_db
from app.database import verify_supabase_token
from app.deps.auth import get_current_user, require_recruiter, require_candidate
from typing import Optional
from fastapi import Header

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
    data = {k: v for k, v in body.model_dump(exclude_unset=True).items() if v is not None}
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
    data = {k: v for k, v in body.model_dump(exclude_unset=True).items() if v is not None}
    data["updated_at"] = _now_iso()
    db.upsert_by_key("candidate_profiles", "user_id", user["id"], data)
    result = db.get_by_field("candidate_profiles", "user_id", user["id"])
    row = result.data[0] if result.data else {"user_id": user["id"]}
    row["user_id"] = user["id"]
    if row.get("skills") is None:
        row["skills"] = []
    return CandidateProfileResponse(**row)
