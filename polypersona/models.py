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


class EvaluatorReport(BaseModel):
    winner: str = Field(description="The variant_id that works best, or 'no clear winner' when the evidence is mixed or too thin.")
    confidence: Literal["low", "medium", "high"]
    rationale: str
    issues: list[Issue]
    per_persona_notes: list[str]
    caveats: list[str]
