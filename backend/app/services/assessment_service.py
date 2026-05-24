"""Platform assessment CRUD, assignment, submission, and grading."""

from __future__ import annotations

import json
from datetime import datetime, timezone

from app.core.llm import llm_json_completion
from app.services import grading_service
from app.services.hiring_rounds_service import complete_round, create_round, is_candidate_eliminated, eliminate_candidate
from app.services.scoring_engine import compute_rankings
from app.supabase_repo import get_db

GENERATE_QUESTIONS_PROMPT = """Generate technical assessment questions for a software engineering hiring test.

Job title: {title}
Job description: {description}
Requirements: {mcq} MCQ questions, {dsa} DSA coding questions (Python), {sql} SQL questions.
Topic hints: {hints}

Return ONLY valid JSON:
{{
  "questions": [
    {{
      "type": "mcq",
      "prompt": "<question>",
      "options": ["A", "B", "C", "D"],
      "correct_answer": {{"index": 0}},
      "metadata": {{"difficulty": "medium", "tags": ["python"]}}
    }},
    {{
      "type": "dsa",
      "prompt": "<problem statement>",
      "starter_code": "def solution():\\n    pass",
      "correct_answer": {{
        "test_cases": [
          {{"input": "...", "expected_output": "..."}}
        ]
      }},
      "metadata": {{"language": "python", "difficulty": "medium"}}
    }},
    {{
      "type": "sql",
      "prompt": "<SQL problem>",
      "starter_code": "SELECT ...",
      "correct_answer": {{
        "expected_rows": [{{"col": "val"}}]
      }},
      "metadata": {{
        "schema": {{
          "tables": [
            {{"name": "employees", "columns": ["id", "name", "salary"], "rows": [{{"id": 1, "name": "Alice", "salary": 90000}}]}}
          ]
        }}
      }}
    }}
  ]
}}"""


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def get_assessment_for_job(job_id: str) -> dict | None:
    db = get_db()
    rows = db.query(
        "job_assessments",
        filters=[("job_id", "eq", job_id)],
        order_by="created_at",
        order_desc=True,
    )
    if not rows.data:
        return None
    assessment = rows.data[0]
    questions = db.query(
        "assessment_questions",
        filters=[("assessment_id", "eq", assessment["id"])],
        order_by="order_index",
    )
    return {**assessment, "questions": questions.data}


def create_assessment(job_id: str, title: str, duration_minutes: int, config: dict) -> dict:
    db = get_db()
    existing = db.query("job_assessments", filters=[("job_id", "eq", job_id)])
    if existing.data:
        return get_assessment_for_job(job_id)  # type: ignore

    inserted = db.insert(
        "job_assessments",
        {
            "job_id": job_id,
            "title": title,
            "duration_minutes": duration_minutes,
            "config": config,
            "status": "draft",
        },
    )
    return {**inserted.data[0], "questions": []}


def update_assessment(assessment_id: str, data: dict) -> dict:
    db = get_db()
    db.update("job_assessments", assessment_id, data)
    result = db.get_by_id("job_assessments", assessment_id)
    questions = db.query(
        "assessment_questions",
        filters=[("assessment_id", "eq", assessment_id)],
        order_by="order_index",
    )
    return {**result.data[0], "questions": questions.data}


async def generate_questions(assessment_id: str, topic_hints: str | None = None) -> dict:
    db = get_db()
    assessment = db.get_by_id("job_assessments", assessment_id)
    if not assessment.data:
        raise ValueError("Assessment not found")
    a = assessment.data[0]
    job = db.get_by_id("jobs", a["job_id"]).data[0]
    config = a.get("config", {})

    prompt = GENERATE_QUESTIONS_PROMPT.format(
        title=job["title"],
        description=job.get("description", "")[:2000],
        mcq=config.get("mcq", 5),
        dsa=config.get("dsa", 2),
        sql=config.get("sql", 1),
        hints=topic_hints or "General software engineering",
    )
    result = await llm_json_completion(prompt, task="generate_assessment")

    db.delete_where("assessment_questions", "assessment_id", assessment_id)
    questions = []
    for i, q in enumerate(result.get("questions", [])):
        inserted = db.insert(
            "assessment_questions",
            {
                "assessment_id": assessment_id,
                "type": q.get("type", "mcq"),
                "order_index": i,
                "prompt": q.get("prompt", ""),
                "options": q.get("options", []),
                "correct_answer": q.get("correct_answer", {}),
                "starter_code": q.get("starter_code"),
                "metadata": q.get("metadata", {}),
                "source": "ai",
            },
        )
        questions.append(inserted.data[0])

    return update_assessment(assessment_id, {})


def add_question(assessment_id: str, data: dict) -> dict:
    db = get_db()
    existing = db.query(
        "assessment_questions",
        filters=[("assessment_id", "eq", assessment_id)],
    )
    order = data.get("order_index")
    if order is None:
        order = len(existing.data)
    inserted = db.insert(
        "assessment_questions",
        {
            "assessment_id": assessment_id,
            "type": data["type"],
            "order_index": order,
            "prompt": data.get("prompt", ""),
            "options": data.get("options", []),
            "correct_answer": data.get("correct_answer", {}),
            "starter_code": data.get("starter_code"),
            "metadata": data.get("metadata", {}),
            "source": "manual",
        },
    )
    return inserted.data[0]


def update_question(question_id: str, data: dict) -> dict:
    db = get_db()
    result = db.update("assessment_questions", question_id, data)
    return result.data[0]


def delete_question(question_id: str) -> None:
    db = get_db()
    db.delete("assessment_questions", question_id)


def _next_assignment_attempt(candidate_id: str, assessment_id: str) -> int:
    db = get_db()
    existing = db.query(
        "assessment_assignments",
        filters=[
            ("candidate_id", "eq", candidate_id),
            ("assessment_id", "eq", assessment_id),
        ],
    )
    if not existing.data:
        return 1
    return max(a.get("attempt_number", 1) for a in existing.data) + 1


async def assign_assessment(
    job_id: str,
    candidate_ids: list[str],
    send_email: bool = True,
) -> list[dict]:
    from app.services.notification_service import notify_assessment_assigned

    assessment = get_assessment_for_job(job_id)
    if not assessment:
        raise ValueError("Create and publish an assessment first")
    if assessment.get("status") != "published":
        raise ValueError("Publish the assessment before assigning")

    db = get_db()
    created = []
    for cid in candidate_ids:
        attempt = _next_assignment_attempt(cid, assessment["id"])
        inserted = db.insert(
            "assessment_assignments",
            {
                "assessment_id": assessment["id"],
                "candidate_id": cid,
                "job_id": job_id,
                "attempt_number": attempt,
                "status": "assigned",
                "assigned_at": _now(),
            },
        )
        assignment = inserted.data[0]
        create_round(
            candidate_id=cid,
            job_id=job_id,
            round_type="platform_test",
            reference_id=assignment["id"],
            status="pending",
            attempt_number=attempt,
        )
        db.update("candidates", cid, {
            "pipeline_stage": "assessment_assigned",
            "status_message": "Platform assessment assigned — check your candidate portal",
        })
        created.append(assignment)

    if send_email:
        await notify_assessment_assigned(job_id, [a["id"] for a in created])

    return created


def get_assignment(assignment_id: str, include_answers: bool = False) -> dict | None:
    db = get_db()
    result = db.get_by_id("assessment_assignments", assignment_id)
    if not result.data:
        return None
    assignment = result.data[0]
    assessment = db.get_by_id("job_assessments", assignment["assessment_id"])
    questions = db.query(
        "assessment_questions",
        filters=[("assessment_id", "eq", assignment["assessment_id"])],
        order_by="order_index",
    )
    job = db.get_by_id("jobs", assignment["job_id"])
    out = {
        **assignment,
        "assessment": assessment.data[0] if assessment.data else None,
        "questions": questions.data,
        "job_title": job.data[0]["title"] if job.data else "",
    }
    if include_answers:
        answers = db.query(
            "assessment_answers",
            filters=[("assignment_id", "eq", assignment_id)],
        )
        out["answers"] = answers.data
    result_row = db.query(
        "assessment_results",
        filters=[("assignment_id", "eq", assignment_id)],
    )
    out["result"] = result_row.data[0] if result_row.data else None
    return out


def get_assignments_for_user(user_id: str, email: str | None = None) -> list[dict]:
    db = get_db()
    candidates = db.query("candidates", filters=[("user_id", "eq", user_id)])
    if not candidates.data and email:
        candidates = db.query("candidates", filters=[("email", "eq", email.lower())])

    assignments = []
    for c in candidates.data:
        rows = db.query(
            "assessment_assignments",
            filters=[("candidate_id", "eq", c["id"])],
            order_by="assigned_at",
            order_desc=True,
        )
        for row in rows.data:
            enriched = get_assignment(row["id"])
            if enriched:
                enriched["is_eliminated"] = is_candidate_eliminated(c["id"], c["job_id"])
                enriched["can_take"] = (
                    not enriched["is_eliminated"]
                    and enriched.get("status") != "graded"
                    and (enriched.get("result") or {}).get("outcome") != "not_shortlisted"
                )
                assignments.append(enriched)
    return assignments


def _is_assessment_round_closed(job_id: str) -> bool:
    assessment = get_assessment_for_job(job_id)
    return bool(assessment and assessment.get("round_status") == "closed")


def start_assignment(assignment_id: str) -> dict:
    db = get_db()
    assignment = get_assignment(assignment_id)
    if not assignment:
        raise ValueError("Assignment not found")
    if _is_assessment_round_closed(assignment["job_id"]):
        raise ValueError("Assessment round is closed")
    if is_candidate_eliminated(assignment["candidate_id"], assignment["job_id"]):
        raise ValueError("You are not eligible for further assessments on this application")
    result = assignment.get("result") or {}
    if result.get("outcome") == "not_shortlisted":
        raise ValueError("This assessment is closed — view your results and feedback")
    db.update(
        "assessment_assignments",
        assignment_id,
        {"status": "in_progress", "started_at": _now()},
    )
    assignment = get_assignment(assignment_id)
    if assignment:
        rows = db.query(
            "hiring_rounds",
            filters=[("reference_id", "eq", assignment_id)],
        )
        for r in rows.data:
            if r.get("status") == "pending":
                db.update("hiring_rounds", r["id"], {"status": "in_progress"})
    return assignment  # type: ignore


async def submit_and_grade(
    assignment_id: str,
    answers: list[dict],
    sql_results: dict | None = None,
) -> dict:
    db = get_db()
    assignment = get_assignment(assignment_id)
    if not assignment:
        raise ValueError("Assignment not found")
    if assignment["status"] == "graded":
        raise ValueError("Already graded")
    if _is_assessment_round_closed(assignment["job_id"]):
        raise ValueError("Assessment round is closed")
    if is_candidate_eliminated(assignment["candidate_id"], assignment["job_id"]):
        raise ValueError("You are not eligible for further assessments on this application")

    questions = {q["id"]: q for q in assignment.get("questions", [])}
    section_totals: dict[str, list[float]] = {"mcq": [], "dsa": [], "sql": []}
    answer_summaries = []

    for ans in answers:
        qid = ans["question_id"]
        question = questions.get(qid)
        if not question:
            continue
        qtype = question.get("type", "mcq")
        sql_client = (sql_results or {}).get(qid)
        grade = await grading_service.grade_answer(question, ans.get("response", {}), sql_client)

        existing = db.query(
            "assessment_answers",
            filters=[
                ("assignment_id", "eq", assignment_id),
                ("question_id", "eq", qid),
            ],
        )
        payload = {
            "assignment_id": assignment_id,
            "question_id": qid,
            "response": ans.get("response", {}),
            "score": grade["score"],
            "is_correct": grade.get("is_correct"),
            "execution_log": grade.get("execution_log", {}),
            "ai_feedback": grade.get("ai_feedback"),
        }
        if existing.data:
            db.update("assessment_answers", existing.data[0]["id"], payload)
        else:
            db.insert("assessment_answers", payload)

        section_totals.setdefault(qtype, []).append(grade["score"])
        answer_summaries.append(
            f"- [{qtype}] score {grade['score']:.0f}: {grade.get('ai_feedback', '')[:100]}"
        )

    section_scores = {
        k: round(sum(v) / len(v), 1) if v else 0.0
        for k, v in section_totals.items()
    }
    all_scores = [s for scores in section_totals.values() for s in scores]
    total_score = round(sum(all_scores) / len(all_scores), 1) if all_scores else 0.0

    job = db.get_by_id("jobs", assignment["job_id"]).data[0]
    review = await grading_service.generate_assessment_review(
        job["title"],
        section_scores,
        total_score,
        "pending",
        answer_summaries,
    )

    db.update(
        "assessment_assignments",
        assignment_id,
        {"status": "graded", "submitted_at": _now()},
    )

    existing_result = db.query(
        "assessment_results",
        filters=[("assignment_id", "eq", assignment_id)],
    )
    result_payload = {
        "assignment_id": assignment_id,
        "total_score": total_score,
        "section_scores": section_scores,
        "outcome": "pending",
        "review": review,
        "graded_at": _now(),
    }
    if existing_result.data:
        db.update("assessment_results", existing_result.data[0]["id"], result_payload)
    else:
        db.insert("assessment_results", result_payload)

    db.update("candidates", assignment["candidate_id"], {
        "pipeline_stage": "assessment_completed",
        "status_message": f"Assessment complete — score: {total_score:.0f}/100. Awaiting review.",
    })

    complete_round(
        assignment_id,
        round_type="platform_test",
        total_score=total_score,
        review_summary=review,
    )

    await _sync_test_results(assignment["candidate_id"], assignment["job_id"], section_scores)
    await compute_rankings(assignment["job_id"])

    return get_assignment(assignment_id, include_answers=True)  # type: ignore


async def _sync_test_results(candidate_id: str, job_id: str, section_scores: dict) -> None:
    db = get_db()
    test_la = section_scores.get("mcq")
    dsa = section_scores.get("dsa", 0) or 0
    sql = section_scores.get("sql", 0) or 0
    dsa_sql = [s for s in [dsa, sql] if s]
    test_code = round(sum(dsa_sql) / len(dsa_sql), 1) if dsa_sql else None

    payload = {
        "candidate_id": candidate_id,
        "job_id": job_id,
        "test_la": test_la,
        "test_code": test_code,
        "uploaded_at": _now(),
    }
    db.upsert("test_results", candidate_id, payload)


async def set_shortlist_outcomes(
    job_id: str,
    assignment_outcomes: dict[str, str],
    send_email: bool = True,
) -> list[dict]:
    from app.services.notification_service import notify_assessment_shortlisted

    db = get_db()
    updated = []
    for assignment_id, outcome in assignment_outcomes.items():
        rows = db.query(
            "assessment_results",
            filters=[("assignment_id", "eq", assignment_id)],
        )
        if not rows.data:
            continue
        result = rows.data[0]
        db.update("assessment_results", result["id"], {"outcome": outcome})

        assignment = db.get_by_id("assessment_assignments", assignment_id).data[0]
        cid = assignment["candidate_id"]
        review = result.get("review", {})

        if outcome == "shortlisted":
            msg = f"Assessment score {result.get('total_score', 0):.0f}/100 — shortlisted for AI interview"
            if send_email:
                await notify_assessment_shortlisted(job_id, assignment_id)
                complete_round(
                    assignment_id,
                    round_type="platform_test",
                    outcome="shortlisted",
                    email_sent=True,
                )
            else:
                complete_round(
                    assignment_id,
                    round_type="platform_test",
                    outcome="shortlisted",
                )
            db.update("candidates", cid, {
                "pipeline_stage": "shortlisted",
                "status_message": msg,
            })
        else:
            complete_round(
                assignment_id,
                round_type="platform_test",
                outcome="not_shortlisted",
                email_sent=False,
            )
            eliminate_candidate(
                cid,
                job_id,
                "Assessment complete — not advanced. View feedback and recommendations in your portal.",
            )

        updated.append({"assignment_id": assignment_id, "outcome": outcome})

    return updated


def get_job_results(job_id: str) -> list[dict]:
    db = get_db()
    assignments = db.query(
        "assessment_assignments",
        filters=[("job_id", "eq", job_id)],
        order_by="assigned_at",
        order_desc=True,
    )
    results = []
    for a in assignments.data:
        enriched = get_assignment(a["id"], include_answers=True)
        if enriched:
            cand = db.get_by_id("candidates", a["candidate_id"])
            enriched["candidate"] = cand.data[0] if cand.data else None
            results.append(enriched)
    return results


def get_shortlisted_for_ai_interview(job_id: str) -> list[str]:
    """Candidate IDs shortlisted from platform assessment."""
    db = get_db()
    assignments = db.query("assessment_assignments", filters=[("job_id", "eq", job_id)])
    shortlisted = []
    for a in assignments.data:
        res = db.query(
            "assessment_results",
            filters=[
                ("assignment_id", "eq", a["id"]),
                ("outcome", "eq", "shortlisted"),
            ],
        )
        if res.data:
            shortlisted.append(a["candidate_id"])
    return list(set(shortlisted))


def get_job_ai_interview_results(job_id: str) -> list[dict]:
    """Mock interviews for a job with feedback and review outcome."""
    db = get_db()
    interviews = db.query(
        "mock_interviews",
        filters=[("job_id", "eq", job_id)],
        order_by="created_at",
        order_desc=True,
    )
    results = []
    for iv in interviews.data:
        fb = db.query("mock_feedback", filters=[("interview_id", "eq", iv["id"])])
        rounds = db.query(
            "hiring_rounds",
            filters=[
                ("reference_id", "eq", iv["id"]),
                ("round_type", "eq", "ai_interview"),
            ],
            order_by="created_at",
            order_desc=True,
        )
        cand = db.get_by_id("candidates", iv["candidate_id"])
        feedback = fb.data[0] if fb.data else None
        round_row = rounds.data[0] if rounds.data else None
        outcome = round_row.get("outcome", "pending") if round_row and feedback else None
        results.append({
            **iv,
            "feedback": feedback,
            "outcome": outcome,
            "candidate": cand.data[0] if cand.data else None,
        })
    return results


def get_shortlisted_for_live_interview(job_id: str) -> list[str]:
    """Candidate IDs shortlisted from AI interview for live scheduling."""
    db = get_db()
    rounds = db.query(
        "hiring_rounds",
        filters=[
            ("job_id", "eq", job_id),
            ("round_type", "eq", "ai_interview"),
            ("outcome", "eq", "shortlisted"),
        ],
    )
    return list({r["candidate_id"] for r in rounds.data})
