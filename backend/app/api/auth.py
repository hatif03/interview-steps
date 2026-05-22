from fastapi import APIRouter, HTTPException, Header
from typing import Optional
from app.schemas.mock_interview import RegisterUserRequest
from app.firestore_repo import get_db
from app.database import verify_firebase_token

router = APIRouter()


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
            db.update("candidates", c["id"], {"userId": body.uid})

    return {"success": True, "uid": body.uid, "role": body.role}


@router.get("/me")
async def get_me(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authorization token")

    token = authorization.split("Bearer ", 1)[1]
    try:
        decoded = verify_firebase_token(token)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

    uid = decoded.get("uid") or decoded.get("sub")
    db = get_db()
    user_result = db.get_by_id("users", uid)
    if user_result.data:
        return user_result.data[0]

    return {
        "id": uid,
        "email": decoded.get("email", ""),
        "name": decoded.get("name", decoded.get("email", "")),
        "role": "candidate",
    }


@router.post("/link-candidate")
async def link_candidate(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authorization token")

    token = authorization.split("Bearer ", 1)[1]
    try:
        decoded = verify_firebase_token(token)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

    uid = decoded.get("uid") or decoded.get("sub")
    email = (decoded.get("email") or "").lower()
    if not email:
        raise HTTPException(status_code=400, detail="Email required")

    db = get_db()
    candidates = db.query("candidates", filters=[("email", "eq", email)])
    linked = 0
    for c in candidates.data:
        db.update("candidates", c["id"], {"userId": uid})
        linked += 1

    return {"linked": linked, "email": email}
