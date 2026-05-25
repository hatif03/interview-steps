"""Upload candidate resume PDFs to Supabase Storage."""

from __future__ import annotations

import re
import uuid

from app.database import get_supabase_client

BUCKET = "resumes"


def _safe_filename(name: str) -> str:
    base = re.sub(r"[^a-zA-Z0-9._-]+", "-", name).strip("-") or "resume.pdf"
    if not base.lower().endswith(".pdf"):
        base = f"{base}.pdf"
    return base[:120]


def upload_resume_pdf(user_id: str, filename: str, content: bytes) -> str:
    if not content:
        raise ValueError("Resume file is empty")

    safe_name = _safe_filename(filename)
    path = f"{user_id}/{uuid.uuid4().hex}_{safe_name}"

    client = get_supabase_client()
    bucket = client.storage.from_(BUCKET)
    bucket.upload(
        path,
        content,
        file_options={"content-type": "application/pdf", "upsert": "true"},
    )
    return bucket.get_public_url(path)
