from fastapi import APIRouter, HTTPException, BackgroundTasks

from app.schemas.assessment import (
    AssignAssessmentRequest,
    CreateAssessmentRequest,
    GenerateQuestionsRequest,
    QuestionCreateRequest,
    QuestionUpdateRequest,
    ShortlistRequest,
    SubmitAssessmentRequest,
    UpdateAssessmentRequest,
    AiInterviewShortlistRequest,
)
from app.services import assessment_service as svc
from app.services.notification_service import notify_ai_interview_shortlisted
from app.services.hiring_rounds_service import complete_round
from app.supabase_repo import get_db

router = APIRouter()


@router.get("/job/{job_id}")
async def get_job_assessment(job_id: str):
    assessment = svc.get_assessment_for_job(job_id)
    if not assessment:
        return {"assessment": None}
    return {"assessment": assessment}


@router.post("/job/{job_id}")
async def create_job_assessment(job_id: str, body: CreateAssessmentRequest):
    config = body.config.model_dump() if body.config else {"mcq": 5, "dsa": 2, "sql": 1, "passing_score": 60}
    assessment = svc.create_assessment(job_id, body.title, body.duration_minutes, config)
    return {"assessment": assessment}


@router.put("/{assessment_id}")
async def update_assessment(assessment_id: str, body: UpdateAssessmentRequest):
    data = body.model_dump(exclude_none=True)
    if "config" in data and data["config"] is not None:
        data["config"] = body.config.model_dump() if body.config else data["config"]
    try:
        return {"assessment": svc.update_assessment(assessment_id, data)}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{assessment_id}/generate")
async def generate_questions(assessment_id: str, body: GenerateQuestionsRequest | None = None):
    try:
        hints = body.topic_hints if body else None
        return {"assessment": await svc.generate_questions(assessment_id, hints)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{assessment_id}/questions")
async def add_question(assessment_id: str, body: QuestionCreateRequest):
    q = svc.add_question(assessment_id, body.model_dump())
    return {"question": q}


@router.put("/questions/{question_id}")
async def update_question(question_id: str, body: QuestionUpdateRequest):
    q = svc.update_question(question_id, body.model_dump(exclude_none=True))
    return {"question": q}


@router.delete("/questions/{question_id}")
async def delete_question(question_id: str):
    svc.delete_question(question_id)
    return {"success": True}


@router.post("/assign")
async def assign_assessment(body: AssignAssessmentRequest):
    try:
        created = await svc.assign_assessment(body.job_id, body.candidate_ids, body.send_email)
        return {"message": f"Assigned {len(created)} assessments", "assignments": created}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/results/{job_id}")
async def get_results(job_id: str):
    return {"results": svc.get_job_results(job_id)}


@router.post("/shortlist")
async def shortlist_candidates(body: ShortlistRequest):
    updated = await svc.set_shortlist_outcomes(body.job_id, body.outcomes, body.send_email)
    return {"updated": updated}


@router.get("/assignments/{assignment_id}")
async def get_assignment(assignment_id: str):
    assignment = svc.get_assignment(assignment_id, include_answers=True)
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    safe_questions = []
    for q in assignment.get("questions", []):
        safe = {**q}
        if assignment.get("status") not in ("graded",):
            ca = dict(safe.get("correct_answer") or {})
            if safe.get("type") == "mcq":
                ca.pop("index", None)
                ca.pop("correct_index", None)
            safe["correct_answer"] = ca
        safe_questions.append(safe)
    assignment["questions"] = safe_questions
    return assignment


@router.post("/assignments/{assignment_id}/start")
async def start_assignment(assignment_id: str):
    return svc.start_assignment(assignment_id)


@router.post("/assignments/{assignment_id}/submit")
async def submit_assignment(assignment_id: str, body: SubmitAssessmentRequest):
    try:
        answers = [a.model_dump() for a in body.answers]
        result = await svc.submit_and_grade(assignment_id, answers, body.sql_results)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/shortlisted/{job_id}")
async def get_shortlisted(job_id: str):
    return {"candidate_ids": svc.get_shortlisted_for_ai_interview(job_id)}


@router.post("/ai-interview/shortlist")
async def shortlist_ai_interview(body: AiInterviewShortlistRequest):
    db = get_db()
    updated = []
    for iid, outcome in body.outcomes.items():
        if iid not in body.interview_ids:
            continue
        interview = db.get_by_id("mock_interviews", iid)
        if not interview.data:
            continue
        iv = interview.data[0]
        fb = db.query("mock_feedback", filters=[("interview_id", "eq", iid)])
        score = fb.data[0].get("total_score", 0) if fb.data else 0

        complete_round(
            iid,
            round_type="ai_interview",
            outcome=outcome,
            total_score=score,
            email_sent=outcome == "shortlisted" and body.send_email,
        )

        if outcome == "shortlisted":
            if body.send_email:
                await notify_ai_interview_shortlisted(
                    body.job_id, iid, iv["candidate_id"], int(score)
                )
            db.update("candidates", iv["candidate_id"], {
                "pipeline_stage": "shortlisted",
                "status_message": f"AI interview score {score}/100 — shortlisted for live interview",
            })
        else:
            db.update("candidates", iv["candidate_id"], {
                "status_message": "AI interview complete — view feedback in your portal",
            })
        updated.append({"interview_id": iid, "outcome": outcome})

    return {"updated": updated}
