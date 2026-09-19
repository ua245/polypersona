"""Strip coordinator secrets from any text before it is logged or stored."""

import os

SECRET_ENV_VARS = ("GOOGLE_API_KEY", "GEMINI_API_KEY", "MODAL_TOKEN_ID", "MODAL_TOKEN_SECRET")


def redact(text: str) -> str:
    for name in SECRET_ENV_VARS:
        value = os.environ.get(name)
        if value and len(value) >= 8:
            text = text.replace(value, f"[redacted:{name}]")
    return text
