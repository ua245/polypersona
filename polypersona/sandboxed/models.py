from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

Viewport = Literal["desktop", "mobile"]
VIEWPORTS: dict[Viewport, tuple[int, int]] = {"desktop": (1280, 800), "mobile": (390, 844)}


class Persona(BaseModel):
    id: str
    name: str
    bio: str
    goals: list[str]
    frustrations: list[str]
    tech_savviness: Literal["low", "medium", "high"]
    # Patience is a hard budget of browser actions, enforced in the tool layer.
    patience_steps: int = Field(ge=3, le=60)
    viewport: Viewport
    reading_style: Literal["skims", "reads everything"]


class TestTask(BaseModel):
    id: str
    start_path: str = "/"
    # Written as the persona's own need; it never mentions variants or testing.
    goal: str
    # Checked in code against the sandbox database, never by asking the agent.
    success_event_id: str
    success_quantity: int


class StepRecord(BaseModel):
    idx: int
    action: str
    args: dict
    intent: str
    url: str
    title: str
    screenshot: str  # path relative to the run directory
    changed: bool
    note: str = ""
    error: str | None = None
    ts: datetime
    elapsed_ms: int


ObservationKind = Literal["bug", "friction", "confusion", "delight", "opinion"]


class Observation(BaseModel):
    step_idx: int
    kind: ObservationKind
    severity: int = Field(ge=1, le=5)
    text: str
    screenshot: str


class ExitSurvey(BaseModel):
    """What the persona says when they stop, in their own voice."""

    believes_completed: bool = Field(description="Do you think you managed to do what you came to do?")
    ease_1_to_5: int = Field(ge=1, le=5, description="How easy was it? 1 = very hard, 5 = very easy")
    would_return: bool = Field(description="Would you use this site again?")
    summary: str = Field(description="Two or three sentences in your own voice about how it went.")
    biggest_problem: str | None = Field(default=None, description="The worst moment, if any.")


Outcome = Literal["completed", "gave_up", "out_of_steps", "error"]
SessionStatus = Literal["queued", "starting", "running", "finished"]


class SessionReport(BaseModel):
    session_id: str
    persona: Persona
    variant: Literal["A", "B"]
    repeat: int
    sandbox_id: str | None = None
    status: SessionStatus = "queued"
    outcome: Outcome | None = None
    # Ground truth from the sandbox database, not the agent's opinion.
    verified_order: dict | None = None
    steps: list[StepRecord] = []
    observations: list[Observation] = []
    exit_survey: ExitSurvey | None = None
    started_at: datetime | None = None
    finished_at: datetime | None = None
    duration_s: float | None = None
    error: str | None = None
    input_tokens: int = 0
    output_tokens: int = 0
    model_requests: int = 0


class VariantMetrics(BaseModel):
    variant: Literal["A", "B"]
    sessions: int
    completed: int
    completion_rate: float
    median_steps_to_complete: float | None
    median_duration_s: float | None
    mean_ease: float | None
    backtracks: int
    dead_clicks: int
    errors: int
    observations_by_kind: dict[str, int]


class Issue(BaseModel):
    title: str
    variant: Literal["A", "B", "both"]
    severity: int = Field(ge=1, le=5)
    affected_personas: list[str]
    evidence: list[str] = Field(description="Citations as '<session_id>#<step_idx>'")


class EvaluatorReport(BaseModel):
    winner: Literal["A", "B", "no clear winner"]
    confidence: Literal["low", "medium", "high"]
    headline: str
    reasoning: str
    issues: list[Issue]
    segment_notes: list[str] = Field(description="How different kinds of people fared, e.g. mobile vs desktop.")
    caveats: list[str]
