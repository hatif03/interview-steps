from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    supabase_url: str = ""
    supabase_service_role_key: str = ""
    supabase_jwt_secret: str = ""

    litellm_model: str = "gemini/gemini-2.0-flash"
    openai_api_key: Optional[str] = None
    groq_api_key: Optional[str] = None
    gemini_api_key: Optional[str] = None
    deepseek_api_key: Optional[str] = None
    dashscope_api_key: Optional[str] = None

    mock_turn_models: str = ""
    mock_generate_models: str = ""
    mock_feedback_models: str = ""

    embedding_model: str = "gemini-embedding-001"

    github_token: Optional[str] = None

    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    from_email: str = ""

    google_credentials_json: str = "{}"
    google_calendar_id: str = "primary"

    frontend_url: str = "http://localhost:3000"
    backend_url: str = "http://localhost:8000"
    test_link_base_url: str = "https://example.com/test"

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
