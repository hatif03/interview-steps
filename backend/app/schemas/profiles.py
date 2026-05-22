from typing import Optional

from pydantic import BaseModel, Field


class RecruiterProfileUpdate(BaseModel):
    company_name: Optional[str] = None
    company_size: Optional[str] = None
    industry: Optional[str] = None
    website: Optional[str] = None
    job_title: Optional[str] = None
    hiring_volume: Optional[str] = None
    email_notifications: Optional[bool] = None
    default_scoring_preset: Optional[str] = None
    onboarding_completed: Optional[bool] = None


class RecruiterProfileResponse(BaseModel):
    user_id: str
    company_name: Optional[str] = None
    company_size: Optional[str] = None
    industry: Optional[str] = None
    website: Optional[str] = None
    job_title: Optional[str] = None
    hiring_volume: Optional[str] = None
    email_notifications: bool = True
    default_scoring_preset: str = "balanced"
    onboarding_completed: bool = False


class CandidateProfileUpdate(BaseModel):
    phone: Optional[str] = None
    location: Optional[str] = None
    college: Optional[str] = None
    branch: Optional[str] = None
    graduation_year: Optional[int] = None
    cgpa: Optional[float] = None
    github_url: Optional[str] = None
    linkedin_url: Optional[str] = None
    skills: Optional[list[str]] = None
    best_ai_project: Optional[str] = None
    research_work: Optional[str] = None
    resume_url: Optional[str] = None
    onboarding_completed: Optional[bool] = None


class CandidateProfileResponse(BaseModel):
    user_id: str
    phone: Optional[str] = None
    location: Optional[str] = None
    college: Optional[str] = None
    branch: Optional[str] = None
    graduation_year: Optional[int] = None
    cgpa: Optional[float] = None
    github_url: Optional[str] = None
    linkedin_url: Optional[str] = None
    skills: list[str] = Field(default_factory=list)
    best_ai_project: Optional[str] = None
    research_work: Optional[str] = None
    resume_url: Optional[str] = None
    onboarding_completed: bool = False


DEFAULT_APPLY_FORM_CONFIG = {
    "fields": {
        "college": {"required": True, "enabled": True},
        "branch": {"required": True, "enabled": True},
        "cgpa": {"required": False, "enabled": True},
        "best_ai_project": {"required": True, "enabled": True},
        "research_work": {"required": False, "enabled": True},
        "github_url": {"required": True, "enabled": True},
        "resume_url": {"required": True, "enabled": True},
    }
}


class ApplyFormData(BaseModel):
    college: Optional[str] = None
    branch: Optional[str] = None
    cgpa: Optional[float] = None
    best_ai_project: Optional[str] = None
    research_work: Optional[str] = None
    github_url: Optional[str] = None
    resume_url: Optional[str] = None
