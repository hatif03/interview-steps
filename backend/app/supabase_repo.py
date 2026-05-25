"""Supabase PostgreSQL repository — PostgREST-compatible data access layer."""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

from app.database import get_supabase_client


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


def _row_to_dict(row: dict | None) -> dict | None:
    if not row:
        return None
    return _serialize_value(dict(row))


@dataclass
class QueryResult:
    data: list[dict] = field(default_factory=list)
    count: int = 0


# Tables that use other timestamp columns (e.g. sent_at) instead of created_at
_TABLES_WITHOUT_CREATED_AT = frozenset({"email_logs", "assessment_assignments"})


class SupabaseRepo:
    """CRUD helper mirroring common Supabase PostgREST patterns."""

    def _table(self, collection: str):
        return get_supabase_client().table(collection)

    def insert(self, collection: str, data: dict, doc_id: str | None = None) -> QueryResult:
        doc_id = doc_id or str(uuid.uuid4())
        payload = dict(data)
        payload["id"] = doc_id
        if "created_at" not in payload and collection not in _TABLES_WITHOUT_CREATED_AT:
            payload["created_at"] = _now_iso()
        result = self._table(collection).insert(payload).execute()
        row = _row_to_dict(result.data[0] if result.data else payload)
        return QueryResult(data=[row] if row else [], count=1 if row else 0)

    def upsert(self, collection: str, doc_id: str, data: dict, merge: bool = True) -> QueryResult:
        payload = dict(data)
        payload["id"] = doc_id
        if "created_at" not in payload and not merge:
            payload["created_at"] = _now_iso()

        result = self._table(collection).upsert(payload).execute()
        row = _row_to_dict(result.data[0] if result.data else payload)
        return QueryResult(data=[row] if row else [], count=1 if row else 0)

    def upsert_by_key(self, collection: str, key_field: str, key_value: str, data: dict) -> QueryResult:
        payload = dict(data)
        payload[key_field] = key_value
        if "created_at" not in payload:
            payload["created_at"] = _now_iso()
        result = self._table(collection).upsert(payload, on_conflict=key_field).execute()
        row = _row_to_dict(result.data[0] if result.data else payload)
        return QueryResult(data=[row] if row else [], count=1 if row else 0)

    def get_by_field(self, collection: str, field: str, value: str) -> QueryResult:
        result = self._table(collection).select("*").eq(field, value).limit(1).execute()
        row = _row_to_dict(result.data[0]) if result.data else None
        return QueryResult(data=[row] if row else [], count=1 if row else 0)

    def get_by_id(self, collection: str, doc_id: str) -> QueryResult:
        result = self._table(collection).select("*").eq("id", doc_id).limit(1).execute()
        row = _row_to_dict(result.data[0]) if result.data else None
        return QueryResult(data=[row] if row else [], count=1 if row else 0)

    def update(self, collection: str, doc_id: str, data: dict) -> QueryResult:
        result = self._table(collection).update(data).eq("id", doc_id).execute()
        row = _row_to_dict(result.data[0] if result.data else None)
        if not row:
            fetched = self.get_by_id(collection, doc_id)
            row = fetched.data[0] if fetched.data else None
        return QueryResult(data=[row] if row else [], count=1 if row else 0)

    def delete(self, collection: str, doc_id: str) -> None:
        self._table(collection).delete().eq("id", doc_id).execute()

    def delete_where(self, collection: str, field: str, value: Any) -> int:
        rows = self.query(collection, filters=[(field, "eq", value)]).data
        for row in rows:
            self.delete(collection, row["id"])
        return len(rows)

    def query(
        self,
        collection: str,
        *,
        columns: str = "*",
        filters: list[tuple[str, str, Any]] | None = None,
        order_by: str | None = None,
        order_desc: bool = False,
        limit: int | None = None,
        offset: int = 0,
    ) -> QueryResult:
        q = self._table(collection).select(columns)
        for fld, op, val in filters or []:
            if op == "eq":
                q = q.eq(fld, val)
            elif op == "in":
                if not val:
                    return QueryResult(data=[], count=0)
                q = q.in_(fld, list(val))
            else:
                raise ValueError(f"Unsupported filter op: {op}")

        if order_by:
            q = q.order(order_by, desc=order_desc)

        if limit is not None:
            end = offset + limit - 1 if limit > 0 else offset
            q = q.range(offset, end if end >= offset else offset)
        elif offset:
            q = q.range(offset, offset + 999)

        result = q.execute()
        rows = [_row_to_dict(r) for r in (result.data or [])]
        rows = [r for r in rows if r]
        return QueryResult(data=rows, count=len(rows))

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
        result = self._table(collection).select("*").in_("id", doc_ids).execute()
        return [_row_to_dict(r) for r in (result.data or []) if _row_to_dict(r)]

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


_repo: SupabaseRepo | None = None


def get_db() -> SupabaseRepo:
    global _repo
    if _repo is None:
        _repo = SupabaseRepo()
    return _repo
