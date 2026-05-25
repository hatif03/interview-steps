from typing import Optional

from fastapi import Depends, Header, HTTPException

from app.database import verify_supabase_token
from app.supabase_repo import get_db


async def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authorization token")
    token = authorization.split("Bearer ", 1)[1]
    try:
        decoded = verify_supabase_token(token)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

    uid = decoded.get("uid") or decoded.get("sub")
    db = get_db()
    user_result = db.get_by_id("users", uid)
    if user_result.data:
        return user_result.data[0]

    metadata_role = decoded.get("role")
    role = metadata_role if metadata_role in ("recruiter", "candidate") else "candidate"
    return {
        "id": uid,
        "email": decoded.get("email", ""),
        "name": decoded.get("name", decoded.get("email", "")),
        "role": role,
    }


async def require_recruiter(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "recruiter":
        raise HTTPException(status_code=403, detail="Recruiter access required")
    return user


async def require_candidate(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "candidate":
        raise HTTPException(status_code=403, detail="Candidate access required")
    return user


async def optional_user(authorization: Optional[str] = Header(None)) -> Optional[dict]:
    if not authorization or not authorization.startswith("Bearer "):
        return None
    try:
        return await get_current_user(authorization)
    except HTTPException:
        return None
