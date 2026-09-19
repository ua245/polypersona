from __future__ import annotations

import dataclasses
import os
import time
from dataclasses import dataclass, field
from typing import Awaitable, Callable, Literal

from pydantic_ai import Agent, BinaryContent, RunContext, ToolReturn
from pydantic_ai.capabilities import ProcessHistory
from pydantic_ai.messages import ModelMessage, ModelRequest

from .browser import BrowserSession
from .llm import make_model  # noqa: F401 - re-exported for session, personas and evaluator
from .models import ExitSurvey, Observation, ObservationKind, Persona, StepRecord, TestTask

PERSONA_MODEL = os.environ.get("PERSONA_MODEL", "gemini-3.8-flash")
KEEP_SCREENSHOTS = 3

# Called after every step and observation so a live view can follow the session.
EventSink = Callable[[dict], Awaitable[None]]


@dataclass
class Recorder:
    steps: list[StepRecord] = field(default_factory=list)
    screenshots: list[bytes] = field(default_factory=list)
    observations: list[Observation] = field(default_factory=list)

    def add(self, action: str, args: dict, reasoning: str, url: str, image: bytes, changed: bool = True, note: str = "") -> StepRecord:
        step = StepRecord(idx=len(self.steps), action=action, args=args, reasoning=reasoning, url=url, changed=changed, note=note, ts=time.time())
        self.steps.append(step)
        self.screenshots.append(image)
        return step


@dataclass
class SessionDeps:
    browser: BrowserSession
    persona: Persona
    task: TestTask
    recorder: Recorder
    session_id: str = ""
    sink: EventSink | None = None

    async def emit(self, event: dict) -> None:
        if self.sink:
            try:
                await self.sink({"session_id": self.session_id, **event})
            except Exception:
                pass  # a broken live view must never break the session

    @property
    def actions_left(self) -> int:
        # step 0 is the initial page load and does not count against patience
        return self.persona.patience_steps - (len(self.recorder.steps) - 1)


def _strip_old_screenshots(messages: list[ModelMessage]) -> list[ModelMessage]:
    """Keep only the most recent screenshots; older ones dominate cost and add little."""
    seen = 0
    out: list[ModelMessage] = []
    for message in reversed(messages):
        if isinstance(message, ModelRequest):
            parts = []
            for part in reversed(message.parts):
                content = getattr(part, "content", None)
                if isinstance(content, list) and any(isinstance(c, BinaryContent) for c in content):
                    seen += 1
                    if seen > KEEP_SCREENSHOTS:
                        kept = [c for c in content if not isinstance(c, BinaryContent)] + ["[older screenshot removed]"]
                        part = dataclasses.replace(part, content=kept)
                parts.append(part)
            message = dataclasses.replace(message, parts=list(reversed(parts)))
        out.append(message)
    return list(reversed(out))


persona_agent = Agent(
    deps_type=SessionDeps,
    output_type=ExitSurvey,
    capabilities=[ProcessHistory(_strip_old_screenshots)],
    retries=3,
)


# Payment details never go to the model. It types a placeholder and the tool layer fills in the
# real value, so a Gateway guardrail can redact card numbers without breaking checkout.
PRIVATE_FIXTURES = {"card number", "card CVC"}


def _placeholder(key: str) -> str:
    return "{" + key + "}"


def _shown(key: str, value: str) -> str:
    if key in PRIVATE_FIXTURES:
        return f"type {_placeholder(key)} exactly; your browser's saved card fills in the real value"
    return value


def fill_placeholders(text: str, fixtures: dict[str, str]) -> str:
    for key in PRIVATE_FIXTURES & fixtures.keys():
        text = text.replace(_placeholder(key), fixtures[key])
    return text


@persona_agent.instructions
def _instructions(ctx: RunContext[SessionDeps]) -> str:
    p, t = ctx.deps.persona, ctx.deps.task
    fixtures = "\n".join(f"- {k}: {_shown(k, v)}" for k, v in t.fixtures.items()) or "- none"
    reading = (
        "You skim. You read headings and buttons, not paragraphs or fine print."
        if p.reading_style == "skims"
        else "You read everything on the screen carefully before acting."
    )
    savvy = {
        "low": "You are not comfortable with technology. Unfamiliar icons, jargon and error codes confuse you, and you do not guess at hidden conventions.",
        "medium": "You use websites daily but have no patience for anything that does not work the obvious way.",
        "high": "You are very comfortable online and notice sloppy engineering and dark patterns immediately.",
    }[p.tech_savviness]
    return f"""You are {p.name}. Stay in character for the whole session; you are a real person using a website, not a tester or an AI.

About you: {p.bio}
What you want: {"; ".join(p.goals)}
What annoys you: {"; ".join(p.frustrations)}
{savvy}
{reading}
You are on a {p.device}.

Today you want to: {t.goal}

Details you have at hand to type if asked:
{fixtures}

How this works:
- You see a screenshot of the browser. Act through the tools. Coordinates are on a 0-1000 grid: x=0 is the left edge, x=1000 the right edge, y=0 the top, y=1000 the bottom of the visible screen. Aim for the centre of what you click.
- Each action tool takes `reasoning`: one sentence, in first person, on why you are doing this.
- Whenever a screen makes you feel something (confused, annoyed, reassured, suspicious, pleased) or something looks broken, call record_observation before you move on. Be specific about what on the screen caused it. Report what you actually see; never invent problems and never be polite about real ones.
- You have limited patience: about {p.patience_steps} actions. If the site wastes your time you may give up, as a real person would.
- When you have finished, or have given up, return the exit survey honestly."""


async def _act(ctx: RunContext[SessionDeps], action: str, args: dict, reasoning: str, do: Callable[[], Awaitable[str | None]]) -> ToolReturn | str:
    """Run one browser action, record it as a step, and show the persona the result."""
    deps = ctx.deps
    if deps.actions_left <= 0:
        return "Your patience has run out. Do not act further; return the exit survey now."
    before = await deps.browser.fingerprint()
    error = None
    note = ""
    try:
        note = await do() or ""
    except Exception as exc:
        error = f"{type(exc).__name__}: {str(exc).splitlines()[0][:200]}"
    changed = await deps.browser.fingerprint() != before
    image = await deps.browser.screenshot()
    step = deps.recorder.add(action, args, reasoning, deps.browser.url, image, changed=changed, note=error or note)
    await deps.emit({"type": "step", "step": step.model_dump(), "image": image, "actions_left": deps.actions_left})

    left = deps.actions_left
    lines = [f"URL: {deps.browser.url}.", "The page changed." if changed else "Nothing on the page changed."]
    if error:
        lines.append(f"That did not work: {error}")
    lines.append(f"{left} actions of patience left." if left > 0 else "Your patience has run out. Stop and return the exit survey now.")
    content: list = ["The screen now:", BinaryContent(data=image, media_type="image/jpeg")]
    if deps.persona.reading_style == "reads_everything":
        content.append(f"Because you read everything, here is the text on the page:\n{await deps.browser.page_text()}")
    return ToolReturn(return_value=" ".join(lines), content=content)


@persona_agent.tool
async def click(ctx: RunContext[SessionDeps], x: int, y: int, reasoning: str) -> ToolReturn | str:
    """Click at a point on the 0-1000 grid."""
    return await _act(ctx, "click", {"x": x, "y": y}, reasoning, lambda: ctx.deps.browser.click(x, y))


@persona_agent.tool
async def type_text(ctx: RunContext[SessionDeps], x: int, y: int, text: str, reasoning: str, press_enter: bool = False) -> ToolReturn | str:
    """Click a text field at a point on the 0-1000 grid, replace its contents with `text`, and optionally press Enter."""
    real = fill_placeholders(text, ctx.deps.task.fixtures)  # the record keeps the placeholder
    return await _act(ctx, "type_text", {"x": x, "y": y, "text": text}, reasoning, lambda: ctx.deps.browser.type_text(x, y, real, press_enter))


@persona_agent.tool
async def scroll(ctx: RunContext[SessionDeps], direction: Literal["up", "down"], reasoning: str) -> ToolReturn | str:
    """Scroll the page by most of a screen."""
    return await _act(ctx, "scroll", {"direction": direction}, reasoning, lambda: ctx.deps.browser.scroll(direction))


@persona_agent.tool
async def press_key(ctx: RunContext[SessionDeps], key: str, reasoning: str) -> ToolReturn | str:
    """Press a keyboard key, for example Enter, Tab or Escape."""
    return await _act(ctx, "press_key", {"key": key}, reasoning, lambda: ctx.deps.browser.press_key(key))


@persona_agent.tool
async def go_back(ctx: RunContext[SessionDeps], reasoning: str) -> ToolReturn | str:
    """Use the browser's back button."""
    return await _act(ctx, "go_back", {}, reasoning, lambda: ctx.deps.browser.go_back())


@persona_agent.tool
async def record_observation(ctx: RunContext[SessionDeps], kind: ObservationKind, severity: int, text: str) -> str:
    """Note a reaction to the screen you are looking at. Free: does not use up patience.

    kind: bug (something is broken), friction (works but slows you down), confusion (you do not understand),
    delight (pleasantly good), opinion (taste or trust). severity: 1 trivial to 5 would make you leave.
    """
    rec = ctx.deps.recorder
    obs = Observation(step_idx=len(rec.steps) - 1, kind=kind, severity=max(1, min(5, severity)), text=text)
    rec.observations.append(obs)
    await ctx.deps.emit({"type": "observation", "observation": obs.model_dump()})
    return "Noted."
