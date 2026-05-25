import json
import logging
import os
import asyncio
import litellm
from app.config import settings

litellm.drop_params = True
litellm.set_verbose = False
litellm.suppress_debug_info = True
litellm.turn_off_message_logging = True
logging.getLogger("LiteLLM").setLevel(logging.CRITICAL)
logging.getLogger("litellm").setLevel(logging.CRITICAL)

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

GEMINI_MODELS = [
    "gemini/gemini-2.0-flash",
    "gemini/gemini-2.0-flash-lite",
]

_PLACEHOLDER_MARKERS = (
    "your-",
    "change-me",
    "placeholder",
    "example",
    "xxx",
    "gsk_your",
    "sk-your",
)


def _is_valid_api_key(key: str | None) -> bool:
    if not key:
        return False
    value = key.strip()
    if len(value) < 12:
        return False
    lower = value.lower()
    return not any(marker in lower for marker in _PLACEHOLDER_MARKERS)


def has_llm_provider() -> bool:
    return any(
        _is_valid_api_key(key)
        for key in (
            settings.groq_api_key,
            settings.gemini_api_key,
            settings.deepseek_api_key,
            settings.dashscope_api_key,
            settings.openai_api_key,
            os.environ.get("GOOGLE_API_KEY"),
        )
    )


def _parse_chain(env_value: str, default: list[str]) -> list[str]:
    if env_value and env_value.strip():
        return [m.strip() for m in env_value.split(",") if m.strip()]
    return default


def _api_key_for_model(model: str) -> str | None:
    if model.startswith("groq/"):
        key = settings.groq_api_key
    elif model.startswith("deepseek/"):
        key = settings.deepseek_api_key
    elif model.startswith("dashscope/"):
        key = settings.dashscope_api_key
    elif model.startswith("openai/"):
        key = settings.openai_api_key
    elif model.startswith("gemini/"):
        key = settings.gemini_api_key or os.environ.get("GOOGLE_API_KEY")
    else:
        key = settings.gemini_api_key or os.environ.get("GOOGLE_API_KEY")
    return key if _is_valid_api_key(key) else None


def _append_model(chain: list[dict], model: str, api_key: str | None) -> None:
    if not api_key:
        return
    if any(entry["model"] == model and entry.get("api_key") == api_key for entry in chain):
        return
    chain.append({"model": model, "api_key": api_key})


def _build_screening_chain() -> list[dict]:
    chain: list[dict] = []

    groq_key = _api_key_for_model("groq/llama-3.3-70b-versatile")
    if groq_key:
        _append_model(chain, "groq/llama-3.3-70b-versatile", groq_key)
        _append_model(chain, "groq/llama-3.1-8b-instant", groq_key)

    gemini_keys = [
        k
        for k in (settings.gemini_api_key, os.environ.get("GOOGLE_API_KEY"))
        if _is_valid_api_key(k)
    ]
    for model in GEMINI_MODELS:
        for key in dict.fromkeys(gemini_keys):
            _append_model(chain, model, key)

    deepseek_key = _api_key_for_model("deepseek/deepseek-chat")
    if deepseek_key:
        _append_model(chain, "deepseek/deepseek-chat", deepseek_key)

    primary = settings.litellm_model
    primary_key = _api_key_for_model(primary)
    if primary and primary_key:
        if not any(entry["model"] == primary for entry in chain):
            chain.insert(0, {"model": primary, "api_key": primary_key})

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

    chain: list[dict] = []
    for model in models:
        key = _api_key_for_model(model)
        _append_model(chain, model, key)

    return chain or _build_screening_chain()


def _should_skip_model(err_str: str) -> bool:
    return any(
        token in err_str
        for token in (
            "quota",
            "exhausted",
            "limit: 0",
            "permission",
            "disabled",
            "403",
            "not found",
            "404",
            "api key not valid",
            "invalid api key",
            "authentication",
            "401",
            "invalid_argument",
        )
    )


async def llm_completion(
    prompt: str,
    system_prompt: str = "",
    json_mode: bool = False,
    task: str = "screening",
) -> str:
    chain = _build_task_chain(task)
    if not chain:
        raise RuntimeError("No LLM provider configured")

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

    last_error: Exception | None = None
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

                if _should_skip_model(err_str):
                    break

                is_retryable = (
                    "rate" in err_str
                    or "429" in err_str
                    or "connection" in err_str
                    or "timeout" in err_str
                    or "500" in err_str
                    or "503" in err_str
                )
                if not is_retryable or attempt == MAX_RETRIES - 1:
                    break

                delay = BASE_DELAY * (2 ** attempt)
                await asyncio.sleep(delay)

    raise last_error or RuntimeError("All LLM providers failed")


async def llm_json_completion(prompt: str, system_prompt: str = "", task: str = "screening") -> dict:
    raw = await llm_completion(prompt, system_prompt, json_mode=True, task=task)
    raw = raw.strip()
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[1] if "\n" in raw else raw[3:]
        if raw.endswith("```"):
            raw = raw[:-3]
    return json.loads(raw)


async def llm_json_completion_optional(
    prompt: str,
    system_prompt: str = "",
    task: str = "screening",
    max_models: int = 2,
) -> dict | None:
    """Best-effort JSON completion; returns None instead of raising."""
    if not has_llm_provider():
        return None

    chain = _build_task_chain(task)[:max_models]
    if not chain:
        return None

    messages = [{"role": "user", "content": prompt}]
    if system_prompt:
        messages.insert(0, {"role": "system", "content": system_prompt})

    for combo in chain:
        kwargs = {
            "model": combo["model"],
            "messages": messages,
            "temperature": 0.2,
            "max_tokens": 2048,
            "response_format": {"type": "json_object"},
            "api_key": combo.get("api_key"),
            "timeout": 12,
        }
        try:
            response = await litellm.acompletion(**kwargs)
            raw = (response.choices[0].message.content or "").strip()
            if raw.startswith("```"):
                raw = raw.split("\n", 1)[1] if "\n" in raw else raw[3:]
                if raw.endswith("```"):
                    raw = raw[:-3]
            parsed = json.loads(raw)
            return parsed if isinstance(parsed, dict) else None
        except Exception:
            continue

    return None
