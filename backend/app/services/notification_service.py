"""Centralized notification rules: email only when shortlisted (after grading)."""

from __future__ import annotations

from app.config import settings
from app.services.email_service import (
    _log_email,
    _send_email,
    send_mock_interview_invites,
)
from app.supabase_repo import get_db

ASSESSMENT_INVITE_TEMPLATE = """
<html>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0;">Technical Assessment</h1>
  </div>
  <div style="padding: 30px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 0 0 10px 10px;">
    <p>Dear <strong>{candidate_name}</strong>,</p>
    <p>You have been invited to complete a technical assessment on our platform for the <strong>{job_title}</strong> position.</p>
    <div style="text-align: center; margin: 25px 0;">
      <a href="{portal_link}" style="background: #667eea; color: white; padding: 12px 30px; border-radius: 6px; text-decoration: none; font-weight: bold;">Take Assessment</a>
    </div>
    <p style="color: #6b7280; font-size: 14px;">Portal link: {portal_link}</p>
  </div>
</body>
</html>
"""

SHORTLISTED_ASSESSMENT_TEMPLATE = """
<html>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0;">Congratulations — Next Round</h1>
  </div>
  <div style="padding: 30px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 0 0 10px 10px;">
    <p>Dear <strong>{candidate_name}</strong>,</p>
    <p>Great work on your technical assessment for <strong>{job_title}</strong>! You scored <strong>{score}/100</strong> and have been shortlisted for the next round: an Automated AI Interview.</p>
    <div style="text-align: center; margin: 25px 0;">
      <a href="{portal_link}" style="background: #10b981; color: white; padding: 12px 30px; border-radius: 6px; text-decoration: none; font-weight: bold;">View Portal</a>
    </div>
    <p style="color: #6b7280; font-size: 14px;">Sign in to the candidate portal to see your full feedback and take your AI interview when assigned.</p>
  </div>
</body>
</html>
"""

AI_INTERVIEW_SHORTLIST_TEMPLATE = """
<html>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0;">Live Interview Next</h1>
  </div>
  <div style="padding: 30px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 0 0 10px 10px;">
    <p>Dear <strong>{candidate_name}</strong>,</p>
    <p>Congratulations! Your Automated AI Interview score of <strong>{score}/100</strong> for <strong>{job_title}</strong> qualifies you for a live interview.</p>
    <p>We will send scheduling details shortly. Check your candidate portal for updates.</p>
    <div style="text-align: center; margin: 25px 0;">
      <a href="{portal_link}" style="background: #10b981; color: white; padding: 12px 30px; border-radius: 6px; text-decoration: none; font-weight: bold;">View Portal</a>
    </div>
  </div>
</body>
</html>
"""


def _portal_base() -> str:
    return f"{settings.frontend_url.rstrip('/')}/candidate"


async def notify_assessment_assigned(job_id: str, assignment_ids: list[str]) -> None:
    db = get_db()
    job = db.get_by_id("jobs", job_id).data[0]
    for aid in assignment_ids:
        assignment = db.get_by_id("assessment_assignments", aid)
        if not assignment.data:
            continue
        a = assignment.data[0]
        candidate = db.get_by_id("candidates", a["candidate_id"]).data[0]
        link = f"{_portal_base()}/assessments/{aid}"
        html = ASSESSMENT_INVITE_TEMPLATE.format(
            candidate_name=candidate["name"],
            job_title=job["title"],
            portal_link=link,
        )
        try:
            _send_email(
                candidate["email"],
                f"Technical Assessment - {job['title']}",
                html,
            )
            _log_email(a["candidate_id"], job_id, "assessment_invite", "sent")
        except Exception as e:
            _log_email(a["candidate_id"], job_id, "assessment_invite", f"failed: {str(e)[:200]}")


async def notify_assessment_shortlisted(job_id: str, assignment_id: str) -> None:
    db = get_db()
    job = db.get_by_id("jobs", job_id).data[0]
    assignment = db.get_by_id("assessment_assignments", assignment_id).data[0]
    candidate = db.get_by_id("candidates", assignment["candidate_id"]).data[0]
    result = db.query(
        "assessment_results",
        filters=[("assignment_id", "eq", assignment_id)],
    )
    score = result.data[0].get("total_score", 0) if result.data else 0
    html = SHORTLISTED_ASSESSMENT_TEMPLATE.format(
        candidate_name=candidate["name"],
        job_title=job["title"],
        score=f"{score:.0f}",
        portal_link=f"{_portal_base()}/applications/{candidate['id']}",
    )
    try:
        _send_email(
            candidate["email"],
            f"Shortlisted — Next Round - {job['title']}",
            html,
        )
        _log_email(assignment["candidate_id"], job_id, "assessment_shortlisted", "sent")
    except Exception as e:
        _log_email(assignment["candidate_id"], job_id, "assessment_shortlisted", f"failed: {str(e)[:200]}")


async def notify_ai_interview_assigned(
    job_id: str,
    candidate_ids: list[str],
    interview_ids: dict[str, str],
) -> None:
    await send_mock_interview_invites(job_id, candidate_ids, interview_ids)


async def notify_ai_interview_shortlisted(
    job_id: str,
    interview_id: str,
    candidate_id: str,
    score: int,
) -> None:
    db = get_db()
    job = db.get_by_id("jobs", job_id).data[0]
    candidate = db.get_by_id("candidates", candidate_id).data[0]
    html = AI_INTERVIEW_SHORTLIST_TEMPLATE.format(
        candidate_name=candidate["name"],
        job_title=job["title"],
        score=score,
        portal_link=f"{_portal_base()}/applications/{candidate_id}",
    )
    try:
        _send_email(
            candidate["email"],
            f"Live Interview — {job['title']}",
            html,
        )
        _log_email(candidate_id, job_id, "ai_interview_shortlisted", "sent")
    except Exception as e:
        _log_email(candidate_id, job_id, "ai_interview_shortlisted", f"failed: {str(e)[:200]}")
