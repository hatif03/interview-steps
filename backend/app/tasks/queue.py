"""Enqueue long-running work to RQ (Redis) or a daemon thread when Redis is unavailable."""

from __future__ import annotations

import logging
import threading
import uuid
from typing import Any

from app.config import settings

logger = logging.getLogger(__name__)

_redis_queue = None
_redis_checked = False
_fallback_jobs: dict[str, dict[str, Any]] = {}


def _get_redis_queue():
    global _redis_queue, _redis_checked
    if _redis_checked:
        return _redis_queue
    _redis_checked = True
    if not settings.redis_url:
        return None
    try:
        from redis import Redis
        from rq import Queue

        conn = Redis.from_url(settings.redis_url)
        conn.ping()
        _redis_queue = Queue("default", connection=conn)
        logger.info("RQ task queue connected to Redis")
    except Exception as exc:
        logger.warning("Redis unavailable — using in-process thread fallback: %s", exc)
        _redis_queue = None
    return _redis_queue


def enqueue_task(func_name: str, *args, **kwargs) -> dict:
    from app.tasks import jobs as job_module

    func = getattr(job_module, func_name)

    queue = _get_redis_queue()
    if queue is not None:
        job = queue.enqueue(
            func,
            *args,
            **kwargs,
            job_timeout=settings.task_job_timeout_seconds,
            result_ttl=86400,
            failure_ttl=86400,
        )
        return {
            "task_id": job.id,
            "status": "queued",
            "backend": "rq",
            "message": f"{func_name} queued",
        }

    task_id = str(uuid.uuid4())
    _fallback_jobs[task_id] = {
        "status": "queued",
        "result": None,
        "error": None,
        "func": func_name,
    }

    def _run() -> None:
        _fallback_jobs[task_id]["status"] = "started"
        try:
            result = func(*args, **kwargs)
            _fallback_jobs[task_id]["status"] = "finished"
            _fallback_jobs[task_id]["result"] = result
        except Exception as exc:
            logger.exception("Background task %s failed", func_name)
            _fallback_jobs[task_id]["status"] = "failed"
            _fallback_jobs[task_id]["error"] = str(exc)

    threading.Thread(target=_run, daemon=True, name=f"task-{func_name}").start()
    return {
        "task_id": task_id,
        "status": "queued",
        "backend": "thread",
        "message": f"{func_name} started in background thread",
    }


def get_task_status(task_id: str) -> dict:
    queue = _get_redis_queue()
    if queue is not None:
        from rq.job import Job

        try:
            job = Job.fetch(task_id, connection=queue.connection)
            status = job.get_status()
            payload: dict[str, Any] = {
                "task_id": task_id,
                "status": status,
                "backend": "rq",
            }
            if job.is_finished:
                payload["result"] = job.result
            if job.is_failed:
                payload["error"] = job.exc_info or "Task failed"
            return payload
        except Exception:
            pass

    fb = _fallback_jobs.get(task_id)
    if fb:
        return {
            "task_id": task_id,
            "status": fb["status"],
            "backend": "thread",
            "result": fb.get("result"),
            "error": fb.get("error"),
        }

    return {"task_id": task_id, "status": "unknown", "error": "Task not found"}
