from typing import Optional

from pydantic import BaseModel
from datetime import datetime


DEFAULT_WEIGHTS = {
    "jd_match": 0.25,
    "github": 0.20,
    "test_code": 0.20,
    "test_la": 0.10,
    "project_relevance": 0.10,
    "research_relevance": 0.05,
    "cgpa": 0.10,
}

SCORING_PRESETS = {
    "technical": {
        "jd_match": 0.20,
        "github": 0.25,
        "test_code": 0.30,
        "test_la": 0.05,
        "project_relevance": 0.10,
        "research_relevance": 0.05,
        "cgpa": 0.05,
    },
    "balanced": DEFAULT_WEIGHTS,
    "academic": {
        "jd_match": 0.20,
        "github": 0.10,
        "test_code": 0.15,
        "test_la": 0.15,
        "project_relevance": 0.10,
        "research_relevance": 0.10,
        "cgpa": 0.20,
    },
}


class WeightConfig(BaseModel):
    jd_match: float = 0.25
    github: float = 0.20
    test_code: float = 0.20
    test_la: float = 0.10
    project_relevance: float = 0.10
    research_relevance: float = 0.05
    cgpa: float = 0.10


class JobCreate(BaseModel):
    title: str
    description: str
    weight_config: WeightConfig = WeightConfig()
    apply_enabled: bool = False
    apply_form_config: Optional[dict] = None
    status: str = "draft"
    location: Optional[str] = None
    job_type: Optional[str] = None


class JobUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    weight_config: Optional[WeightConfig] = None
    apply_enabled: Optional[bool] = None
    apply_form_config: Optional[dict] = None
    status: Optional[str] = None
    location: Optional[str] = None
    job_type: Optional[str] = None
    regenerate_slug: bool = False


class JobResponse(BaseModel):
    id: str
    title: str
    description: str
    weight_config: dict
    created_at: str
    candidate_count: Optional[int] = 0
    recruiter_id: Optional[str] = None
    apply_slug: Optional[str] = None
    apply_enabled: bool = False
    apply_form_config: Optional[dict] = None
    status: str = "draft"
    location: Optional[str] = None
    job_type: Optional[str] = None
    company_name: Optional[str] = None
