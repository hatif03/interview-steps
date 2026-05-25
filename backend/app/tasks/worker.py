"""Run: python -m app.tasks.worker"""

from __future__ import annotations

import sys

from app.config import settings


def main() -> None:
    if not settings.redis_url:
        print("REDIS_URL is not set. Start Redis or leave unset to use thread fallback in the API process.")
        sys.exit(1)

    from redis import Redis
    from rq import Worker

    conn = Redis.from_url(settings.redis_url)
    conn.ping()
    worker = Worker(["default"], connection=conn)
    print(f"RQ worker listening on {settings.redis_url} (queue: default)")
    worker.work(with_scheduler=False)


if __name__ == "__main__":
    main()
