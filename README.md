# PolyPersona

Persona-driven A/B testing. Gemini persona agents click through two variants of a site,
each in its own fresh browser, and report what confused, broke or pleased them. An
evaluator turns their sessions into a verdict you can question.

## Setup

```bash
uv sync
uv run playwright install chromium   # local mode only
uv run modal setup                   # Modal mode only
cp .env.example .env                 # add GOOGLE_API_KEY
```

## Run

```bash
# One Modal container per session (agent + Chromium together)
uv run python -m polypersona run --modal --personas 3 --repeats 1

# Locally; --headed shows the browsers with a visible cursor
uv run python -m polypersona run --personas 1 --headed

# Generated personas, or your own two URLs
uv run python -m polypersona run --modal --audience "busy parents buying coffee" --personas 4
uv run python -m polypersona run --url-a https://a.example --url-b https://b.example \
    --goal "Buy a bag of coffee" --success-url /thank-you

# Ask the evaluator about a finished run
uv run python -m polypersona ask runs/<timestamp> "Why did Sofia give up on B?"
```

Each run writes `runs/<timestamp>/report.html`, containing:
- the verdict and the metrics;
- the issues, with evidence;
- for each session, every step's screenshot and the persona's reasoning;
- a screen recording of each session.

## How it works

| File | Role |
|---|---|
| `modal_app.py` | Modal image (Playwright + Chromium) and `run_session_remote`. With `--modal`, sessions fan out through `starmap`, one container each. |
| `polypersona/session.py` | One persona, one variant, one fresh browser. It serves the bundled demo shop (`site/`) when the URL is `demo://a` or `demo://b`. |
| `polypersona/persona_agent.py` | Pydantic AI agent with the tools `click`, `type_text`, `scroll`, `press_key`, `go_back` and `record_observation`. Patience is a hard action budget, and only the last 3 screenshots are kept in history. |
| `polypersona/browser.py` | Playwright wrapper: 0–1000 click grid, visible cursor, video recording. |
| `polypersona/personas.py` | Built-in personas and demo tasks; a persona generator for `--audience`. |
| `polypersona/metrics.py` | Completion, steps, duration, dead clicks and backtracks, computed in code. |
| `polypersona/evaluator.py` | An evaluator agent that cites `session#step` evidence, checks screenshots, and answers `ask`. |
| `polypersona/store.py` | Saves runs, reloads them, and renders the HTML report. |
| `ui/` | React + Vite + Tailwind front end (in progress). |
