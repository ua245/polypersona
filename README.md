# Polypersona

Persona-driven A/B testing. Gemini persona agents each use one variant of a website in a real
Chromium browser, in their own Modal container, and report what confused, broke or pleased them.
An evaluator agent turns their sessions and code-computed metrics into a verdict that cites its evidence.

## Setup

```bash
uv sync
uv run playwright install chromium
cp .env.example .env            # add GEMINI_API_KEY
uv run modal token new          # one-time Modal login, only needed for --modal
uv run pytest                   # offline tests, no API calls
```

## Run

```bash
# Live demo on your machine: visible browsers with a moving cursor
uv run python -m polypersona run --headed --personas 1

# One Modal container per session, with a live dashboard
uv run python -m polypersona run --modal --live --personas 3 --repeats 3

# The subtler demo pair: clean flow vs a plausible redesign
uv run python -m polypersona run --modal --variants a,c --personas 3

# Generated personas
uv run python -m polypersona run --modal --audience "busy parents buying coffee" --personas 5

# Your own site
uv run python -m polypersona run --modal --url-a https://… --url-b https://… \
    --goal "Book a table for two on Friday" --success-text "Booking confirmed"

# Question a finished run
uv run python -m polypersona ask runs/<id> "Why did Sofia fail on B, and what is the cheapest fix?"
```

Every run writes `runs/<timestamp>/`:

- `report.html` – verdict, metrics, issues, and for each session a screen recording and a step-by-step filmstrip
- `live.html` + `live.json` – the live dashboard and its state, updated after every step
- `sessions/<id>/` – `report.json`, one screenshot per step, `session.webm`

## How it works

```
laptop: CLI ── starmap ──► Modal, one container per session
                           ┌───────────────────────────────────────────┐
                           │ PersonaAgent (Pydantic AI + Gemini)       │
                           │   click · type · scroll · press · back    │
                           │   record_observation → ExitSurvey         │
                           │ BrowserSession (Playwright, records webm) │
                           │ demo shop on 127.0.0.1, or your URL       │
                           └───────────────────────────────────────────┘
        ◄── steps + screenshots stream back over a modal.Queue (live view)
        ◄── report JSON, screenshots, recording
laptop: metrics.py (pure code) ─► Evaluator agent ─► report.html
```

- **Behavioural personas.** Patience is a hard action budget enforced in the tool layer. The
  device sets the viewport, and mobile personas tap instead of click. Personas who read everything
  also receive the page text. Agents are never told they are in an A/B test.
- **Completion is verified in code**, from the final URL, visible text or a CSS selector. With no
  check configured it falls back to the persona's claim, and the report says so.
- **Change detection uses the DOM**, form values, focus and scroll position, not pixels, so a dead
  click is a click that changed nothing a person could see. Each step records what the click landed on.
- **Metrics are computed in code**: completion, actions, duration, dead clicks, backtracks, errors,
  tokens. The evaluator interprets them, must cite `session#step` for every issue, can open any
  screenshot, and may answer "no clear winner".
- **Resilience.** Gemini calls back off on 429 and 5xx. Each session has a 600 s wall-clock limit.
  A crashed session becomes a report with `outcome="error"`, and its steps are already on disk.

## Demo shop (`site/`)

| Variant | What it is |
|---|---|
| `a` | Clean single-page guest checkout. Has two small real bugs the agents found on their own. |
| `b` | Dark patterns: popup, forced account, "Error 422" on phone numbers, late handling fee, inverted buttons. |
| `c` | Plausible redesign of `a`: "Buy now", email for the receipt, cart clears. Adds a pre-ticked subscription. |

## Configuration

| Variable | Default | |
|---|---|---|
| `GEMINI_API_KEY` | – | required |
| `PERSONA_MODEL` | `gemini-3.8-flash` | model for persona agents and the persona generator |
| `EVALUATOR_MODEL` | `gemini-pro-latest` | model for the verdict and `ask` |

## Limitations

- Below 3 repeats per persona and variant, results are directional. The CLI warns about this.
- Clicks use a 0–1000 grid over the screenshot, so accuracy depends on the model.
- Simulated users tolerate friction differently from real ones. Use this to find problems early, not to replace user research.
- The live view binds to localhost and has no authentication.

## Pydantic AI Gateway, Modal endpoint and Logfire

Persona agents can run on an open-weight model served by a Modal endpoint and reached only
through the Pydantic AI Gateway. The Gateway holds the Modal credentials (BYOK), applies
optimization rules and guardrails, and every call is traced in Logfire.

```
persona agent ──► Pydantic AI Gateway (route "modal": rules, guardrails) ──► Modal endpoint (vLLM, gemma-4-31B-it)
       └── Logfire traces (agent runs, model calls, tool calls)
```

1. `uv run modal workspace proxy-tokens create`, then `modal endpoint create --name gateway --model google/gemma-4-31B-it`.
2. In Logfire → Gateway, add a provider named `modal` with base URL `<endpoint-url>/v1` and the proxy token.
3. In `.env`, set `PYDANTIC_AI_GATEWAY_BASE_URL`, `PYDANTIC_AI_GATEWAY_API_KEY`, `LOGFIRE_TOKEN` and
   `PERSONA_MODEL=gateway/modal:google/gemma-4-31B-it`. Any `gateway/<route>:<model>` string works (`polypersona/llm.py`).
4. Run the same command twice, rule disabled and enabled, and compare:

```bash
uv run python -m polypersona run --modal --variants b,c --personas 3
uv run python scripts/flaw_recall.py runs/<before> runs/<after>
```

`scripts/flaw_recall.py` counts, in code, how many of the demo shop's planted flaws the personas
reported. It also prints the quote behind each match. Card numbers never reach the model: personas
type `{card number}` and the tool layer fills in the real value, so a Gateway guardrail can redact
them without breaking checkout.
