"""Mock interview generation, sessions, and feedback."""

from __future__ import annotations

import json
from datetime import datetime, timezone

from app.core.llm import llm_completion, llm_json_completion
from app.supabase_repo import get_db
from app.services.email_service import send_mock_interview_invites
from app.services.hiring_rounds_service import complete_round, create_round, is_candidate_eliminated, eliminate_candidate

INTERVIEWER_SYSTEM = """You are a professional technical interviewer conducting an automated AI voice interview.
Ask one question at a time. Keep responses concise (2-4 sentences) since they will be read aloud.
Use follow-up questions when answers are vague. Be encouraging but thorough.
When all planned questions are covered, thank the candidate and say the interview is complete."""

FEEDBACK_SYSTEM = """You are a professional interviewer analyzing an automated AI interview transcript.
Evaluate the candidate thoroughly. Do not be lenient — point out mistakes and areas for improvement."""

FEEDBACK_PROMPT = """Analyze this automated AI interview transcript and return JSON with this exact structure:
{{
  "totalScore": <0-100 integer>,
  "categoryScores": [
    {{"name": "Communication Skills", "score": <0-100>, "comment": "<brief>"}},
    {{"name": "Technical Knowledge", "score": <0-100>, "comment": "<brief>"}},
    {{"name": "Problem Solving", "score": <0-100>, "comment": "<brief>"}},
    {{"name": "Cultural Fit", "score": <0-100>, "comment": "<brief>"}},
    {{"name": "Confidence and Clarity", "score": <0-100>, "comment": "<brief>"}}
  ],
  "strengths": ["<strength>", ...],
  "areasForImprovement": ["<area>", ...],
  "finalAssessment": "<3-5 sentence summary>"
}}

Transcript:
{transcript}
"""


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def generate_questions(
    job_id: str,
    candidate_id: str,
    interview_type: str = "Mixed",
    question_count: int = 5,
) -> dict:
    db = get_db()
    job = db.get_by_id("jobs", job_id).data[0]
    candidate = db.get_by_id("candidates", candidate_id).data[0]

    eval_result = db.query("evaluations", filters=[("candidate_id", "eq", candidate_id), ("job_id", "eq", job_id)])
    eval_context = ""
    if eval_result.data:
        explanation = eval_result.data[0].get("explanation", {})
        llm_eval = explanation.get("llm_evaluation", {})
        concerns = llm_eval.get("concerns", [])
        if concerns:
            eval_context = f"Prior screening concerns to probe: {', '.join(concerns)}"

    prompt = f"""Generate {question_count} interview questions for a personalized automated AI interview.

Job title: {job['title']}
Job description: {job['description'][:2000]}
Interview type focus: {interview_type}
Candidate name: {candidate.get('name')}
College/Branch: {candidate.get('college')} / {candidate.get('branch')}
Best AI project: {candidate.get('best_ai_project', 'N/A')}
Research: {candidate.get('research_work', 'N/A')}
Resume excerpt: {(candidate.get('resume_text') or '')[:1500]}
{eval_context}

Return ONLY valid JSON:
{{
  "role": "<job role inferred>",
  "level": "<Junior|Mid|Senior inferred from profile>",
  "techstack": ["<tech1>", "<tech2>"],
  "questions": ["Question 1", "Question 2", ...]
}}

Questions must be voice-friendly — no slashes, asterisks, or special characters."""

    result = await llm_json_completion(prompt, task="generate")

    interview_data = {
        "job_id": job_id,
        "candidate_id": candidate_id,
        "role": result.get("role", job["title"]),
        "type": interview_type,
        "level": result.get("level", "Mid"),
        "techstack": result.get("techstack", []),
        "questions": result.get("questions", [])[:question_count],
        "finalized": True,
        "resume_context": (candidate.get("resume_text") or "")[:500],
        "created_at": _now(),
    }

    inserted = db.insert("mock_interviews", interview_data)
    return inserted.data[0]


async def assign_mock_interviews(
    job_id: str,
    candidate_ids: list[str],
    interview_type: str = "Mixed",
    question_count: int = 5,
    send_email: bool = False,
) -> list[dict]:
    db = get_db()
    created = []
    interview_ids: dict[str, str] = {}

    for cid in candidate_ids:
        interview = await generate_questions(job_id, cid, interview_type, question_count)
        created.append(interview)
        interview_ids[cid] = interview["id"]
        create_round(
            candidate_id=cid,
            job_id=job_id,
            round_type="ai_interview",
            reference_id=interview["id"],
            status="pending",
        )
        db.update("candidates", cid, {
            "pipeline_stage": "ai_interview_assigned",
            "status_message": "Automated AI interview assigned — check your candidate portal",
        })

    if send_email:
        await send_mock_interview_invites(job_id, candidate_ids, interview_ids)

    return created


async def start_session(mock_interview_id: str, user_id: str | None = None) -> dict:
    db = get_db()
    interview = db.get_by_id("mock_interviews", mock_interview_id)
    if not interview.data:
        raise ValueError("Mock interview not found")

    mi = interview.data[0]
    job = db.get_by_id("jobs", mi["job_id"])
    if job.data and job.data[0].get("ai_interview_round_status") == "closed":
        raise ValueError("AI interview round is closed")
    if is_candidate_eliminated(mi["candidate_id"], mi["job_id"]):
        raise ValueError("You are not eligible for further interviews on this application")

    rounds = db.query(
        "hiring_rounds",
        filters=[
            ("reference_id", "eq", mock_interview_id),
            ("round_type", "eq", "ai_interview"),
        ],
    )
    if rounds.data and rounds.data[0].get("outcome") == "not_shortlisted":
        raise ValueError("This interview is closed — view your feedback and recommendations")

    questions = mi.get("questions", [])
    opening = f"Hello! Welcome to your automated AI interview for the {mi.get('role', 'position')} role. Let's begin."

    session_data = {
        "mock_interview_id": mock_interview_id,
        "candidate_id": mi.get("candidate_id"),
        "job_id": mi.get("job_id"),
        "user_id": user_id,
        "transcript": [{"role": "assistant", "content": opening}],
        "status": "active",
        "current_question_index": 0,
        "questions": questions,
        "started_at": _now(),
    }

    result = db.insert("mock_sessions", session_data)

    first_q = questions[0] if questions else "Tell me about yourself."
    assistant_message = f"{opening} {first_q}"

    session_id = result.data[0]["id"]
    db.update("mock_sessions", session_id, {
        "transcript": [
            {"role": "assistant", "content": assistant_message},
        ],
    })

    return {
        "sessionId": session_id,
        "assistantMessage": assistant_message,
        "isComplete": False,
        "currentQuestionIndex": 0,
    }


async def process_turn(session_id: str, user_message: str) -> dict:
    db = get_db()
    session_result = db.get_by_id("mock_sessions", session_id)
    if not session_result.data:
        raise ValueError("Session not found")

    session = session_result.data[0]
    mock_interview_id = session.get("mock_interview_id")
    if mock_interview_id:
        interview = db.get_by_id("mock_interviews", mock_interview_id)
        if interview.data:
            mi = interview.data[0]
            if is_candidate_eliminated(mi["candidate_id"], mi["job_id"]):
                raise ValueError("You are not eligible for further interviews on this application")

    if session.get("status") == "completed":
        return {
            "assistantMessage": "This interview session is already complete.",
            "isComplete": True,
            "currentQuestionIndex": session.get("current_question_index", 0),
        }

    transcript = list(session.get("transcript", []))
    transcript.append({"role": "user", "content": user_message})

    questions = session.get("questions", [])
    q_index = session.get("current_question_index", 0)
    questions_text = "\n".join(f"{i + 1}. {q}" for i, q in enumerate(questions))

    history = "\n".join(f"- {m['role']}: {m['content']}" for m in transcript[-12:])

    prompt = f"""Interview questions (in order):
{questions_text}

Current question index: {q_index + 1} of {len(questions)}

Recent conversation:
{history}

The candidate just said: "{user_message}"

Respond as the interviewer. If the current question needs a follow-up, ask it.
If satisfied with the answer, move to the next numbered question.
If all questions are done, thank the candidate and clearly state the interview is complete.

Return ONLY JSON:
{{"assistantMessage": "<your spoken response>", "isComplete": <true if interview finished>, "currentQuestionIndex": <0-based index of current main question>}}"""

    result = await llm_json_completion(prompt, INTERVIEWER_SYSTEM, task="turn")

    assistant_message = result.get("assistantMessage", "Could you elaborate on that?")
    is_complete = result.get("isComplete", False)
    new_index = result.get("currentQuestionIndex", q_index)

    transcript.append({"role": "assistant", "content": assistant_message})

    update = {
        "transcript": transcript,
        "current_question_index": new_index,
    }
    if is_complete:
        update["status"] = "completed"
        update["ended_at"] = _now()

    db.update("mock_sessions", session_id, update)

    return {
        "assistantMessage": assistant_message,
        "isComplete": is_complete,
        "currentQuestionIndex": new_index,
    }


async def generate_feedback(session_id: str, feedback_id: str | None = None) -> dict:
    db = get_db()
    session_result = db.get_by_id("mock_sessions", session_id)
    if not session_result.data:
        raise ValueError("Session not found")

    session = session_result.data[0]
    transcript_text = "\n".join(
        f"- {m['role']}: {m['content']}" for m in session.get("transcript", [])
    )

    result = await llm_json_completion(
        FEEDBACK_PROMPT.format(transcript=transcript_text),
        FEEDBACK_SYSTEM,
        task="feedback",
    )

    feedback_data = {
        "interview_id": session.get("mock_interview_id"),
        "session_id": session_id,
        "candidate_id": session.get("candidate_id"),
        "user_id": session.get("user_id"),
        "total_score": result.get("totalScore", 0),
        "category_scores": result.get("categoryScores", []),
        "strengths": result.get("strengths", []),
        "areas_for_improvement": result.get("areasForImprovement", []),
        "final_assessment": result.get("finalAssessment", ""),
        "created_at": _now(),
    }

    if feedback_id:
        db.upsert("mock_feedback", feedback_id, feedback_data)
        fid = feedback_id
    else:
        inserted = db.insert("mock_feedback", feedback_data)
        fid = inserted.data[0]["id"]

    candidate_id = session.get("candidate_id")
    interview_id = session.get("mock_interview_id")
    if candidate_id:
        db.update("candidates", candidate_id, {
            "pipeline_stage": "ai_interview_completed",
            "status_message": f"AI interview complete — score: {feedback_data['total_score']}/100",
        })

    if interview_id:
        complete_round(
            interview_id,
            round_type="ai_interview",
            total_score=feedback_data["total_score"],
            review_summary={
                "strengths": feedback_data.get("strengths", []),
                "areas_for_improvement": feedback_data.get("areas_for_improvement", []),
                "final_assessment": feedback_data.get("final_assessment", ""),
            },
        )

    return {"success": True, "feedbackId": fid, **feedback_data}


def get_candidate_mock_interviews(candidate_id: str) -> dict:
    db = get_db()
    interviews = db.query(
        "mock_interviews",
        filters=[("candidate_id", "eq", candidate_id)],
        order_by="created_at",
        order_desc=True,
    )

    feedback_list = db.query("mock_feedback", filters=[("candidate_id", "eq", candidate_id)])
    feedback_by_interview = {f.get("interview_id"): f for f in feedback_list.data}

    items = []
    for iv in interviews.data:
        items.append({
            **iv,
            "feedback": feedback_by_interview.get(iv["id"]),
        })

    return {"interviews": items, "total": len(items)}


def get_interviews_for_user(user_id: str, email: str | None = None) -> list[dict]:
    db = get_db()

    by_user = db.query(
        "mock_interviews",
        filters=[("user_id", "eq", user_id)],
        order_by="created_at",
        order_desc=True,
    )

    if by_user.data:
        return by_user.data

    if email:
        candidates = db.query("candidates", filters=[("email", "eq", email.lower())])
        all_interviews = []
        for c in candidates.data:
            ivs = db.query(
                "mock_interviews",
                filters=[("candidate_id", "eq", c["id"])],
                order_by="created_at",
                order_desc=True,
            )
            all_interviews.extend(ivs.data)
        return all_interviews

    return []
