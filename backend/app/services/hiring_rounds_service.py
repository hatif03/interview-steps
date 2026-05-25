"""Unified hiring round timeline records."""

from __future__ import annotations

from datetime import datetime, timezone

from app.supabase_repo import get_db


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _next_attempt_number(candidate_id: str, job_id: str, round_type: str) -> int:
    db = get_db()
    existing = db.query(
        "hiring_rounds",
        filters=[
            ("candidate_id", "eq", candidate_id),
            ("job_id", "eq", job_id),
            ("round_type", "eq", round_type),
        ],
    )
    if not existing.data:
        return 1
    return max(r.get("attempt_number", 1) for r in existing.data) + 1


def create_round(
    *,
    candidate_id: str,
    job_id: str,
    round_type: str,
    reference_id: str | None = None,
    status: str = "pending",
    attempt_number: int | None = None,
) -> dict:
    db = get_db()
    attempt = attempt_number or _next_attempt_number(candidate_id, job_id, round_type)
    inserted = db.insert(
        "hiring_rounds",
        {
            "candidate_id": candidate_id,
            "job_id": job_id,
            "round_type": round_type,
            "attempt_number": attempt,
            "reference_id": reference_id,
            "status": status,
            "outcome": "pending",
        },
    )
    return inserted.data[0]


def complete_round(
    reference_id: str,
    *,
    round_type: str | None = None,
    total_score: float | None = None,
    review_summary: dict | None = None,
    outcome: str | None = None,
    email_sent: bool | None = None,
) -> dict | None:
    db = get_db()
    filters = [("reference_id", "eq", reference_id)]
    if round_type:
        filters.append(("round_type", "eq", round_type))
    rows = db.query("hiring_rounds", filters=filters, order_by="created_at", order_desc=True)
    if not rows.data:
        return None
    row = rows.data[0]
    update: dict = {
        "status": "completed",
        "completed_at": _now(),
    }
    if total_score is not None:
        update["total_score"] = total_score
    if review_summary is not None:
        update["review_summary"] = review_summary
    if outcome is not None:
        update["outcome"] = outcome
    if email_sent is not None:
        update["email_sent"] = email_sent
    result = db.update("hiring_rounds", row["id"], update)
    return result.data[0] if result.data else None


def update_round_outcome(reference_id: str, outcome: str, email_sent: bool = False) -> dict | None:
    db = get_db()
    rows = db.query(
        "hiring_rounds",
        filters=[("reference_id", "eq", reference_id)],
        order_by="created_at",
        order_desc=True,
    )
    if not rows.data:
        return None
    row = rows.data[0]
    result = db.update(
        "hiring_rounds",
        row["id"],
        {"outcome": outcome, "email_sent": email_sent},
    )
    return result.data[0] if result.data else None


def get_rounds_for_candidate(candidate_id: str, job_id: str | None = None) -> list[dict]:
    db = get_db()
    filters = [("candidate_id", "eq", candidate_id)]
    if job_id:
        filters.append(("job_id", "eq", job_id))
    rows = db.query(
        "hiring_rounds",
        filters=filters,
        order_by="created_at",
        order_desc=False,
    )
    return rows.data


def is_candidate_eliminated(candidate_id: str, job_id: str) -> bool:
    """True if the candidate was rejected or eliminated for this job."""
    db = get_db()
    cand = db.get_by_id("candidates", candidate_id)
    if cand.data and cand.data[0].get("pipeline_stage") == "not_advanced":
        return True

    for r in get_rounds_for_candidate(candidate_id, job_id):
        if r.get("outcome") == "not_shortlisted":
            return True

    assignments = db.query(
        "assessment_assignments",
        filters=[
            ("candidate_id", "eq", candidate_id),
            ("job_id", "eq", job_id),
        ],
    )
    for a in assignments.data:
        res = db.query(
            "assessment_results",
            filters=[
                ("assignment_id", "eq", a["id"]),
                ("outcome", "eq", "not_shortlisted"),
            ],
        )
        if res.data:
            return True

    return False


def eliminate_candidate(
    candidate_id: str,
    job_id: str,
    status_message: str,
) -> None:
    """Close out a candidate for a job — no further assessments or interviews."""
    db = get_db()
    db.update("candidates", candidate_id, {
        "pipeline_stage": "not_advanced",
        "status_message": status_message,
    })

    for r in get_rounds_for_candidate(candidate_id, job_id):
        if r.get("outcome") in (None, "pending"):
            db.update("hiring_rounds", r["id"], {
                "outcome": "not_shortlisted",
                "status": "completed",
                "completed_at": _now(),
            })

    assignments = db.query(
        "assessment_assignments",
        filters=[
            ("candidate_id", "eq", candidate_id),
            ("job_id", "eq", job_id),
        ],
    )
    for a in assignments.data:
        res = db.query(
            "assessment_results",
            filters=[("assignment_id", "eq", a["id"])],
        )
        if res.data:
            if res.data[0].get("outcome") in (None, "pending"):
                db.update("assessment_results", res.data[0]["id"], {"outcome": "not_shortlisted"})
        elif a.get("status") in ("assigned", "in_progress", "graded"):
            complete_round(
                a["id"],
                round_type="platform_test",
                outcome="not_shortlisted",
                email_sent=False,
            )


def elimination_message(candidate_id: str, job_id: str) -> str | None:
    if not is_candidate_eliminated(candidate_id, job_id):
        return None
    for r in reversed(get_rounds_for_candidate(candidate_id, job_id)):
        if r.get("outcome") == "not_shortlisted":
            labels = {
                "platform_test": "platform assessment",
                "ai_interview": "AI interview",
                "live_interview": "live interview",
            }
            label = labels.get(r.get("round_type", ""), "this round")
            return (
                f"You were not advanced after the {label}. "
                "Review your feedback and recommendations in your application timeline."
            )
    return "You were not advanced to the next stage. Review your feedback in your application timeline."
