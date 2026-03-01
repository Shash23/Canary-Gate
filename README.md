# 🐤 CanaryGate

**Safety for communication.**  
Clear guidance before you send. Risk visibility without surveillance.

---

## What it does

CanaryGate is a **pre-send safety checkpoint** for email. Before a message is sent, it answers one question:

> *What happens if this is sent?*

- **In Gmail:** A Chrome extension analyzes your draft and thread, then shows **SAFE**, **REVIEW**, or **STOP_VERIFY** with a plain-English explanation and “Situation Understanding” (e.g. *“You’re replying to someone outside your org who’s asking for a verification code”*). For risky replies, it suggests a safer alternative. You still choose: send, edit, or cancel.
- **For you:** A private **protection history** — how many messages you’ve had checked, how often you were warned, and how many risky sends you avoided. No one else sees your content.
- **For the org:** A **manager dashboard** with company risk level, a live **exposure feed** (“Credential sharing attempts increasing”, “Unusual outbound volume”), and incident-style cards — patterns and risk only, no email bodies and no names by default.

We don’t block. We don’t classify “phish or not.” We **explain the consequence** and **record the decision** so people and companies can see human-layer risk without surveillance.

---

## Why we built it

- **Most incidents are human decisions** — sharing a code, sending money, clicking under pressure — not just “getting hacked.”
- **Tools today are after the fact** (detect the breach) or **all-or-nothing** (block/allow). There’s no lightweight “pause and think” layer.
- **CanaryGate adds that layer:** one clear checkpoint before send, with explanations and optional safer wording, and a record of what people did. Rules decide; optional AI only makes the copy clearer.

---

## Tech stack

| Layer        | Stack |
|-------------|--------|
| **Frontend** | React, Vite, CSS |
| **Backend**  | FastAPI, Python 3, Pydantic |
| **Engine**   | Deterministic rule-based (no ML in the decision path) |
| **Extension**| Chrome Manifest V3, vanilla JS |
| **Storage**  | In-memory (no DB for the demo) |

---

## Quick start

**1. Backend**

```bash
uvicorn main:app --reload
```

**2. Frontend**

```bash
cd frontend && npm install && npm run dev
```

Open **http://localhost:5173** — log in as **Employee** or **Manager** (no password; role is stored in the browser).

**3. Chrome extension (optional, for real Gmail check-before-send)**

- Open `chrome://extensions`, enable **Developer mode**, **Load unpacked**
- Select the `phishpup-extension` folder
- Ensure the backend is running on port 8000; the extension calls `http://localhost:8000/analyze`

---

## Docs

- [APPLICATION_DESCRIPTION.md](APPLICATION_DESCRIPTION.md) — Product summary and one-liner.
- [docs/](docs/) — Internal docs: architecture, requirements, app state, system workflow.

---

## Project structure

```
├── main.py              # FastAPI app, CORS, /health
├── api/routes.py        # /analyze, /decision, /decisions, /risk-feed
├── core/engine.py      # Deterministic action + risk engine
├── services/           # analyze, context, explanation, risk_narrative, data_checker
├── frontend/           # React app (Landing, Employee view, Manager dashboard)
└── phishpup-extension/ # Gmail extension (popup + content script)
```

---

## API at a glance

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/analyze` | Analyze draft + conversation → action, risk_level, explanation, suggestion_rewrite, context |
| `POST` | `/decision` | Record user decision (sent / edited / cancelled) |
| `GET`  | `/decisions` | All decisions (newest first) |
| `GET`  | `/risk-feed` | Risk narratives for the exposure feed |

No auth required for the demo.

---

## Screenshots

*Add a screenshot of the landing page, extension popup, and manager dashboard here for maximum hackathon impact.*

---

## What’s next

- More channels (Slack, Outlook)
- Attachment and link depth analysis
- Policy-driven thresholds and alerts
- Optional SSO and audit log export

---

**CanaryGate** — Safety for communication. No surveillance.

*Built for [Your Hackathon Name].*
