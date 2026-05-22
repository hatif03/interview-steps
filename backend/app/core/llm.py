import json
import os
import asyncio
import litellm
from app.config import settings

litellm.drop_params = True

MAX_RETRIES = 3
BASE_DELAY = 5.0

DEFAULT_TURN_CHAIN = [
    "groq/gemma2-9b-it",
    "groq/llama-3.1-8b-instant",
    "groq/llama-3.3-70b-versatile",
]
DEFAULT_GENERATE_CHAIN = [
    "groq/llama-3.3-70b-versatile",
    "deepseek/deepseek-chat",
    "dashscope/qwen-turbo",
    "gemini/gemini-2.0-flash",
]
DEFAULT_FEEDBACK_CHAIN = [
    "deepseek/deepseek-chat",
    "groq/llama-3.3-70b-versatile",
    "dashscope/qwen-plus",
    "gemini/gemini-2.0-flash",
]


def _parse_chain(env_value: str, default: list[str]) -> list[str]:
    if env_value and env_value.strip():
        return [m.strip() for m in env_value.split(",") if m.strip()]
    return default


def _api_key_for_model(model: str) -> str | None:
    if model.startswith("groq/"):
        return settings.groq_api_key
    if model.startswith("deepseek/"):
        return settings.deepseek_api_key
    if model.startswith("dashscope/"):
        return settings.dashscope_api_key
    if model.startswith("gemini/"):
        return settings.gemini_api_key or os.environ.get("GOOGLE_API_KEY")
    return settings.gemini_api_key


def _build_screening_chain() -> list[dict]:
    chain = []
    gemini_key = settings.gemini_api_key
    alt_key = os.environ.get("GOOGLE_API_KEY", "")
    groq_key = settings.groq_api_key

    gemini_models = ["gemini/gemini-2.0-flash", "gemini/gemini-2.0-flash-lite", "gemini/gemini-1.5-flash"]
    gemini_keys = [k for k in [gemini_key, alt_key] if k]

    for model in gemini_models:
        for key in gemini_keys:
            chain.append({"model": model, "api_key": key})

    if groq_key:
        chain.append({"model": "groq/llama-3.3-70b-versatile", "api_key": groq_key})
        chain.append({"model": "groq/llama-3.1-8b-instant", "api_key": groq_key})

    primary = settings.litellm_model
    if primary and not any(c["model"] == primary for c in chain):
        chain.insert(0, {"model": primary, "api_key": gemini_key})

    return chain


def _build_task_chain(task: str) -> list[dict]:
    if task == "turn":
        models = _parse_chain(settings.mock_turn_models, DEFAULT_TURN_CHAIN)
    elif task == "generate":
        models = _parse_chain(settings.mock_generate_models, DEFAULT_GENERATE_CHAIN)
    elif task == "feedback":
        models = _parse_chain(settings.mock_feedback_models, DEFAULT_FEEDBACK_CHAIN)
    else:
        return _build_screening_chain()

    chain = []
    for model in models:
        key = _api_key_for_model(model)
        if key:
            chain.append({"model": model, "api_key": key})

    if not chain:
        return _build_screening_chain()
    return chain


async def llm_completion(
    prompt: str,
    system_prompt: str = "",
    json_mode: bool = False,
    task: str = "screening",
) -> str:
    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": prompt})

    base_kwargs = {
        "messages": messages,
        "temperature": 0.3,
        "max_tokens": 4096,
    }
    if json_mode:
        base_kwargs["response_format"] = {"type": "json_object"}

    chain = _build_task_chain(task)
    last_error = None
    for combo in chain:
        model = combo["model"]
        api_key = combo.get("api_key")
        kwargs = {"model": model, **base_kwargs}
        if api_key:
            kwargs["api_key"] = api_key

        for attempt in range(MAX_RETRIES):
            try:
                response = await litellm.acompletion(**kwargs)
                return response.choices[0].message.content
            except Exception as e:
                last_error = e
                err_str = str(e).lower()

                if "quota" in err_str or "exhausted" in err_str or "limit: 0" in err_str:
                    print(f"[LLM] Quota exhausted: {model}, skipping")
                    break
                if "permission" in err_str or "disabled" in err_str or "403" in err_str:
                    print(f"[LLM] Permission denied: {model}, skipping")
                    break
                if "not found" in err_str or "404" in err_str:
                    print(f"[LLM] Model not found: {model}, skipping")
                    break

                is_retryable = (
                    "rate" in err_str or "429" in err_str or "connection" in err_str
                    or "timeout" in err_str or "500" in err_str or "503" in err_str
                )
                if not is_retryable or attempt == MAX_RETRIES - 1:
                    print(f"[LLM] Non-retryable error on {model}: {type(e).__name__}, trying next")
                    break

                delay = BASE_DELAY * (2 ** attempt)
                print(f"[LLM] Retry {attempt + 1}/{MAX_RETRIES} ({model}) after {delay}s")
                await asyncio.sleep(delay)

    raise last_error


async def llm_json_completion(prompt: str, system_prompt: str = "", task: str = "screening") -> dict:
    raw = await llm_completion(prompt, system_prompt, json_mode=True, task=task)
    raw = raw.strip()
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[1] if "\n" in raw else raw[3:]
        if raw.endswith("```"):
            raw = raw[:-3]
    return json.loads(raw)
