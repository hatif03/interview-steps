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
