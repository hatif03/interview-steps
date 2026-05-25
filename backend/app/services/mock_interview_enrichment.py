"""Shared mock interview enrichment for candidate portal."""

from app.services.hiring_rounds_service import is_candidate_eliminated
from app.supabase_repo import get_db


def enrich_mock_interview(iv: dict) -> dict:
    db = get_db()
    interview_id = iv["id"]
    rounds = db.query(
        "hiring_rounds",
        filters=[
            ("reference_id", "eq", interview_id),
            ("round_type", "eq", "ai_interview"),
        ],
        order_by="created_at",
        order_desc=True,
    )
    outcome = rounds.data[0].get("outcome") if rounds.data else None
    fb = db.query("mock_feedback", filters=[("interview_id", "eq", interview_id)])
    feedback = fb.data[0] if fb.data else iv.get("feedback")
    eliminated = is_candidate_eliminated(iv["candidate_id"], iv["job_id"])
    can_take = (
        not eliminated
        and not feedback
        and outcome not in ("not_shortlisted",)
    )
    return {
        **iv,
        "feedback": feedback,
        "outcome": outcome,
        "is_eliminated": eliminated,
        "can_take": can_take,
    }
