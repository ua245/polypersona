from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

ObservationKind = Literal["bug", "friction", "confusion", "delight", "opinion"]
Outcome = Literal["completed", "gave_up", "out_of_steps", "error"]


class Persona(BaseModel):
    id: str
    name: str
    bio: str = Field(description="Two or three sentences: age, job, life context.")
    goals: list[str]
    frustrations: list[str]
    tech_savviness: Literal["low", "medium", "high"]
    patience_steps: int = Field(ge=8, le=40, description="Browser actions this person tolerates before giving up.")
    device: Literal["desktop", "mobile"] = "desktop"
    reading_style: Literal["skims", "reads_everything"] = "skims"
    viewport: str | None = Field(default=None, description="Optional 'WIDTHxHEIGHT' of this person's screen, e.g. from customer data.")
    details: dict[str, str] = Field(default_factory=dict, description="Extra facts about the person, e.g. past purchases or home city.")
    source: str | None = Field(default=None, description="Where the persona came from, e.g. 'customers.csv row 14'.")


class TestTask(BaseModel):
    variant_id: str
    url: str = Field(description="Start URL. 'demo://a' and 'demo://b' serve the bundled demo shop.")
    goal: str
    fixtures: dict[str, str] = Field(default_factory=dict, description="Data the persona may type, e.g. address, card.")
    access_headers: dict[str, str] = Field(default_factory=dict, description="Headers sent only to the site under test, so its owner can allow these agents through bot protection.")
    # Completion is verified in code. Every check that is set must pass; with none set, the persona's own claim is used.
    success_url_contains: str | None = None
    success_text_contains: str | None = Field(default=None, description="Text that must appear on the final page or in a pop-up message. Separate alternatives with '|'.")
    success_selector: str | None = Field(default=None, description="CSS selector that must exist on the final page.")

    @property
    def completion_check(self) -> str:
        checks = []
        if self.success_url_contains:
            checks.append(f"final URL contains '{self.success_url_contains}'")
        if self.success_text_contains:
            checks.append(f"the site showed the text '{self.success_text_contains}' (on the page or in a pop-up message)")
        if self.success_selector:
            checks.append(f"final page has an element matching '{self.success_selector}'")
        return "verified in code: " + " and ".join(checks) if checks else "self-reported by the persona (no check configured)"


class StepRecord(BaseModel):
    idx: int
    action: str
    args: dict = Field(default_factory=dict)
    reasoning: str = ""
    url: str = ""
    changed: bool = True
    note: str = Field(default="", description="What the action landed on, e.g. 'clicked button: Continue'.")
    ts: float = 0.0


class Observation(BaseModel):
    step_idx: int
    kind: ObservationKind
    severity: int = Field(ge=1, le=5)
    text: str


class ExitSurvey(BaseModel):
    """Filled in by the persona once they finish or give up."""

    believes_completed: bool
    ease: int = Field(ge=1, le=5, description="1 = very hard, 5 = very easy")
    trust: int = Field(ge=1, le=5, description="1 = would not trust this site, 5 = fully trust it")
    would_return: bool
    summary: str = Field(description="In first person, how the experience felt, in three or four sentences.")
    biggest_problem: str | None = None


class SessionReport(BaseModel):
    session_id: str
    goal: str = ""  # what the persona was asked to try
    persona: Persona
    variant_id: str
    outcome: Outcome
    steps: list[StepRecord] = Field(default_factory=list)
    observations: list[Observation] = Field(default_factory=list)
    exit_survey: ExitSurvey | None = None
    duration_s: float = 0.0
    completion_check: str = ""
    input_tokens: int = 0
    output_tokens: int = 0
    model_requests: int = 0
    error: str | None = None


class VariantMetrics(BaseModel):
    variant_id: str
    sessions: int
    completion_rate: float
    mean_steps: float
    mean_duration_s: float
    dead_clicks: int
    backtracks: int
    mean_ease: float | None
    mean_trust: float | None
    observations_by_kind: dict[str, int]
    mean_negative_severity: float | None
    errors: int = 0
    input_tokens: int = 0
    output_tokens: int = 0


class Issue(BaseModel):
    variant_id: str
    title: str
    kind: ObservationKind
    severity: int = Field(ge=1, le=5)
    affected_personas: list[str]
    evidence: list[str] = Field(description="References formatted as '<session_id>#<step_idx>'.")
    recommendation: str


class Suggestion(BaseModel):
    """One change the site owner should make, judged against what they are trying to achieve."""

    title: str = Field(description="The change, as an instruction: 'Show pricing before the signup form'.")
    change: str = Field(description="What exactly to build or alter, specific enough for a designer or engineer to act on.")
    serves_goal: str = Field(description="How this moves the owner's objective or helps people complete the task, in one or two sentences.")
    impact: Literal["low", "medium", "high"] = Field(description="Expected effect on the objective.")
    effort: Literal["low", "medium", "high"] = Field(description="Rough cost to implement.")
    affected_personas: list[str] = Field(default_factory=list)
    evidence: list[str] = Field(default_factory=list, description="References formatted as '<session_id>#<step_idx>'.")


class EvaluatorReport(BaseModel):
    winner: str = Field(description="The variant_id that works best, or 'no clear winner' when the evidence is mixed or too thin. For a single-site study: 'single site'.")
    headline: str = Field(default="", description="One short sentence a busy person could act on, e.g. 'People like the demo but will not sign up without pricing.'")
    confidence: Literal["low", "medium", "high"]
    rationale: str
    issues: list[Issue]
    suggestions: list[Suggestion] = Field(default_factory=list, description="Improvements in priority order, most valuable first.")
    per_persona_notes: list[str]
    caveats: list[str]
