"""Model selection. One string per role picks Gemini directly or a Pydantic AI Gateway route.

    PERSONA_MODEL=gemini-3.8-flash                       Gemini API, direct
    PERSONA_MODEL=gateway/modal:google/gemma-4-31B-it    Gateway route "modal" -> Modal endpoint (vLLM)

Gateway routes need PYDANTIC_AI_GATEWAY_API_KEY and PYDANTIC_AI_GATEWAY_BASE_URL. The Modal
credentials live in the Gateway (BYOK), never in this app.
"""

from __future__ import annotations

import os
from typing import Any

from pydantic_ai.models import Model

GATEWAY_PREFIX = "gateway/"
_widened = False


def _widen_openai_metadata() -> None:
    """Modal (vLLM) returns `metadata.weight_versions` as a list; the OpenAI schema types metadata as
    dict[str, str]. Widen it on both models that see the payload, as in the hackathon demo script."""
    global _widened
    if _widened:
        return
    from openai.types.chat import ChatCompletion
    from pydantic_ai.models.openai import _ChatCompletion

    for model in (ChatCompletion, _ChatCompletion):
        model.model_fields["metadata"].annotation = dict[str, Any] | None
        model.model_rebuild(force=True)
    _widened = True


def make_model(name: str) -> Model:
    if name.startswith(GATEWAY_PREFIX):
        from pydantic_ai.models.openai import OpenAIChatModel
        from pydantic_ai.providers.gateway import gateway_provider

        route, _, model_name = name.removeprefix(GATEWAY_PREFIX).partition(":")
        if not model_name:
            raise ValueError(f"expected gateway/<route>:<model>, got {name!r}")
        _widen_openai_metadata()
        # Modal serves /chat/completions but not /responses, hence the openai-chat flavour.
        return OpenAIChatModel(model_name, provider=gateway_provider("openai-chat", route=route))

    from google.genai.types import HttpRetryOptions
    from pydantic_ai.models.google import GoogleModel
    from pydantic_ai.providers.google import GoogleProvider

    # All sessions share one Gemini quota, so back off on 429 and 5xx instead of failing the session.
    retry = HttpRetryOptions(attempts=6, initial_delay=2.0, max_delay=40.0, http_status_codes=[429, 500, 502, 503, 504])
    return GoogleModel(name.removeprefix("google:"), provider=GoogleProvider(api_key=os.environ.get("GOOGLE_API_KEY"), retry_options=retry))
