from pydantic import BaseModel
from typing import Optional


class AssignMockInterviewRequest(BaseModel):
    job_id: str
    candidate_ids: list[str]
    interview_type: str = "Mixed"
    question_count: int = 5
    send_email: bool = False


class SessionTurnRequest(BaseModel):
    user_message: str


class StartSessionRequest(BaseModel):
    user_id: Optional[str] = None


class FeedbackRequest(BaseModel):
    feedback_id: Optional[str] = None


class RegisterUserRequest(BaseModel):
    uid: str
    email: str
    name: str
    role: str  # recruiter | candidate
