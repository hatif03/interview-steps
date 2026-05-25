from fastapi import APIRouter, HTTPException, BackgroundTasks
from app.schemas.mock_interview import (
    AssignMockInterviewRequest,
    SessionTurnRequest,
    StartSessionRequest,
    FeedbackRequest,
)
from app.supabase_repo import get_db
from app.services import mock_interview_service as svc
from app.services.mock_interview_enrichment import enrich_mock_interview

router = APIRouter()


@router.post("/assign")
async def assign_mock_interview(request: AssignMockInterviewRequest, background_tasks: BackgroundTasks):
    try:
        if request.send_email:
            created = await svc.assign_mock_interviews(
                request.job_id,
                request.candidate_ids,
                request.interview_type,
                request.question_count,
                send_email=True,
            )
        else:
            created = await svc.assign_mock_interviews(
                request.job_id,
                request.candidate_ids,
                request.interview_type,
                request.question_count,
            )
        return {"message": f"Assigned {len(created)} automated AI interviews", "interviews": created}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/send-invite")
async def send_invites(job_id: str, candidate_ids: list[str], background_tasks: BackgroundTasks):
    db = get_db()
    interview_ids = {}
    for cid in candidate_ids:
        ivs = db.query("mock_interviews", filters=[("candidate_id", "eq", cid), ("job_id", "eq", job_id)])
        if ivs.data:
            interview_ids[cid] = ivs.data[-1]["id"]

    from app.services.email_service import send_mock_interview_invites

    background_tasks.add_task(send_mock_interview_invites, job_id, candidate_ids, interview_ids)
    return {"message": f"Sending invites to {len(candidate_ids)} candidates"}


@router.get("/candidate/{candidate_id}")
async def get_candidate_interviews(candidate_id: str):
    return svc.get_candidate_mock_interviews(candidate_id)


@router.get("/user/{user_id}")
async def get_user_interviews(user_id: str, email: str | None = None):
    interviews = svc.get_interviews_for_user(user_id, email)
    enriched = [enrich_mock_interview(iv) for iv in interviews]
    return {"interviews": enriched, "total": len(enriched)}


@router.get("/feedback/{interview_id}")
async def get_feedback(interview_id: str, user_id: str | None = None):
    db = get_db()
    filters = [("interview_id", "eq", interview_id)]
    if user_id:
        filters.append(("user_id", "eq", user_id))
    result = db.query("mock_feedback", filters=filters)
    if not result.data:
        return None
    return result.data[0]


@router.get("/{interview_id}")
async def get_interview(interview_id: str):
    db = get_db()
    result = db.get_by_id("mock_interviews", interview_id)
    if not result.data:
        raise HTTPException(status_code=404, detail="Interview not found")
    return enrich_mock_interview(result.data[0])


@router.post("/{interview_id}/sessions")
async def start_session(interview_id: str, body: StartSessionRequest):
    try:
        return await svc.start_session(interview_id, body.user_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/sessions/{session_id}/turn")
async def session_turn(session_id: str, body: SessionTurnRequest):
    try:
        return await svc.process_turn(session_id, body.user_message)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/sessions/{session_id}/feedback")
async def session_feedback(session_id: str, body: FeedbackRequest):
    try:
        return await svc.generate_feedback(session_id, body.feedback_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sessions/{session_id}")
async def get_session(session_id: str):
    db = get_db()
    result = db.get_by_id("mock_sessions", session_id)
    if not result.data:
        raise HTTPException(status_code=404, detail="Session not found")
    return result.data[0]
