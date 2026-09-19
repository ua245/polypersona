"""Model selection. One string per role picks Gemini directly or a Pydantic AI Gateway route.

    PERSONA_MODEL=gemini-3.8-flash                       Gemini API, direct
    PERSONA_MODEL=gateway/modal:google/gemma-4-31B-it    Gateway route "modal" -> Modal endpoint (vLLM)
    PERSONA_MODEL=gateway/persona:gemini-3.8-flash       Gateway route "persona" -> Gemini's OpenAI-compatible API

Don't name a Gateway endpoint "gemini": the Gateway reserves it as an alias for its Vertex route.

Gateway routes need PYDANTIC_AI_GATEWAY_API_KEY and PYDANTIC_AI_GATEWAY_BASE_URL. The Modal
credentials live in the Gateway (BYOK), never in this app.
"""

from __future__ import annotations

import asyncio
import json
import os
from typing import Any

import httpx

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


class GeminiThoughtSignatures(httpx.AsyncBaseTransport):
    """Round-trips Gemini thought signatures over the OpenAI-compatible API.

    Gemini 3 rejects a tool-calling conversation unless each earlier tool call carries the
    `thought_signature` it was returned with. Gemini sends it in `tool_calls[].extra_content`,
    which the OpenAI client drops, so this transport remembers it by tool-call id and puts it
    back on the outgoing request.
    """

    def __init__(self) -> None:
        self._inner = httpx.AsyncHTTPTransport(retries=2)
        self._signatures: dict[str, dict] = {}

    async def handle_async_request(self, request: httpx.Request) -> httpx.Response:
        if request.method == "POST" and request.url.path.endswith("/chat/completions"):
            request = self._attach(request)
        response = await self._inner.handle_async_request(request)
        # The Gateway sometimes runs out of time evaluating a guardrail and refuses the request (HTTP 400,
        # code gateway_guardrail_timeout). Nothing was forwarded, so asking again is safe and usually works.
        for attempt in range(3):
            if response.status_code != 400:
                break
            body = await response.aread()
            if b"gateway_guardrail_timeout" not in body:
                headers = [(k, v) for k, v in response.headers.multi_items() if k.lower() not in ("content-encoding", "content-length", "transfer-encoding")]
                return httpx.Response(response.status_code, headers=headers, content=body, request=request, extensions=response.extensions)
            await asyncio.sleep(1.5 * (attempt + 1))
            response = await self._inner.handle_async_request(request)
        if not request.url.path.endswith("/chat/completions") or response.status_code != 200:
            return response
        body = await response.aread()
        try:
            for choice in json.loads(body).get("choices", []):
                for call in (choice.get("message") or {}).get("tool_calls") or []:
                    if call.get("extra_content"):
                        self._signatures[call["id"]] = call["extra_content"]
        except (ValueError, AttributeError):
            pass
        # The body is already decoded, so drop the encoding headers before handing it back.
        headers = [(k, v) for k, v in response.headers.multi_items() if k.lower() not in ("content-encoding", "content-length", "transfer-encoding")]
        return httpx.Response(response.status_code, headers=headers, content=body, request=request, extensions=response.extensions)

    def _attach(self, request: httpx.Request) -> httpx.Request:
        try:
            payload = json.loads(request.content)
        except ValueError:
            return request
        changed = False
        for message in payload.get("messages", []):
            for call in message.get("tool_calls") or []:
                if "extra_content" not in call and call.get("id") in self._signatures:
                    call["extra_content"] = self._signatures[call["id"]]
                    changed = True
        if not changed:
            return request
        headers = {k: v for k, v in request.headers.items() if k.lower() != "content-length"}
        return httpx.Request(request.method, request.url, headers=headers, content=json.dumps(payload).encode(), extensions=request.extensions)

    async def aclose(self) -> None:
        await self._inner.aclose()


def gemini_http_client() -> httpx.AsyncClient:
    return httpx.AsyncClient(transport=GeminiThoughtSignatures(), timeout=httpx.Timeout(120, connect=10))


def make_model(name: str) -> Model:
    if name.startswith(GATEWAY_PREFIX):
        from pydantic_ai.models.openai import OpenAIChatModel
        from pydantic_ai.providers.gateway import gateway_provider

        route, _, model_name = name.removeprefix(GATEWAY_PREFIX).partition(":")
        if not model_name:
            raise ValueError(f"expected gateway/<route>:<model>, got {name!r}")
        _widen_openai_metadata()
        # Modal serves /chat/completions but not /responses, hence the openai-chat flavour.
        client = gemini_http_client() if model_name.startswith("gemini") else None
        return OpenAIChatModel(model_name, provider=gateway_provider("openai-chat", route=route, http_client=client))

    from google.genai.types import HttpRetryOptions
    from pydantic_ai.models.google import GoogleModel
    from pydantic_ai.providers.google import GoogleProvider

    # All sessions share one Gemini quota, so back off on 429 and 5xx instead of failing the session.
    retry = HttpRetryOptions(attempts=6, initial_delay=2.0, max_delay=40.0, http_status_codes=[429, 500, 502, 503, 504])
    return GoogleModel(name.removeprefix("google:"), provider=GoogleProvider(api_key=os.environ.get("GOOGLE_API_KEY"), retry_options=retry))
