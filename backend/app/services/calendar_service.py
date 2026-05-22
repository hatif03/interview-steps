import json
import logging
import uuid
from datetime import datetime, timedelta
from google.oauth2 import service_account
from googleapiclient.discovery import build
from app.config import settings
from app.supabase_repo import get_db

SCOPES = ["https://www.googleapis.com/auth/calendar"]
logger = logging.getLogger(__name__)


def _get_calendar_service():
    creds_info = json.loads(settings.google_credentials_json)
    credentials = service_account.Credentials.from_service_account_info(creds_info, scopes=SCOPES)
    return build("calendar", "v3", credentials=credentials)


def _generate_meet_link(candidate_name: str, job_title: str) -> str:
    slug = f"{job_title}-{candidate_name}".lower()
    slug = "".join(c if c.isalnum() else "-" for c in slug)
    slug = slug.strip("-")[:60]
    unique = uuid.uuid4().hex[:8]
    return f"https://meet.jit.si/{slug}-{unique}"


async def schedule_interviews(
    job_id: str,
    candidate_ids: list[str],
    duration_minutes: int = 30,
    interviewer_email: str = "",
    start_date: str = "",
    start_hour: int = 10,
    gap_minutes: int = 15,
):
    db = get_db()
    job = db.get_by_id("jobs", job_id).data[0]

    service = None
    try:
        service = _get_calendar_service()
        logger.info("Google Calendar service initialized")
    except Exception as e:
        logger.warning(f"Google Calendar auth failed, will create interviews without calendar events: {e}")

    base_dt = datetime.fromisoformat(start_date) if start_date else datetime.now()
    current_time = base_dt.replace(hour=start_hour, minute=0, second=0, microsecond=0)
    slot_duration = timedelta(minutes=duration_minutes + gap_minutes)

    for idx, cid in enumerate(candidate_ids):
        candidate_result = db.get_by_id("candidates", cid)
        if not candidate_result.data:
            logger.warning(f"Candidate {cid} not found, skipping")
            continue
        candidate = candidate_result.data[0]

        start_time = current_time + (slot_duration * idx)
        end_time = start_time + timedelta(minutes=duration_minutes)

        meet_link = _generate_meet_link(candidate["name"], job["title"])
        calendar_event_id = None
        status = "scheduled"

        if service:
            event = {
                "summary": f"Interview: {candidate['name']} - {job['title']}",
                "description": (
                    f"Interview for {job['title']} position.\n"
                    f"Candidate: {candidate['name']} ({candidate['email']})\n"
                    f"Interviewer: {interviewer_email}\n\n"
                    f"Video Call: {meet_link}"
                ),
                "start": {"dateTime": start_time.isoformat(), "timeZone": "Asia/Kolkata"},
                "end": {"dateTime": end_time.isoformat(), "timeZone": "Asia/Kolkata"},
            }

            try:
                created_event = (
                    service.events()
                    .insert(calendarId=settings.google_calendar_id, body=event)
                    .execute()
                )
                calendar_event_id = created_event.get("id")
                logger.info(f"Calendar event created for {candidate['name']}: {calendar_event_id}")
            except Exception as e:
                logger.warning(f"Calendar event creation failed for {candidate['name']}: {e}")

        db.insert("scheduled_interviews", {
            "candidate_id": cid,
            "job_id": job_id,
            "scheduled_at": start_time.isoformat(),
            "duration_minutes": duration_minutes,
            "google_meet_link": meet_link,
            "calendar_event_id": calendar_event_id,
            "status": status,
        })
        db.update("candidates", cid, {"pipeline_stage": "interview_scheduled"})
        logger.info(f"Interview scheduled for {candidate['name']} at {start_time.isoformat()}")
