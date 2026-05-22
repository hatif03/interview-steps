"""Firestore repository — Supabase-compatible data access layer."""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

from google.cloud.firestore_v1 import FieldFilter

from app.database import get_firestore_client


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _serialize_value(value: Any) -> Any:
    if value is None:
        return None
    if hasattr(value, "isoformat"):
        return value.isoformat()
    if isinstance(value, dict):
        return {k: _serialize_value(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_serialize_value(v) for v in value]
    return value


def _doc_to_dict(doc) -> dict | None:
    if not doc.exists:
        return None
    data = doc.to_dict() or {}
    data["id"] = doc.id
    return _serialize_value(data)


@dataclass
class QueryResult:
    data: list[dict] = field(default_factory=list)
    count: int = 0


class FirestoreRepo:
    """CRUD helper mirroring common Supabase PostgREST patterns."""

    def insert(self, collection: str, data: dict, doc_id: str | None = None) -> QueryResult:
        db = get_firestore_client()
        doc_id = doc_id or str(uuid.uuid4())
        payload = dict(data)
        if "created_at" not in payload:
            payload["created_at"] = _now_iso()
        db.collection(collection).document(doc_id).set(payload)
        row = _serialize_value({**payload, "id": doc_id})
        return QueryResult(data=[row], count=1)

    def upsert(self, collection: str, doc_id: str, data: dict, merge: bool = True) -> QueryResult:
        db = get_firestore_client()
        payload = dict(data)
        if "created_at" not in payload and not merge:
            payload["created_at"] = _now_iso()
        ref = db.collection(collection).document(doc_id)
        if merge:
            existing = ref.get()
            if not existing.exists and "created_at" not in payload:
                payload["created_at"] = _now_iso()
            ref.set(payload, merge=True)
        else:
            ref.set(payload)
        row = _serialize_value({**payload, "id": doc_id})
        return QueryResult(data=[row], count=1)

    def get_by_id(self, collection: str, doc_id: str) -> QueryResult:
        db = get_firestore_client()
        row = _doc_to_dict(db.collection(collection).document(doc_id).get())
        return QueryResult(data=[row] if row else [], count=1 if row else 0)

    def update(self, collection: str, doc_id: str, data: dict) -> QueryResult:
        db = get_firestore_client()
        db.collection(collection).document(doc_id).update(data)
        row = _doc_to_dict(db.collection(collection).document(doc_id).get())
        return QueryResult(data=[row] if row else [], count=1 if row else 0)

    def delete(self, collection: str, doc_id: str) -> None:
        get_firestore_client().collection(collection).document(doc_id).delete()

    def delete_where(self, collection: str, field: str, value: Any) -> int:
        db = get_firestore_client()
        docs = db.collection(collection).where(filter=FieldFilter(field, "==", value)).stream()
        count = 0
        for doc in docs:
            doc.reference.delete()
            count += 1
        return count

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
        db = get_firestore_client()
        q = db.collection(collection)
        for fld, op, val in filters or []:
            if op == "eq":
                q = q.where(filter=FieldFilter(fld, "==", val))
            elif op == "in":
                if not val:
                    return QueryResult(data=[], count=0)
                q = q.where(filter=FieldFilter(fld, "in", list(val)))
            else:
                raise ValueError(f"Unsupported filter op: {op}")

        if order_by:
            direction = "DESCENDING" if order_desc else "ASCENDING"
            from google.cloud.firestore_v1 import Query

            q = q.order_by(order_by, direction=getattr(Query, direction))

        rows: list[dict] = []
        for doc in q.stream():
            row = _doc_to_dict(doc)
            if row:
                rows.append(row)

        total = len(rows)
        if offset:
            rows = rows[offset:]
        if limit is not None:
            rows = rows[:limit]

        return QueryResult(data=rows, count=total)

    def count(self, collection: str, filters: list[tuple[str, str, Any]] | None = None) -> int:
        return self.query(collection, filters=filters).count

    def get_candidate_with_scores(self, candidate_ids: list[str]) -> dict[str, dict]:
        if not candidate_ids:
            return {}
        result = self.query("scores", filters=[("candidate_id", "in", candidate_ids)])
        return {s["candidate_id"]: s for s in result.data}

    def get_many_by_ids(self, collection: str, doc_ids: list[str]) -> list[dict]:
        if not doc_ids:
            return []
        db = get_firestore_client()
        rows = []
        for doc_id in doc_ids:
            row = _doc_to_dict(db.collection(collection).document(doc_id).get())
            if row:
                rows.append(row)
        return rows

    def enrich_with_candidates(self, rows: list[dict], candidate_id_field: str = "candidate_id") -> list[dict]:
        ids = list({r.get(candidate_id_field) for r in rows if r.get(candidate_id_field)})
        if not ids:
            return rows
        candidates = self.get_many_by_ids("candidates", ids)
        cmap = {c["id"]: c for c in candidates}
        enriched = []
        for row in rows:
            cid = row.get(candidate_id_field)
            cand = cmap.get(cid, {})
            enriched.append({
                **row,
                "candidates": {"name": cand.get("name"), "email": cand.get("email")},
            })
        return enriched


_repo: FirestoreRepo | None = None


def get_db() -> FirestoreRepo:
    global _repo
    if _repo is None:
        _repo = FirestoreRepo()
    return _repo
