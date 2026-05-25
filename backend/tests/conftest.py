"""In-memory database and auth fixtures for API tests."""

from __future__ import annotations

import sys
import uuid
from copy import deepcopy
from dataclasses import dataclass, field
from typing import Any
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

# Stub heavy ML / Google deps so tests run without full service stack.
for _mod in ("google.genai", "app.core.embeddings", "app.services.evaluation_service"):
    sys.modules.setdefault(_mod, MagicMock())

from app.main import app


@dataclass
class QueryResult:
    data: list[dict] = field(default_factory=list)
    count: int = 0


class InMemoryDB:
    def __init__(self) -> None:
        self._tables: dict[str, list[dict]] = {}

    def _rows(self, collection: str) -> list[dict]:
        return self._tables.setdefault(collection, [])

    def insert(self, collection: str, data: dict, doc_id: str | None = None) -> QueryResult:
        doc_id = doc_id or str(uuid.uuid4())
        row = deepcopy(data)
        row["id"] = doc_id
        if "created_at" not in row:
            row["created_at"] = "2026-01-01T00:00:00+00:00"
        self._rows(collection).append(row)
        return QueryResult(data=[deepcopy(row)], count=1)

    def upsert(self, collection: str, doc_id: str, data: dict, merge: bool = True) -> QueryResult:
        rows = self._rows(collection)
        for i, row in enumerate(rows):
            if row.get("id") == doc_id:
                updated = {**row, **deepcopy(data), "id": doc_id}
                rows[i] = updated
                return QueryResult(data=[deepcopy(updated)], count=1)
        payload = deepcopy(data)
        payload["id"] = doc_id
        if "created_at" not in payload:
            payload["created_at"] = "2026-01-01T00:00:00+00:00"
        rows.append(payload)
        return QueryResult(data=[deepcopy(payload)], count=1)

    def upsert_by_key(self, collection: str, key_field: str, key_value: str, data: dict) -> QueryResult:
        rows = self._rows(collection)
        for i, row in enumerate(rows):
            if row.get(key_field) == key_value:
                updated = {**row, **deepcopy(data), key_field: key_value}
                rows[i] = updated
                return QueryResult(data=[deepcopy(updated)], count=1)
        payload = deepcopy(data)
        payload[key_field] = key_value
        payload["id"] = str(uuid.uuid4())
        if "created_at" not in payload:
            payload["created_at"] = "2026-01-01T00:00:00+00:00"
        rows.append(payload)
        return QueryResult(data=[deepcopy(payload)], count=1)

    def get_by_field(self, collection: str, field: str, value: str) -> QueryResult:
        for row in self._rows(collection):
            if row.get(field) == value:
                return QueryResult(data=[deepcopy(row)], count=1)
        return QueryResult(data=[], count=0)

    def get_by_id(self, collection: str, doc_id: str) -> QueryResult:
        for row in self._rows(collection):
            if row.get("id") == doc_id:
                return QueryResult(data=[deepcopy(row)], count=1)
        return QueryResult(data=[], count=0)

    def update(self, collection: str, doc_id: str, data: dict) -> QueryResult:
        rows = self._rows(collection)
        for i, row in enumerate(rows):
            if row.get("id") == doc_id:
                updated = {**row, **deepcopy(data)}
                rows[i] = updated
                return QueryResult(data=[deepcopy(updated)], count=1)
        return QueryResult(data=[], count=0)

    def delete(self, collection: str, doc_id: str) -> None:
        self._tables[collection] = [r for r in self._rows(collection) if r.get("id") != doc_id]

    def query(
        self,
        collection: str,
        *,
        filters: list[tuple[str, str, Any]] | None = None,
        order_by: str | None = None,
        order_desc: bool = False,
        limit: int | None = None,
        offset: int = 0,
    ) -> QueryResult:
        rows = [deepcopy(r) for r in self._rows(collection)]
        for fld, op, val in filters or []:
            if op == "eq":
                rows = [r for r in rows if r.get(fld) == val]
            elif op == "in":
                val_set = set(val or [])
                rows = [r for r in rows if r.get(fld) in val_set]

        if order_by:
            rows.sort(key=lambda r: r.get(order_by) or "", reverse=order_desc)

        if offset:
            rows = rows[offset:]
        if limit is not None:
            rows = rows[:limit]

        return QueryResult(data=rows, count=len(rows))

    def count(self, collection: str, filters: list[tuple[str, str, Any]] | None = None) -> int:
        return self.query(collection, filters=filters).count

    def get_candidate_with_scores(self, candidate_ids: list[str]) -> dict[str, dict]:
        scores = {}
        for row in self._rows("scores"):
            if row.get("candidate_id") in candidate_ids:
                scores[row["candidate_id"]] = row
        return scores

    def get_many_by_ids(self, collection: str, doc_ids: list[str]) -> list[dict]:
        id_set = set(doc_ids)
        return [deepcopy(r) for r in self._rows(collection) if r.get("id") in id_set]

    def enrich_with_candidates(self, rows: list[dict], candidate_id_field: str = "candidate_id") -> list[dict]:
        return rows


TOKEN_MAP = {
    "recruiter-token": {
        "uid": "recruiter-1",
        "sub": "recruiter-1",
        "email": "recruiter@test.com",
        "name": "Recruiter One",
        "role": "recruiter",
    },
    "candidate-token": {
        "uid": "candidate-1",
        "sub": "candidate-1",
        "email": "candidate@test.com",
        "name": "Candidate One",
        "role": "candidate",
    },
}


def _verify_token(jwt: str) -> dict:
    if jwt not in TOKEN_MAP:
        raise ValueError("Invalid token")
    return TOKEN_MAP[jwt]


@pytest.fixture()
def db() -> InMemoryDB:
    return InMemoryDB()


@pytest.fixture()
def client(db: InMemoryDB, monkeypatch: pytest.MonkeyPatch) -> TestClient:
    def _get_db() -> InMemoryDB:
        return db

    modules = [
        "app.supabase_repo",
        "app.api.auth",
        "app.api.jobs",
        "app.api.candidates",
        "app.api.public",
        "app.api.candidate_portal",
        "app.deps.auth",
    ]
    for mod in modules:
        monkeypatch.setattr(f"{mod}.get_db", _get_db)

    monkeypatch.setattr("app.database.verify_supabase_token", _verify_token)
    monkeypatch.setattr("app.deps.auth.verify_supabase_token", _verify_token)

    db.upsert("users", "recruiter-1", {
        "email": "recruiter@test.com",
        "name": "Recruiter One",
        "role": "recruiter",
    })
    db.upsert("users", "candidate-1", {
        "email": "candidate@test.com",
        "name": "Candidate One",
        "role": "candidate",
    })

    return TestClient(app)


def auth_header(role: str) -> dict[str, str]:
    token = "recruiter-token" if role == "recruiter" else "candidate-token"
    return {"Authorization": f"Bearer {token}"}
