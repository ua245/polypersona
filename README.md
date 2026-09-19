# PolyPersona

A/B test a website with AI persona agents. Each agent is a synthetic customer with a persona and a
limited amount of patience. It uses one variant of your site in a real Chromium browser, inside its own
Modal container, thinks out loud, and records what confused, broke or pleased it. An evaluator agent
then names a winner and cites screenshots as evidence.

- **Live app:** https://polypersona.pages.dev (sign in with an account from `POLYPERSONA_USERS`)
- **API:** https://shehrum--polypersona-web.modal.run
- **Architecture:** [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

## What you need

| Thing | Why | Where to get it |
|---|---|---|
| Python 3.12 and [uv](https://docs.astral.sh/uv/) | runs everything in Python | `brew install uv` |
| Node 20 or newer | builds the UI | `brew install node` |
| Gemini API key | persona agents, evaluator, persona generator | https://aistudio.google.com/apikey |
| Modal account | one container per agent, hosts the API | https://modal.com (free credit is enough) |
| Cloudflare account | hosts the UI (optional, only to deploy it) | https://dash.cloudflare.com |

## Keys and settings

Everything lives in `.env` at the repo root (never committed). Copy `.env.example` and fill it in.

| Variable | Required | Purpose |
|---|---|---|
| `GEMINI_API_KEY` | yes | Gemini access. `GOOGLE_API_KEY` works too. |
| `POLYPERSONA_TOKEN` | for the web app | Long random string. Signs login sessions and is also accepted as a master bearer token. |
| `POLYPERSONA_USERS` | for the web app | Accounts for the UI: `name:password,name2:password2`. |
| `PERSONA_MODEL` | no | Default `gemini-3.8-flash`. |
| `EVALUATOR_MODEL` | no | Default `gemini-pro-latest`. |
| `MODAL_TOKEN_ID`, `MODAL_TOKEN_SECRET` | no | Only if you cannot use `~/.modal.toml`. |

Modal and Cloudflare credentials are not in `.env`. They are stored by their CLIs:
`uv run modal token new` writes `~/.modal.toml`, and `npx wrangler login` stores a Cloudflare OAuth token.

`modal_app.py` ships the whole `.env` to Modal as a secret at deploy time, so **redeploy after changing it**.

## Setup

```bash
# 1. Python side
uv sync
uv run playwright install chromium
cp .env.example .env              # then fill in GEMINI_API_KEY, POLYPERSONA_TOKEN, POLYPERSONA_USERS
uv run pytest                     # offline tests, no API calls

# 2. Modal (once)
uv run modal token new

# 3. UI
cd ui && npm install
```

## Run it

### Option A: command line only (no UI, no deploy)

```bash
uv run python -m polypersona run --headed --personas 1        # watch a real browser on your machine
uv run python -m polypersona run --modal --live --personas 3  # one Modal container per agent, live page
uv run python -m polypersona ask runs/<id> "Why did Sofia fail on B?"
```

Results land in `runs/<timestamp>/report.html` with recordings and a step by step filmstrip.
Other flags: `--variants a,c`, `--repeats 3`, `--audience "busy parents"`, and for your own site
`--url-a … --url-b … --goal "…" --success-text "Order confirmed"`.

### Option B: the web app

```bash
uv run modal deploy modal_app.py          # API + agents on Modal, prints the API URL
cd ui && npm run dev                      # UI at http://localhost:5173
```

If your API URL differs from the default, start the UI with
`VITE_API_URL=https://<you>--polypersona-web.modal.run npm run dev`.

Then in the browser:
1. **Sign in** with an account from `POLYPERSONA_USERS`.
2. **New test**: choose what to compare, who tests it, and a name. Press **Start test**.
3. **Live** tab: watch every agent. Click one to see its screen, its thinking, and to guide or stop it.
4. **Results** tab: verdict, metrics, issues with screenshot evidence, and questions to the evaluator.
5. **Personas**: upload a customer CSV (or describe an audience) to create your own panel.

### Deploy the UI to Cloudflare Pages

```bash
cd ui
npx wrangler login                        # once
npm run build
npx wrangler pages deploy dist --project-name polypersona --branch main --force   # https://polypersona.pages.dev
```

## Costs and limits

- A session uses roughly 100k to 200k Gemini tokens. Three personas on two variants is about 900k tokens and 3 minutes.
- The API caps a test at 10 personas and 3 repeats, and each account at 12 tests a day.
- Viewing tests needs no sign in at the API level. Starting tests, guiding agents, asking the evaluator and creating personas do.

## Pydantic AI Gateway, rule and guardrail (hackathon)

Every persona agent's model call goes through the Pydantic AI Gateway endpoint `persona`, which
injects our optimization rule and applies our guardrail before the request reaches Gemini. Every
agent run, model call and tool call is traced in Logfire. No agent code changes between "rule off"
and "rule on": everything happens in the Gateway.

```
persona agent (Modal container) ──► Gateway endpoint "persona" ──► Gemini (BYOK Custom provider)
                                      ├─ rule: UX evidence protocol (injected into the system message)
                                      └─ guardrail: Payment card number (Redact)
        └── Logfire: one "persona session <id>" trace per session
```

### Setup

1. **Logfire → Gateway → Providers → add a Custom provider:** base URL
   `https://generativelanguage.googleapis.com/v1beta/openai`, API key = your Gemini key, "Require pricing
   data" off. Attach it to an endpoint named **`persona`**. Don't name an endpoint `gemini`: the
   Gateway reserves that name as an alias for its Vertex route.
2. **`.env`:**
   ```
   PYDANTIC_AI_GATEWAY_BASE_URL=https://gateway-eu.pydantic.dev/proxy   # the Gateway root, not the endpoint URL
   PYDANTIC_AI_GATEWAY_API_KEY=<key with "Use AI Gateway">
   LOGFIRE_TOKEN=<key with "Send telemetry">
   PERSONA_MODEL=gateway/persona:gemini-3.8-flash
   ```
   If `PERSONA_MODEL` is missing, the agents silently call Gemini directly and the rule never applies.
   Check this first if a run shows no change.
3. Turn on the tabs by adding `#enableFlags=gateway_optimizations,gateway_guardrails_beta` to your
   Logfire project URL and reloading. **Optimizations** and **Guardrails** then appear under Gateway.

### The rule: `UX evidence protocol`

Gateway → Optimizations → New optimization. Category **Style**, target route **`persona`** (whole route), status **On**:

```
UX EVIDENCE PROTOCOL. Applies to every observation you record.
1. Begin the observation text with the exact visible label or message of the element it concerns, copied character for character inside double quotes. Then write " — " followed by the problem and its effect on you, in 25 words or fewer. Example: "Continue" — pale grey, looks disabled; I hesitated before clicking it.
2. Record one observation per distinct problem. Never combine two problems in one observation.
3. Keep every tool's reasoning argument to 12 words or fewer.
```

**Why:** persona feedback is the product. Without the rule it is loosely worded, so it's hard to
act on, hard to check and hard to merge across personas. With it, every observation names the exact
on-screen element, so it can be found on the page, checked in code and grouped with other reports.

**Result.** Same code, same command, both runs through `persona`; only the rule differs. 3 personas × variants b, c:

| Metric (variant b · variant c) | Rule off | Rule on |
|---|---|---|
| Observations leading with the quoted UI element | 0% · 12% | **100% · 100%** |
| Observations quoting UI text at all | 62% · 62% | **100% · 100%** |
| Quotes found verbatim in the site (not invented) | 12/12 · 4/5 | 19/20 · 3/3 |
| Planted flaws found | 6/6 · 1/1 | 6/6 · 1/1 |
| Reasoning words per action | 8.0 · 7.6 | **5.1 · 5.6** |
| Output tokens per action | 67 · 68 | 64 · 58 |
| Delight observations on c | 5 | 0 (side effect: the rule frames every observation as a problem) |

Same persona, same flaw:
- Rule off: *Form returned raw 'Error 422' without explaining what field or format is invalid. Very sloppy engineering.*
- Rule on: *"Error 422" — raw HTTP status code shown below phone field with no explanation of which input failed or how to fix it.*

### The guardrail: `Payment card number`

Gateway → Guardrails → New protection → **Custom pattern**. Apply to **`persona`**, Action **Redact**:

```
\b(?:\d[ -]?){12,18}\d\b
```

**Why:** personas type a payment card at checkout. The code already keeps it from the model: the
agent types `{card number}` and the browser tool fills in the real value. The guardrail guarantees,
at the network boundary, that a card number never reaches the model, even if one appears in a prompt,
a CSV population or page text. It cleans the **request**; it does not filter the model's response.

### Test it from the UI

There are two UIs: the **PolyPersona web app**, where you run tests and read the personas'
feedback, and **Logfire**, where you see what the Gateway did to each request.

**Before you start:** the web app's agents run in the *deployed* Modal app, which reads `.env` at
deploy time. After setting `PERSONA_MODEL=gateway/persona:gemini-3.8-flash`, redeploy, or UI tests
will call Gemini directly and bypass the rule:

```bash
uv run modal deploy modal_app.py
```

#### A. See the rule change the personas' feedback (PolyPersona web app)

1. **Sign in**, then choose **New test**. Compare the demo shop's variants **b** and **c**, with the 3
   built-in personas, 1 repeat. Press **Start test**.
2. **Live tab:** click any agent, for example Dev on variant b. Watch its observations appear as it
   hits the popup, the account wall, the "Error 422" and the late fee.
   - **Rule on:** every observation starts with the exact on-screen text in quotes, then " — ", for example
     `"Error 422" — raw HTTP status code shown below phone field with no explanation…`. The agent's
     reasoning under each action is short (about 5 words).
   - **Rule off:** the same problems are described in free-form prose, for example
     `Form returned raw 'Error 422' without explaining what field…`.
3. **Results tab:** the verdict and issues are built from those observations. With the rule on,
   issues name the exact button or message, so you can find each one on the page.
4. **Compare:** in Logfire, disable the rule (Gateway → Optimizations → UX evidence protocol →
   disable), start the *same* test again, and compare the two tests' observations. Nothing in the
   app changes between the two tests; only the Gateway does.

#### B. See the card number stay away from the model (PolyPersona web app)

In the Live view, open an agent at the checkout step. The card field the agent typed shows
`{card number}` in its step list, while the checkout still completes: the browser tool fills in the
real card, so the model never handles it. The guardrail is the second layer; section D shows it firing.

#### C. See the rule being applied (Logfire)

1. **Gateway → Optimizations → UX evidence protocol:** check targeting shows route `persona`,
   status **On**. The **Usage** chart shows how many requests the rule ran on and how many it
   changed. If "changed" stays at zero, the rule isn't bound to the route.
2. **Live (traces):** search `persona session dev-b-0` and open one trace from a rule-on test and one
   from a rule-off test. These are the before/after links. Our spans are recorded on our side,
   *before* the Gateway, so they show the request as the agent sent it, without the injected text.
   What differs between the two traces is the model's output: the `record_observation` tool calls
   start with `"<element>" — …` only in the rule-on trace. The Gateway's own proof is the
   `x-pydantic-gateway-optimizations-applied: UX_evidence_protocol` response header, which
   `scripts/gateway_check.py` prints, and the rule's Usage chart.
3. **Gateway → Overview / Spending:** requests and cost accumulate on the `persona` endpoint, which
   proves the calls go through the Gateway.

#### D. See the guardrail fire (Logfire)

1. **Gateway → Guardrails → Custom → Payment card number:** check the regex, **Apply to: `persona`**,
   **Action: Redact**. Observe only records a match and doesn't stop anything.
2. **Pattern tests** on that page: paste each sample. These should **match**: `4242 4242 4242 4242`,
   `4242424242424242`, `4000-0566-5566-5556`, `378282246310005`. These should **not match**:
   `(614) 555-0142`, `ZIP 43215`, `CVC 314`, `09/28`, `2026-09-19`, `Order #1234-5678`.
3. **Make it fire:** run `uv run python scripts/gateway_check.py` (next section). Each card case sends
   the digits and asks the model to echo them back. In Logfire Live, open those requests: our span
   shows the prompt *with* the digits, because it is recorded before the Gateway, and the model's
   answer as `my card is [REDACTED]`. The model can only return the placeholder if the Gateway
   replaced the digits before they reached it. The guardrail's usage count on its page goes up, and the
   script prints the `x-pydantic-gateway-guardrails-applied: Payment_card_number=1/1;redact` header.

### Test it from the command line

**1. Route, rule and guardrail in one command:**

```bash
uv run python scripts/gateway_check.py
```

Expected output: the route is served by provider `gemini`, `optimizations applied: UX_evidence_protocol`, and `7/7`:

| Case | Sent | Model should see | Guardrail header |
|---|---|---|---|
| card, spaced | `my card is 4242 4242 4242 4242` | `my card is [REDACTED]` | `Payment_card_number=1/1;redact` |
| card, no spaces | `card 4242424242424242` | `card [REDACTED]` | redact |
| card, dashes | `use 4000-0566-5566-5556 please` | `use [REDACTED] please` | redact |
| card, 15-digit Amex | `amex 378282246310005` | `amex [REDACTED]` | redact |
| near miss | `call me on (614) 555-0142, ZIP 43215` | unchanged | none |
| near miss | `expiry 09/28, CVC 314` | unchanged | none |
| near miss | `ordered 2026-09-19, order #1234-5678` | unchanged | none |

Each case asks the model to echo the text back character for character. If redaction works, the model
returns the placeholder, which proves it never received the digits.

**2. The rule's before/after on real sessions** (about 3 minutes per run, 6 Modal containers):

```bash
# Gateway → Optimizations → UX evidence protocol → disable, then:
uv run python -m polypersona run --modal --variants b,c --personas 3
# enable it again, then:
uv run python -m polypersona run --modal --variants b,c --personas 3
uv run python scripts/flaw_recall.py runs/<rule-off run> runs/<rule-on run>
```

`scripts/flaw_recall.py` computes the table above in code. It checks every quote against the site's
real text, so invented quotes are caught.

**3. Checkout still works with the guardrail on:**

```bash
uv run python -m polypersona run --modal --variants a --personas 1
```

Expected: `completed`. In `runs/<id>/sessions/*/report.json`, the typed values show `{card number}`
and `{card CVC}`, never the digits.

**4. In Logfire:** search `persona session dev-b-0` and open one trace per run. Our spans are recorded
before the Gateway, so compare the model's *outputs* (the observation format), not the prompts.

## Repository map

```
modal_app.py            Modal app: agent sessions, cloud orchestrator, HTTP API
polypersona/            Python package (agent, browser, evaluator, orchestration, API, CLI)
site/                   Demo coffee shop with variants a, b and c
ui/                     React + Vite + Tailwind front end, deployed to Cloudflare Pages
scripts/                Gateway checks and rule before/after measurement
tests/                  Offline tests
docs/ARCHITECTURE.md    How it all fits together
```

## Troubleshooting

- **401 when starting a test:** sign in again. Sessions last 7 days and are invalidated if `POLYPERSONA_TOKEN` changes.
- **New account or key not working:** run `uv run modal deploy modal_app.py` again, then wait about 20 seconds for old containers to drain.
- **429 from Gemini:** calls back off and retry automatically. Lower `--repeats` or the number of personas if it persists.
- **Agents cannot reach your site:** Modal containers need a public URL. `localhost` only works with Option A without `--modal`.
