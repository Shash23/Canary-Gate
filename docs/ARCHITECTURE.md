# CanaryGate — Application & Architecture Summary

## What CanaryGate Does

CanaryGate is a **decision-verification assistant for communication**. It runs **before** you send a message and explains what your message *does in the real world* — not just what it says.

- **It does not block you** — it advises; the human decides.
- **It does not classify “scam or not”** — it evaluates the *action* the message performs (e.g. share code, send money, grant access, click link, make commitment).
- **It is deterministic** — same input always yields the same result. No probabilities or hallucinations at the decision layer.

Users can optionally describe the situation (e.g. “account verification”, “scheduling”). An optional AI layer turns that into structured context; the **rules engine** still makes the final safety decision. AI understands context; rules enforce consequences.

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Frontend (React + Vite)                                         │
│  • Inbox / thread UI (or manual text + context)                 │
│  • Check Email → POST /analyze, POST /interpret_context           │
│  • Result card (risk level, action, explanation) + Send Email     │
└──────────────────────────────┬──────────────────────────────────┘
                               │ HTTP (dev: proxy to backend)
┌──────────────────────────────▼──────────────────────────────────┐
│  Backend (FastAPI)                                               │
│  • POST /analyze     → analyze_service → core engine             │
│  • POST /interpret_context → context_service (OpenAI, optional)  │
│  • GET /health       → { "status": "ok" }                        │
│  • Prod only: serve frontend/dist at /, SPA fallback             │
└──────────────────────────────┬──────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────┐
│  Core (Python, no HTTP)                                           │
│  • rule_loader: load data/behavior_rules.json                     │
│  • engine: tokenize draft + infer contextual tokens               │
│            → action selection → persuasion → risk → explanation  │
│  • models: LoadedRules, EngineResult, ActionRule, etc.           │
└─────────────────────────────────────────────────────────────────┘
```

- **Frontend:** React (Vite). Talks to the backend over HTTP. In dev, Vite proxies API calls to FastAPI; in prod, FastAPI serves the built SPA.
- **Backend:** FastAPI. Thin layer: routes, Pydantic schemas, and two services — one for analysis (engine), one for optional context (OpenAI).
- **Core:** Pure Python. Loads rules from JSON, runs the deterministic pipeline, returns an `EngineResult`. No database, no auth.

---

## Backend Layout

| Layer        | Path                    | Role                                                                 |
|-------------|--------------------------|----------------------------------------------------------------------|
| Entry       | `main.py`                | FastAPI app, CORS, `/health`; in prod, static mount + SPA fallback.  |
| API         | `api/routes.py`          | `POST /analyze`, `POST /interpret_context`.                          |
| Schemas     | `schemas/analyze.py`     | Request/response models (AnalyzeRequest, AnalyzeResponse, etc.).    |
| Services    | `services/analyze_service.py` | Calls `run_analysis(conversation, draft, metadata)`; fills `interpreted_context` if user described situation. |
|             | `services/context_service.py` | Optional OpenAI: `interpret_context(description)` → category, sensitivity, focus_checks. Cached, returns default on failure. |
| Core        | `core/engine.py`        | `analyze(draft, rules, metadata, conversation)` → tokenize, infer contextual tokens, action, persuasion, risk, explanation. |
|             | `core/rule_loader.py`    | Loads `data/behavior_rules.json` into `LoadedRules`.                |
|             | `core/models.py`        | `ActionRule`, `PersuasionRule`, `EngineResult`, etc.                 |
| Data        | `data/behavior_rules.json` | Action rules (keywords, severity, recoverability), persuasion rules, default action, explanation text. |

---

## API Contract

### POST `/analyze`

**Request (normalized):**

- `conversation` (string) — prior messages in the thread (for pressure/conversation signals).
- `draft` (string) — the message the user is about to send.
- `metadata` (object) — e.g. `source`, `recipients`, `attachments`, `user_context_description`, `interpreted_context` (from `/interpret_context` if used).

**Response:**

- `action` — e.g. `SHARE_CODE`, `SEND_MONEY`, `GRANT_ACCESS`, `CLICK_LINK`, `DOWNLOAD`, `MAKE_COMMITMENT`, `UNKNOWN`.
- `risk_level` — `LOW` | `MEDIUM` | `HIGH` (product terms: SAFE, CHECK, STOP_VERIFY).
- `recoverability` — `REVERSIBLE` | `CONDITIONAL` | `IRREVERSIBLE`.
- `pressure_signals` — list of persuasion ids (e.g. `urgency`, `authority`, `fear`, `scarcity`, `familiarity`).
- `explanation` — multi-line human-readable explanation.

Backwards compatibility: sending only `text` is treated as `draft` with empty conversation and metadata.

### POST `/interpret_context`

**Request:** `{ "description": "string" }` (e.g. “account verification”, “scheduling”).

**Response:** `{ "category", "sensitivity", "focus_checks" }` or `{}` if no API key or on failure. Used to augment context for the engine (e.g. virtual tokens); does not change risk formula.

---

## Core Engine Pipeline (Deterministic)

1. **Normalize & tokenize** — Draft text is normalized (lowercase, collapsed whitespace) and split into tokens. No stemming.
2. **Contextual token inference** — Using `metadata.interpreted_context.category` and `conversation`:
   - Account/security verification + 4–8 digit number in draft → add tokens that match “verification code”.
   - Payment/transfer category + currency or large number → add “transfer”.
   - Scheduling/commitment category + commitment phrases → add “commitment_confirmation”.
   - Conversation contains urgency/authority phrases → add tokens that match existing persuasion keywords (e.g. “urgent”, “manager”).
3. **Action selection** — Token list (draft + virtual tokens) is matched against each action’s keywords in `behavior_rules.json`. Winner: highest keyword match count, then severity, then rule order. Zero matches → `UNKNOWN`.
4. **Persuasion detection** — Same token list is matched against persuasion rules → list of pressure signal ids.
5. **Recoverability** — Taken from the selected action’s rule (no text override).
6. **Risk level** — Formula uses action id, severity, recoverability, and pressure signals (e.g. IRREVERSIBLE ≥ MEDIUM; SEND_MONEY/SHARE_CODE + any pressure → HIGH; two+ pressure → escalate; UNKNOWN → LOW). No ML.
7. **Explanation** — Built from the action’s rule (four lines: what you’re asked to do, why scammers use this, what could happen, what to do instead).

All logic is rule-based and reproducible. No external APIs inside the engine; optional OpenAI is only for context interpretation in the service layer.

---

## Frontend (React)

- **App** — State: selected email/thread, reply text, analysis result, loading, error, sent. Orchestrates Check Email (interpret_context + analyze) and Send (simulated; optional confirmations).
- **Components** — MessageInput, ExampleButtons, AnalyzeButton, ResultCard (risk card with border color by level + “Understood Context” when present). Optional: Inbox, ThreadView, ComposeReply for email-simulator flow.
- **API client** — `interpretContext(description)`, `analyzeMessage(draft, metadata)` using relative URLs; Vite dev proxy forwards to FastAPI.

---

## Environment & Serving

- **Development** — `ENV` unset or `dev`: FastAPI serves only API routes (no static files). Run `uvicorn main:app --reload` and `cd frontend && npm run dev`. Use http://localhost:5173; Vite proxies `/analyze`, `/interpret_context`, `/health` to the backend. Frontend hot reloads.
- **Production** — `ENV=prod`: Build frontend (`npm run build`), then run `uvicorn main:app`. FastAPI serves `frontend/dist` at `/`, with `/assets` for JS/CSS and SPA fallback for unknown GETs. Use http://localhost:8000.

---

## Tests

- **Location** — `tests/`: `test_utils.py` (helper `run_case(conversation, draft, context_category)` calling the engine directly), `test_core_behaviors.py` (verification leak, no-context number, commitment, urgency escalation, normal email), `test_regressions.py` (safe phrases stay LOW).
- **Run** — `pytest` from project root (or `python -m pytest tests/`). No HTTP, no mocks; only engine behavior. Protects product behavior from regressions.

---

## Dependencies

- **Backend** — `requirements.txt`: fastapi, uvicorn, pydantic, openai (optional, for context interpretation).
- **Dev** — `requirements-dev.txt`: pytest.
- **Frontend** — React, Vite; no extra UI libs. Build output in `frontend/dist` (gitignored).

---

## Design Principles

- **Determinism** — Same inputs → same outputs. No randomness in the engine.
- **No database / no auth** — Local or embeddable; works without API keys (context interpretation degrades to defaults).
- **Rules over ML for safety** — Final action and risk come from rules; optional AI only enriches context.
- **Embed-ready API** — Single `POST /analyze` with conversation, draft, metadata for future Gmail/Chrome extension use.
