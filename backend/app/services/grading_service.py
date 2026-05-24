"""Assessment grading: MCQ deterministic, DSA LLM, SQL from client execution results."""

from __future__ import annotations

import json

from app.core.llm import llm_json_completion

DSA_GRADE_PROMPT = """Grade this Python coding submission against test cases.

Question:
{prompt}

Candidate code:
{code}

Test cases (JSON):
{test_cases}

Return ONLY valid JSON:
{{
  "score": <0-100 integer>,
  "passedCases": <number>,
  "totalCases": <number>,
  "caseResults": [{{"input": "...", "expected": "...", "passed": true/false, "note": "..."}}],
  "feedback": "<brief feedback for candidate>"
}}"""


def grade_mcq(question: dict, response: dict) -> dict:
    correct = question.get("correct_answer", {})
    expected_index = correct.get("index")
    if expected_index is None:
        expected_index = correct.get("correct_index")
    selected = response.get("selected_index")
    is_correct = selected is not None and selected == expected_index
    score = 100.0 if is_correct else 0.0
    return {
        "score": score,
        "is_correct": is_correct,
        "execution_log": {},
        "ai_feedback": "Correct!" if is_correct else f"Incorrect. The correct answer was option {(expected_index or 0) + 1}.",
    }


def grade_sql_from_client(question: dict, response: dict, client_result: dict | None) -> dict:
    """Grade SQL using execution results computed in-browser (sql.js)."""
    if not client_result:
        return {
            "score": 0.0,
            "is_correct": False,
            "execution_log": {"error": "No execution result provided"},
            "ai_feedback": "Could not execute query.",
        }

    passed = client_result.get("passed", False)
    error = client_result.get("error")
    if error:
        return {
            "score": 0.0,
            "is_correct": False,
            "execution_log": client_result,
            "ai_feedback": f"Query error: {error}",
        }

    score = 100.0 if passed else 0.0
    return {
        "score": score,
        "is_correct": passed,
        "execution_log": client_result,
        "ai_feedback": "Query produced the expected results." if passed else "Query output did not match expected results.",
    }


async def grade_dsa(question: dict, response: dict) -> dict:
    code = response.get("code", "")
    test_cases = question.get("correct_answer", {}).get("test_cases", [])
    if not code.strip():
        return {
            "score": 0.0,
            "is_correct": False,
            "execution_log": {},
            "ai_feedback": "No code submitted.",
        }

    prompt = DSA_GRADE_PROMPT.format(
        prompt=question.get("prompt", ""),
        code=code,
        test_cases=json.dumps(test_cases),
    )
    try:
        result = await llm_json_completion(prompt, task="grade_dsa")
    except Exception as e:
        return {
            "score": 0.0,
            "is_correct": False,
            "execution_log": {"error": str(e)},
            "ai_feedback": "Grading failed. Please contact support.",
        }

    score = float(result.get("score", 0))
    passed = result.get("passedCases", 0)
    total = result.get("totalCases", len(test_cases) or 1)
    return {
        "score": score,
        "is_correct": passed == total and total > 0,
        "execution_log": {"caseResults": result.get("caseResults", [])},
        "ai_feedback": result.get("feedback", ""),
    }


async def grade_answer(
    question: dict,
    response: dict,
    sql_client_result: dict | None = None,
) -> dict:
    qtype = question.get("type", "mcq")
    if qtype == "mcq":
        return grade_mcq(question, response)
    if qtype == "sql":
        return grade_sql_from_client(question, response, sql_client_result)
    if qtype == "dsa":
        return await grade_dsa(question, response)
    return {"score": 0.0, "is_correct": False, "execution_log": {}, "ai_feedback": "Unknown question type"}


REVIEW_PROMPT = """Summarize this technical assessment performance for the candidate.

Job context: {job_title}
Section scores (0-100): {section_scores}
Total score: {total_score}/100
Outcome: {outcome}

Per-question performance:
{question_summary}

Return ONLY valid JSON:
{{
  "strengths": ["...", "..."],
  "areas_for_improvement": ["...", "..."],
  "future_suggestions": ["...", "..."],
  "summary": "<2-3 sentence overall assessment>"
}}"""


async def generate_assessment_review(
    job_title: str,
    section_scores: dict,
    total_score: float,
    outcome: str,
    answer_summaries: list[str],
) -> dict:
    prompt = REVIEW_PROMPT.format(
        job_title=job_title,
        section_scores=json.dumps(section_scores),
        total_score=total_score,
        outcome=outcome,
        question_summary="\n".join(answer_summaries) or "No details",
    )
    try:
        return await llm_json_completion(prompt, task="assessment_review")
    except Exception:
        return {
            "strengths": [],
            "areas_for_improvement": [],
            "future_suggestions": ["Keep practicing core data structures and algorithms."],
            "summary": f"Assessment completed with score {total_score:.0f}/100.",
        }
