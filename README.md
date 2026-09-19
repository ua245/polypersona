# PolyPersona

Persona-driven A/B testing. Gemini persona agents each use one variant of a website in
**their own Modal sandbox**, and report what confused, broke or pleased them. An evaluator
turns the sessions and code-computed metrics into a verdict you can check against the evidence.

## Setup

```bash
uv sync
uv run modal setup            # one-time Modal login (writes ~/.modal.toml)
cp .env.example .env          # then fill in GOOGLE_API_KEY and GEMINI_MODEL
uv run pytest                 # offline tests
```

## Watch persona agents live

```bash
uv run python -m polypersona.web       # open http://127.0.0.1:8765
```

Pick personas, then press **Start run**. For every persona the dashboard shows variant A and
B side by side, updating live:
- the sandbox ID;
- the latest screenshot from Chromium inside that sandbox;
- each action with the agent's stated intent;
- observations pinned to the step they refer to;
- the exit survey and token usage.

When the sessions finish, the dashboard shows the metrics table and the evaluator's verdict.
Click an evidence citation (`session#step`) to jump to that screenshot. Earlier runs stay
available from the run picker, for replay.

## How it works

```
coordinator (your machine, holds GOOGLE_API_KEY)          Modal, one sandbox per session
┌───────────────────────────────────────────┐          ┌──────────────────────────────────┐
│ orchestrator: personas × {A,B} × repeats  │  create  │ site (SITE_VARIANT=A|B) :8080    │
│   └ PersonaAgent (Pydantic AI + Gemini)   │ ───────► │ SQLite orders db                 │
│       tools: click/type/press/scroll/back │   exec   │ browser_server.py (Chromium)     │
│              record_observation, finish   │ ◄──────► │   screenshots → copied back      │
│ metrics.py (pure code) → Evaluator agent  │          │ no secrets, block_network=True   │
│ dashboard (127.0.0.1:8765)                │          └──────────────────────────────────┘
└───────────────────────────────────────────┘
```

- **One sandbox per session.** Each session gets a fresh sandbox from the same seeded
  snapshot, with its own copy of the site, its own database and its own browser. It is
  terminated as soon as the session ends.
- **The agent runs on your machine.** The persona agent runs in the backend. Each tool call
  goes to its own sandbox through `SessionDeps`, so the model never chooses a sandbox, and
  the Gemini key never enters one.
- **Behavioural personas.** Patience is a hard action budget, and the viewport is desktop
  or mobile with touch. People who read everything also get the page text. Agents are never
  told they are in an A/B test.
- **Completion is checked in code.** It comes from the sandbox's order database, not from
  the agent's claim. Dead clicks, backtracks, steps and duration are also computed in code.
- **Evidence.** Every observation is pinned to a step and its screenshot, and the evaluator
  must cite `session#step` for each issue.

## Test site (`sites/shop`)

| | Variant A (original) | Variant B (redesign) |
|---|---|---|
| Event list | no prices, only a small "more info" link | prices and a "Buy tickets" button |
| Quantity | free-text box | − / + stepper |
| Checkout | promo box, unmarked required phone, terms box, generic error, booking fee | name + email, inline errors, "Pay $X" |

Variant A's error page also clears the terms checkbox. The first live run found this without being told.

## Multi-sandbox smoke test

```bash
uv run python -m polypersona.sandbox.smoke [--branches 3] [--fail-branch B] [--cancel-after 20]
uv run python -m polypersona.sandbox.cleanup --tagged     # remove leftovers after a crash
```

## Limitations

- With 1 repeat per persona and variant, results are only directional. The dashboard warns
  below 3 repeats.
- Personas are fixtures, and there is one task. A PersonaGenerator is not built yet.
- Clicks use a 0–1000 grid over the screenshot. Accuracy depends on the model.
- Token usage comes from the API. No cost figures are shown.
- The dashboard binds to localhost and has no authentication.
