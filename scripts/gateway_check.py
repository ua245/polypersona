"""Check the Gateway route, the optimization rule and the guardrail in one go.

    uv run python scripts/gateway_check.py            # endpoint from PERSONA_MODEL, default "persona"
    uv run python scripts/gateway_check.py persona

Reads PYDANTIC_AI_GATEWAY_BASE_URL and PYDANTIC_AI_GATEWAY_API_KEY from .env. Each check sends one
small request through the Gateway and reads the headers the Gateway adds to its response:
  pydantic-ai-gateway-active-provider        which provider served the request
  x-pydantic-gateway-optimizations-applied   which optimization rules were injected
  x-pydantic-gateway-guardrails-applied      which guardrails matched, and their action
"""

import sys

import httpx
from dotenv import dotenv_values

env = dotenv_values(".env")
default_route = (env.get("PERSONA_MODEL") or "gateway/persona:").removeprefix("gateway/").split(":")[0] or "persona"
ROUTE = sys.argv[1] if len(sys.argv) > 1 else default_route
MODEL = "gemini-3.8-flash"
URL = env["PYDANTIC_AI_GATEWAY_BASE_URL"].rstrip("/") + f"/{ROUTE}/chat/completions"
HEADERS = {"Authorization": f"Bearer {env['PYDANTIC_AI_GATEWAY_API_KEY']}"}
ECHO = "Repeat the following back to me character for character, with no other words: "

CASES = [
    # (name, prompt, expect card redacted?)
    ("card, spaced", ECHO + "my card is 4242 4242 4242 4242", True),
    ("card, no spaces", ECHO + "card 4242424242424242", True),
    ("card, dashes", ECHO + "use 4000-0566-5566-5556 please", True),
    ("card, 15-digit Amex", ECHO + "amex 378282246310005", True),
    ("near miss: phone and ZIP", ECHO + "call me on (614) 555-0142, ZIP 43215", False),
    ("near miss: expiry and CVC", ECHO + "expiry 09/28, CVC 314", False),
    ("near miss: date and order", ECHO + "ordered 2026-09-19, order #1234-5678", False),
]


def send(prompt: str) -> httpx.Response:
    body = {"model": MODEL, "messages": [{"role": "user", "content": prompt}]}
    return httpx.post(URL, json=body, headers=HEADERS, timeout=90)


def main() -> int:
    print(f"Gateway endpoint: {URL}\n")
    r = send("Reply with the single word: ok")
    r.raise_for_status()
    provider = r.headers.get("pydantic-ai-gateway-active-provider")
    rules = r.headers.get("x-pydantic-gateway-optimizations-applied", "none")
    print(f"[route]      HTTP {r.status_code}, served by provider: {provider}")
    print(f"[rule]       optimizations applied: {rules}\n")

    failures = 0
    for name, prompt, redact in CASES:
        r = send(prompt)
        sent = prompt.removeprefix(ECHO)
        reply = r.json()["choices"][0]["message"]["content"].strip() if r.status_code == 200 else f"HTTP {r.status_code}"
        guard = r.headers.get("x-pydantic-gateway-guardrails-applied", "none")
        redacted = "[REDACTED]" in reply
        ok = redacted == redact
        failures += not ok
        print(f"[{'PASS' if ok else 'FAIL'}] {name}")
        print(f"       sent:      {sent}")
        print(f"       model saw: {reply}")
        print(f"       guardrail: {guard}")
    print(f"\n{len(CASES) - failures}/{len(CASES)} guardrail cases behaved as expected")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
