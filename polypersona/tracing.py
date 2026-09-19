"""Logfire tracing for every agent run, model call and tool call, locally and in Modal containers.

Sends only when LOGFIRE_TOKEN (a project write token) is set; otherwise it is a no-op.
"""

from __future__ import annotations

import os

import logfire

# Words that only trip Logfire's default scrubber in this domain ("checkout session", "session_id").
_HARMLESS = {"session"}


def _keep_harmless(match: logfire.ScrubMatch):
    if match.pattern_match.group(0).lower() in _HARMLESS:
        return match.value
    return None


def setup() -> None:
    logfire.configure(
        send_to_logfire="if-token-present",
        service_name=os.environ.get("POLYPERSONA_SERVICE", "polypersona"),
        console=False,
        scrubbing=logfire.ScrubbingOptions(callback=_keep_harmless),
    )
    logfire.instrument_pydantic_ai()
