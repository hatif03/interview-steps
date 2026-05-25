"""Extract structured profile fields from resume text (regex only, no LLM)."""

from __future__ import annotations

import re
from typing import Any

GITHUB_RE = re.compile(r"https?://(?:www\.)?github\.com/[\w-]+/?", re.I)
LINKEDIN_RE = re.compile(r"https?://(?:www\.)?linkedin\.com/in/[\w-]+/?", re.I)
PHONE_RE = re.compile(r"(?:\+?\d{1,3}[\s-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}")
CGPA_RE = re.compile(r"(?:CGPA|GPA)[:\s]*(\d\.\d{1,2})", re.I)
YEAR_RE = re.compile(r"(?:graduat(?:ed|ion)|class of|expected)[:\s]*(\d{4})", re.I)
BRANCH_RE = re.compile(
    r"(?:b\.?\s*tech|bachelor(?:'s)?|major|branch|degree)\s*(?:in|of|:)?\s*([A-Za-z &/.-]{3,60})",
    re.I,
)

SKILL_KEYWORDS = [
    "python", "javascript", "typescript", "java", "react", "node", "pytorch",
    "tensorflow", "sql", "aws", "docker", "kubernetes", "c++", "go", "rust",
    "machine learning", "deep learning", "nlp", "computer vision",
]


def extract_profile_from_resume_text(text: str) -> dict[str, Any]:
    cleaned = text.strip()
    if not cleaned:
        return {}

    fields: dict[str, Any] = {}

    gh = GITHUB_RE.search(cleaned)
    if gh:
        fields["github_url"] = gh.group(0).rstrip("/")

    li = LINKEDIN_RE.search(cleaned)
    if li:
        fields["linkedin_url"] = li.group(0).rstrip("/")

    phone = PHONE_RE.search(cleaned)
    if phone:
        fields["phone"] = phone.group(0).strip()

    cgpa = CGPA_RE.search(cleaned)
    if cgpa:
        try:
            fields["cgpa"] = float(cgpa.group(1))
        except ValueError:
            pass

    year = YEAR_RE.search(cleaned)
    if year:
        try:
            fields["graduation_year"] = int(year.group(1))
        except ValueError:
            pass

    branch = BRANCH_RE.search(cleaned)
    if branch:
        fields["branch"] = branch.group(1).strip(" .,")

    lower = cleaned.lower()
    found_skills = [s.title() if s != "c++" else "C++" for s in SKILL_KEYWORDS if s in lower]
    if found_skills:
        fields["skills"] = found_skills[:12]

    lines = [ln.strip() for ln in cleaned.splitlines() if ln.strip()]
    for line in lines:
        low = line.lower()
        if any(k in low for k in ("university", "college", "institute", "iit", "nit")):
            if len(line) < 120 and "@" not in line:
                fields.setdefault("college", line)
                break

    return fields
