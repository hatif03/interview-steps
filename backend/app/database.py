from supabase import Client, create_client

from app.config import settings

_client: Client | None = None


def get_supabase_client() -> Client:
    global _client
    if _client is None:
        if not settings.supabase_url or not settings.supabase_service_role_key:
            raise RuntimeError(
                "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in backend/.env"
            )
        _client = create_client(settings.supabase_url, settings.supabase_service_role_key)
    return _client


def verify_supabase_token(jwt: str) -> dict:
    client = get_supabase_client()
    response = client.auth.get_user(jwt)
    user = response.user
    if not user:
        raise ValueError("Invalid token")

    metadata = user.user_metadata or {}
    role = metadata.get("role")
    return {
        "uid": user.id,
        "sub": user.id,
        "email": user.email or "",
        "name": metadata.get("name") or metadata.get("full_name") or user.email or "",
        "role": role if role in ("recruiter", "candidate") else None,
    }
