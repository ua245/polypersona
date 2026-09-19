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

## Repository map

```
modal_app.py            Modal app: agent sessions, cloud orchestrator, HTTP API
polypersona/            Python package (agent, browser, evaluator, orchestration, API, CLI)
site/                   Demo coffee shop with variants a, b and c
ui/                     React + Vite + Tailwind front end, deployed to Cloudflare Workers
tests/                  Offline tests
docs/ARCHITECTURE.md    How it all fits together
```

## Troubleshooting

- **401 when starting a test:** sign in again. Sessions last 7 days and are invalidated if `POLYPERSONA_TOKEN` changes.
- **New account or key not working:** run `uv run modal deploy modal_app.py` again, then wait about 20 seconds for old containers to drain.
- **429 from Gemini:** calls back off and retry automatically. Lower `--repeats` or the number of personas if it persists.
- **Agents cannot reach your site:** Modal containers need a public URL. `localhost` only works with Option A without `--modal`.
