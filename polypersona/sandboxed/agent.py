"""The persona agent: a Gemini model that behaves like one person using the site.

The agent loop runs on the coordinator. Every browser tool reaches the Chromium session in
the sandbox bound through `SessionDeps`, so the model never sees or chooses a sandbox.
"""

import dataclasses
import os
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Literal

from google.genai.types import HttpRetryOptions
from pydantic_ai import Agent, BinaryContent, RunContext, ToolOutput, ToolReturn
from pydantic_ai.capabilities import ProcessHistory
from pydantic_ai.messages import ModelMessage, ModelRequest, UserPromptPart
from pydantic_ai.models.google import GoogleModel
from pydantic_ai.providers.google import GoogleProvider

from .browser import BrowserState, SandboxBrowser
from .models import ExitSurvey, Observation, ObservationKind, Persona, StepRecord, TestTask
from .recorder import SessionRecorder

# Only the most recent screenshots are sent back to the model; older ones become a note.
KEEP_SCREENSHOTS = 2


@dataclass
class SessionDeps:
    browser: SandboxBrowser
    recorder: SessionRecorder
    persona: Persona
    task: TestTask
    last_step: int = 0
    last_screenshot: str = ""
    actions_used: int = 0
    out_of_patience: bool = False
    contact: dict = field(default_factory=dict)


def make_model(model_name: str | None = None) -> GoogleModel:
    name = model_name or os.environ.get("GEMINI_MODEL")
    if not name:
        raise RuntimeError("GEMINI_MODEL is not set")
    api_key = os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GOOGLE_API_KEY is not set")
    # All sessions share one project quota, so back off on 429/5xx instead of failing.
    retry = HttpRetryOptions(attempts=6, initial_delay=2.0, max_delay=40.0, http_status_codes=[429, 500, 502, 503, 504])
    return GoogleModel(name, provider=GoogleProvider(api_key=api_key, retry_options=retry))


def trim_screenshots(messages: list[ModelMessage]) -> list[ModelMessage]:
    seen = 0
    out: list[ModelMessage] = []
    for msg in reversed(messages):
        if isinstance(msg, ModelRequest):
            parts = []
            for part in msg.parts:
                if isinstance(part, UserPromptPart) and not isinstance(part.content, str):
                    content = []
                    for item in part.content:
                        if isinstance(item, BinaryContent) and item.is_image:
                            seen += 1
                            if seen > KEEP_SCREENSHOTS:
                                content.append("[older screenshot removed]")
                                continue
                        content.append(item)
                    part = dataclasses.replace(part, content=content)
                parts.append(part)
            msg = dataclasses.replace(msg, parts=parts)
        out.append(msg)
    return list(reversed(out))


agent = Agent(
    deps_type=SessionDeps,
    output_type=ToolOutput(ExitSurvey, name="finish", description="Stop using the site and answer the exit survey."),
    capabilities=[ProcessHistory(trim_screenshots)],
    retries=2,
)


@agent.instructions
def persona_instructions(ctx: RunContext[SessionDeps]) -> str:
    p = ctx.deps.persona
    device = "phone" if p.viewport == "mobile" else "laptop"
    reading = (
        "You read every word on a page before acting, including the small print."
        if p.reading_style == "reads everything"
        else "You skim. You look for the obvious button and ignore long text and small print."
    )
    savvy = {
        "low": "You are not confident with technology. You hesitate, and unclear errors really throw you.",
        "medium": "You're reasonably comfortable online, but you don't hunt for hidden options.",
        "high": "You're very comfortable online and have little tolerance for clunky design.",
    }[p.tech_savviness]
    c = ctx.deps.contact
    return f"""You are {p.name}. {p.bio}
You are on your {device}, using a ticket website. Behave exactly as {p.name} would.
{savvy}
{reading}
Your goals: {"; ".join(p.goals)}.
Things that annoy you: {"; ".join(p.frustrations)}.
Your details, if a form asks: name "{c['name']}", email "{c['email']}", phone "{c['phone']}".

How to act:
- You only see the screenshot after each action. Coordinates are on a 0-1000 grid over the
  visible screen: x from the left edge, y from the top edge.
- To type into a field, click it first, then use type_text.
- Give every action a short `intent`: what you are trying to do, in your own words.
- Call record_observation whenever something confuses, annoys, blocks or pleases you. Be
  specific about what you saw. Be honest rather than polite; real people get frustrated.
- You have limited patience: about {p.patience_steps} actions. If you would give up in real
  life, give up.
- When you're done, or you've given up, call finish with your honest answers."""


def _step_reply(ctx: RunContext[SessionDeps], state: BrowserState) -> ToolReturn:
    d = ctx.deps
    left = d.persona.patience_steps - d.actions_used
    lines = [
        f"Now on: {state.title} ({state.url})",
        "The page did not visibly change." if not state.changed else "The page changed.",
    ]
    if state.error:
        lines.append(f"That didn't work: {state.error}")
    if left <= 3:
        lines.append(f"You are running out of patience ({left} actions left).")
    content: list = [f"Screenshot after step {state.step}:", BinaryContent(state.screenshot_png, media_type="image/png")]
    if d.persona.reading_style == "reads everything":
        content.append(f"Text on the page:\n{state.text}")
    return ToolReturn(return_value="\n".join(lines), content=content)


async def perform(d: SessionDeps, action: dict, intent: str) -> BrowserState:
    """Run one browser action in the sandbox and record it as a step."""
    state = await d.browser.act(action)
    rel = d.recorder.rel(state.local_screenshot)
    d.last_step, d.last_screenshot = state.step, rel
    record = StepRecord(
        idx=state.step,
        action=action["action"],
        args={k: v for k, v in action.items() if k != "action"},
        intent=intent,
        url=state.url,
        title=state.title,
        screenshot=rel,
        changed=state.changed,
        note=state.note,
        error=state.error,
        ts=datetime.now(UTC),
        elapsed_ms=state.elapsed_ms,
    )
    d.recorder.report.steps.append(record)
    await d.recorder.append_step_log({"type": "step", **record.model_dump(mode="json")})
    await d.recorder.save()
    return state


async def run_action(ctx: RunContext[SessionDeps], action: dict, intent: str) -> ToolReturn | str:
    d = ctx.deps
    if d.actions_used >= d.persona.patience_steps:
        d.out_of_patience = True
        return "You have run out of patience. Call finish now and say how you feel."
    d.actions_used += 1
    return _step_reply(ctx, await perform(d, action, intent))


@agent.tool
async def click(ctx: RunContext[SessionDeps], x: int, y: int, intent: str) -> ToolReturn | str:
    """Click (or tap) a point on the screen. x and y are on a 0-1000 grid over the visible screen."""
    return await run_action(ctx, {"action": "click", "x": x, "y": y}, intent)


@agent.tool
async def type_text(ctx: RunContext[SessionDeps], text: str, intent: str, press_enter: bool = False) -> ToolReturn | str:
    """Type text into the field that currently has focus. Click the field first."""
    return await run_action(ctx, {"action": "type", "text": text, "enter": press_enter}, intent)


@agent.tool
async def press_key(ctx: RunContext[SessionDeps], key: Literal["Enter", "Tab", "Backspace", "Escape"], intent: str) -> ToolReturn | str:
    """Press a single key."""
    return await run_action(ctx, {"action": "press", "key": key}, intent)


@agent.tool
async def scroll(ctx: RunContext[SessionDeps], direction: Literal["down", "up"], intent: str) -> ToolReturn | str:
    """Scroll the page by most of a screen."""
    return await run_action(ctx, {"action": "scroll", "direction": direction}, intent)


@agent.tool
async def go_back(ctx: RunContext[SessionDeps], intent: str) -> ToolReturn | str:
    """Press the browser's back button."""
    return await run_action(ctx, {"action": "back"}, intent)


@agent.tool
async def record_observation(ctx: RunContext[SessionDeps], kind: ObservationKind, severity: int, text: str) -> str:
    """Note something about the site as it is right now: a bug, friction, confusion, delight or opinion.

    severity: 1 = minor, 5 = would make you leave. text: what you saw and how it made you feel.
    """
    d = ctx.deps
    obs = Observation(
        step_idx=d.last_step,
        kind=kind,
        severity=min(max(severity, 1), 5),
        text=text,
        screenshot=d.last_screenshot,
    )
    d.recorder.report.observations.append(obs)
    await d.recorder.append_step_log({"type": "observation", **obs.model_dump(mode="json")})
    await d.recorder.save()
    return "Noted."
