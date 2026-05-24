"""Round command center: remind, close, rerank, advance between hiring rounds."""

from __future__ import annotations

from datetime import datetime, timezone

from app.services import assessment_service as assessment_svc
from app.services.hiring_rounds_service import complete_round
from app.services.mock_interview_service import assign_mock_interviews
from app.services.notification_service import (
    notify_ai_interview_reminder,
    notify_ai_interview_shortlisted,
    notify_assessment_reminder,
)
from app.services.scoring_engine import compute_rankings
from app.supabase_repo import get_db


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def get_round_summary(job_id: str) -> dict:
    db = get_db()
    job_row = db.get_by_id("jobs", job_id)
    if not job_row.data:
        raise ValueError("Job not found")
    job = job_row.data[0]
    assessment = assessment_svc.get_assessment_meta_for_job(job_id)
    assignments = assessment_svc.get_job_results_summary(job_id)
    ai_results = assessment_svc.get_job_ai_interview_results(job_id)

    assess_stats = {
        "total": len(assignments),
        "not_started": 0,
        "in_progress": 0,
        "graded": 0,
        "awaiting_decision": 0,
        "shortlisted": 0,
        "not_shortlisted": 0,
    }
    for a in assignments:
        st = a.get("status", "assigned")
        if st == "assigned":
            assess_stats["not_started"] += 1
        elif st == "in_progress":
            assess_stats["in_progress"] += 1
        elif st == "graded":
            assess_stats["graded"] += 1
        outcome = (a.get("result") or {}).get("outcome")
        if outcome == "pending":
            assess_stats["awaiting_decision"] += 1
        elif outcome == "shortlisted":
            assess_stats["shortlisted"] += 1
        elif outcome == "not_shortlisted":
            assess_stats["not_shortlisted"] += 1

    ai_stats = {
        "total": len(ai_results),
        "not_started": 0,
        "in_progress": 0,
        "completed": 0,
        "awaiting_decision": 0,
        "shortlisted": 0,
        "not_shortlisted": 0,
    }
    for iv in ai_results:
        if iv.get("feedback"):
            ai_stats["completed"] += 1
            outcome = iv.get("outcome")
            if outcome == "pending" or outcome is None:
                ai_stats["awaiting_decision"] += 1
            elif outcome == "shortlisted":
                ai_stats["shortlisted"] += 1
            elif outcome == "not_shortlisted":
                ai_stats["not_shortlisted"] += 1
        else:
            sessions = iv.get("_sessions") or []
            active = any(s.get("status") == "active" for s in sessions)
            if active:
                ai_stats["in_progress"] += 1
            else:
                ai_stats["not_started"] += 1

    ai_interviews = [{k: v for k, v in iv.items() if k != "_sessions"} for iv in ai_results]

    shortlisted_ids = assessment_svc.get_shortlisted_for_ai_interview(job_id)
    interview_cids = {iv["candidate_id"] for iv in ai_results}
    pending_ids = [cid for cid in shortlisted_ids if cid not in interview_cids]
    pending_candidates = []
    if pending_ids:
        cmap = {c["id"]: c for c in db.get_many_by_ids("candidates", pending_ids)}
        pending_candidates = [
            {"candidate_id": cid, "candidate": cmap.get(cid)}
            for cid in pending_ids
        ]
        ai_stats["total"] += len(pending_ids)
        ai_stats["not_started"] += len(pending_ids)

    return {
        "job_id": job_id,
        "assessment": {
            **(assessment or {}),
            "round_status": (assessment or {}).get("round_status", "open"),
        },
        "ai_interview_round_status": job.get("ai_interview_round_status", "open"),
        "assessment_stats": assess_stats,
        "ai_stats": ai_stats,
        "assignments": assignments,
        "ai_interviews": ai_interviews,
        "ai_interviews_pending": pending_candidates,
        "assessment_shortlisted_ids": shortlisted_ids,
        "live_shortlisted_ids": assessment_svc.get_shortlisted_for_live_interview(job_id),
    }


async def remind_round(
    job_id: str,
    round_type: str,
    source_ids: list[str] | None = None,
) -> dict:
    if round_type == "platform_test":
        assignments = assessment_svc.get_job_results_summary(job_id)
        targets = [
            a for a in assignments
            if a.get("status") in ("assigned", "in_progress")
            and (not source_ids or a["id"] in source_ids)
        ]
        await notify_assessment_reminder(job_id, [t["id"] for t in targets])
        return {"reminded": len(targets)}

    if round_type == "ai_interview":
        ai_results = assessment_svc.get_job_ai_interview_results(job_id)
        targets = [
            iv for iv in ai_results
            if not iv.get("feedback")
            and (not source_ids or iv["id"] in source_ids)
        ]
        await notify_ai_interview_reminder(job_id, [t["id"] for t in targets])
        return {"reminded": len(targets)}

    raise ValueError(f"Unknown round_type: {round_type}")


async def close_round(job_id: str, round_type: str) -> dict:
    db = get_db()

    if round_type == "platform_test":
        assessment = assessment_svc.get_assessment_for_job(job_id)
        if not assessment:
            raise ValueError("No assessment for this job")
        db.update(
            "job_assessments",
            assessment["id"],
            {"round_status": "closed", "closed_at": _now()},
        )
        assignments = assessment_svc.get_job_results_summary(job_id)
        rejected = 0
        for a in assignments:
            if a.get("status") in ("assigned", "in_progress"):
                cid = a["candidate_id"]
                complete_round(
                    a["id"],
                    round_type="platform_test",
                    outcome="not_shortlisted",
                    email_sent=False,
                )
                db.update("candidates", cid, {
                    "pipeline_stage": "not_advanced",
                    "status_message": "Assessment round closed — not advanced to next stage",
                })
                rejected += 1
        return {"closed": True, "auto_rejected": rejected}

    if round_type == "ai_interview":
        db.update("jobs", job_id, {
            "ai_interview_round_status": "closed",
            "ai_interview_round_closed_at": _now(),
        })
        ai_results = assessment_svc.get_job_ai_interview_results(job_id)
        rejected = 0
        for iv in ai_results:
            if not iv.get("feedback"):
                complete_round(
                    iv["id"],
                    round_type="ai_interview",
                    outcome="not_shortlisted",
                    email_sent=False,
                )
                db.update("candidates", iv["candidate_id"], {
                    "pipeline_stage": "not_advanced",
                    "status_message": "AI interview round closed — not advanced to live interview",
                })
                rejected += 1
        return {"closed": True, "auto_rejected": rejected}

    raise ValueError(f"Unknown round_type: {round_type}")


async def rerank_job(job_id: str) -> dict:
    return await compute_rankings(job_id)


async def advance_round(
    job_id: str,
    round_type: str,
    source_ids: list[str] | None = None,
    top_n: int | None = None,
    send_email: bool = True,
    auto_assign: bool = True,
) -> dict:
    if round_type == "platform_test":
        return await _advance_from_assessment(
            job_id, source_ids, top_n, send_email, auto_assign
        )
    if round_type == "ai_interview":
        return await _advance_from_ai_interview(
            job_id, source_ids, top_n, send_email
        )
    raise ValueError(f"Unknown round_type: {round_type}")


async def _advance_from_assessment(
    job_id: str,
    source_ids: list[str] | None,
    top_n: int | None,
    send_email: bool,
    auto_assign: bool,
) -> dict:
    assignments = assessment_svc.get_job_results_summary(job_id)
    graded = [
        a for a in assignments
        if a.get("status") == "graded"
        and (a.get("result") or {}).get("outcome") in ("pending", None)
    ]
    graded.sort(key=lambda a: (a.get("result") or {}).get("total_score", 0), reverse=True)

    if source_ids:
        selected = [a for a in graded if a["id"] in source_ids]
    elif top_n:
        selected = graded[:top_n]
    else:
        raise ValueError("Provide source_ids or top_n")

    if not selected:
        return {"advanced": 0, "candidate_ids": []}

    outcomes = {a["id"]: "shortlisted" for a in selected}
    await assessment_svc.set_shortlist_outcomes(job_id, outcomes, send_email=False)

    candidate_ids = list({a["candidate_id"] for a in selected})
    assigned = []
    if auto_assign:
        assigned = await assign_mock_interviews(
            job_id, candidate_ids, send_email=send_email
        )

    if send_email and not auto_assign:
        from app.services.notification_service import notify_assessment_shortlisted
        for a in selected:
            await notify_assessment_shortlisted(job_id, a["id"])

    return {
        "advanced": len(selected),
        "candidate_ids": candidate_ids,
        "assignment_ids": [a["id"] for a in selected],
        "ai_interviews_assigned": len(assigned),
    }


async def _advance_from_ai_interview(
    job_id: str,
    source_ids: list[str] | None,
    top_n: int | None,
    send_email: bool,
) -> dict:
    db = get_db()
    ai_results = assessment_svc.get_job_ai_interview_results(job_id)
    completed = [
        iv for iv in ai_results
        if iv.get("feedback")
        and iv.get("outcome") in ("pending", None)
    ]
    completed.sort(
        key=lambda iv: iv.get("feedback", {}).get("total_score", 0),
        reverse=True,
    )

    if source_ids:
        selected = [iv for iv in completed if iv["id"] in source_ids]
    elif top_n:
        selected = completed[:top_n]
    else:
        raise ValueError("Provide source_ids or top_n")

    updated = []
    for iv in selected:
        score = iv.get("feedback", {}).get("total_score", 0)
        complete_round(
            iv["id"],
            round_type="ai_interview",
            outcome="shortlisted",
            total_score=score,
            email_sent=send_email,
        )
        if send_email:
            await notify_ai_interview_shortlisted(
                job_id, iv["id"], iv["candidate_id"], int(score)
            )
        db.update("candidates", iv["candidate_id"], {
            "pipeline_stage": "ai_interview_completed",
            "status_message": f"AI interview score {score}/100 — shortlisted for live interview",
        })
        updated.append(iv["id"])

    return {
        "advanced": len(updated),
        "interview_ids": updated,
        "candidate_ids": list({iv["candidate_id"] for iv in selected}),
    }


async def reject_assessment_round(
    job_id: str,
    source_ids: list[str],
) -> dict:
    from app.services.hiring_rounds_service import eliminate_candidate
    from app.supabase_repo import get_db

    db = get_db()
    rejected_candidates: set[str] = set()
    updated = await assessment_svc.set_shortlist_outcomes(
        job_id, {sid: "not_shortlisted" for sid in source_ids}, send_email=False
    )
    for sid in source_ids:
        row = db.get_by_id("assessment_assignments", sid)
        if not row.data:
            continue
        rejected_candidates.add(row.data[0]["candidate_id"])

    for cid in rejected_candidates:
        eliminate_candidate(
            cid,
            job_id,
            "Assessment complete — not advanced. View feedback and recommendations in your portal.",
        )

    return {"rejected": max(len(updated), len(rejected_candidates))}


async def reject_ai_round(job_id: str, source_ids: list[str]) -> dict:
    from app.services.hiring_rounds_service import eliminate_candidate

    db = get_db()
    updated = []
    for iid in source_ids:
        iv = db.get_by_id("mock_interviews", iid)
        if not iv.data:
            continue
        score = 0
        fb = db.query("mock_feedback", filters=[("interview_id", "eq", iid)])
        if fb.data:
            score = fb.data[0].get("total_score", 0)
        complete_round(
            iid,
            round_type="ai_interview",
            outcome="not_shortlisted",
            total_score=score,
            email_sent=False,
        )
        eliminate_candidate(
            iv.data[0]["candidate_id"],
            job_id,
            "AI interview complete — not advanced. View feedback and recommendations in your portal.",
        )
        updated.append(iid)
    return {"rejected": len(updated)}
