from fastapi import APIRouter, HTTPException
from app.supabase_repo import get_db
from app.schemas.evaluation import EvaluationRequest, RankingResponse
from app.tasks.queue import enqueue_task

router = APIRouter()


@router.post("/run")
def run_evaluations(request: EvaluationRequest):
    return enqueue_task("run_evaluations", request.job_id, request.candidate_ids)


@router.post("/rank")
def rank_candidates(job_id: str):
    return enqueue_task("compute_rankings", job_id)


@router.get("/rankings/{job_id}", response_model=RankingResponse)
async def get_rankings(job_id: str):
    db = get_db()
    result = db.query("scores", filters=[("job_id", "eq", job_id)], order_by="rank")
    rankings = []
    candidate_ids = [s["candidate_id"] for s in result.data]
    candidates = db.get_many_by_ids("candidates", candidate_ids)
    cmap = {c["id"]: c for c in candidates}
    for s in result.data:
        cand = cmap.get(s["candidate_id"], {})
        rankings.append({**s, "candidates": cand})
    return RankingResponse(job_id=job_id, rankings=rankings, total=len(rankings))


@router.get("/candidate/{candidate_id}")
async def get_candidate_evaluation(candidate_id: str):
    db = get_db()
    eval_result = db.query("evaluations", filters=[("candidate_id", "eq", candidate_id)])
    score_result = db.query("scores", filters=[("candidate_id", "eq", candidate_id)])
    return {
        "evaluation": eval_result.data[0] if eval_result.data else None,
        "score": score_result.data[0] if score_result.data else None,
    }


@router.get("/{job_id}")
async def get_evaluations(job_id: str):
    db = get_db()
    result = db.query("evaluations", filters=[("job_id", "eq", job_id)])
    enriched = db.enrich_with_candidates(result.data)
    return {"evaluations": enriched, "total": len(enriched)}
