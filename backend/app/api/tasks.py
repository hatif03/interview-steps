from fastapi import APIRouter, HTTPException

from app.tasks.queue import get_task_status

router = APIRouter()


@router.get("/{task_id}")
def get_task(task_id: str):
    status = get_task_status(task_id)
    if status.get("status") == "unknown":
        raise HTTPException(status_code=404, detail="Task not found")
    return status
