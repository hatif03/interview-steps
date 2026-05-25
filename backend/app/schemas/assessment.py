from pydantic import BaseModel, Field


class AssessmentConfig(BaseModel):
    mcq: int = 5
    dsa: int = 2
    sql: int = 1
    passing_score: int = 60


class CreateAssessmentRequest(BaseModel):
    title: str = "Technical Assessment"
    duration_minutes: int = 60
    config: AssessmentConfig | None = None


class UpdateAssessmentRequest(BaseModel):
    title: str | None = None
    duration_minutes: int | None = None
    config: AssessmentConfig | None = None
    status: str | None = None


class QuestionCreateRequest(BaseModel):
    type: str
    prompt: str
    options: list[str] = Field(default_factory=list)
    correct_answer: dict = Field(default_factory=dict)
    starter_code: str | None = None
    metadata: dict = Field(default_factory=dict)
    order_index: int | None = None


class QuestionUpdateRequest(BaseModel):
    type: str | None = None
    prompt: str | None = None
    options: list[str] | None = None
    correct_answer: dict | None = None
    starter_code: str | None = None
    metadata: dict | None = None
    order_index: int | None = None


class GenerateQuestionsRequest(BaseModel):
    topic_hints: str | None = None


class AssignAssessmentRequest(BaseModel):
    job_id: str
    candidate_ids: list[str]
    send_email: bool = True


class SubmitAnswerRequest(BaseModel):
    question_id: str
    response: dict


class SubmitAssessmentRequest(BaseModel):
    answers: list[SubmitAnswerRequest]
    sql_results: dict[str, list[dict]] | None = None


class ShortlistRequest(BaseModel):
    job_id: str
    outcomes: dict[str, str]
    send_email: bool = True


class AiInterviewShortlistRequest(BaseModel):
    job_id: str
    outcomes: dict[str, str]
    send_email: bool = True


class RemindRequest(BaseModel):
    job_id: str
    round_type: str  # platform_test | ai_interview
    source_ids: list[str] | None = None


class CloseRoundRequest(BaseModel):
    job_id: str
    round_type: str


class RerankRequest(BaseModel):
    job_id: str


class AdvanceRequest(BaseModel):
    job_id: str
    round_type: str  # platform_test | ai_interview
    source_ids: list[str] | None = None
    top_n: int | None = None
    send_email: bool = True
    auto_assign: bool = True


class RejectRequest(BaseModel):
    job_id: str
    round_type: str
    source_ids: list[str]
