# CanaryGate — Full Application State (for AI context)

Use this document to bring ChatGPT or another AI up to speed on the current state of the CanaryGate application.

---

## 1. Product overview

**Name:** CanaryGate

**Tagline:** “A seatbelt for communication. Employees get airbags. Companies get crash analytics.”

**Positioning:** Human-layer security / insider risk / data loss prevention. Not “phishing detection” — the system detects when people are about to leak sensitive data or take risky actions and records whether they heeded the warning. **Employees see content (their own); managers see risk (patterns only, no email bodies by default).**

**Core principle:** Rules decide; AI explains. The deterministic engine produces SAFE / REVIEW / STOP_VERIFY; optional GPT adds human-readable explanation. No ML in the decision path.

---

## 2. Tech stack

| Layer | Stack |
|-------|--------|
| Frontend | React 19, Vite 7, CSS only (no UI framework) |
| Backend | FastAPI, Python 3, Pydantic |
| Core engine | Pure Python, no HTTP, loads `data/behavior_rules.json` |
| Extension | Chrome Manifest V3, vanilla JS, popup + injected script |
| Storage | In-memory only (no database) |
| Auth | None. Demo uses role-only “login”: choose Employee or Manager; role stored in `localStorage` key `canarygate_role`. |

---

## 3. Repository structure (relevant paths)

```
├── main.py                 # FastAPI app, CORS, /health, prod static serve
├── api/routes.py           # POST /analyze, POST /interpret_context, POST /decision, GET /decisions
├── schemas/analyze.py      # AnalyzeRequest, AnalyzeResponse (action, risk_level, explanation, detected_data, suggestion_rewrite)
├── schemas/decision.py     # DecisionRequest, DecisionRecord (timestamp, user_identifier, role, draft, conversation, recipients, detected_action, risk_level, pressure_signals, explanation, user_decision)
├── services/analyze_service.py   # run_analysis → data_checker → optional LLM explanation; returns AnalyzeResponse with suggestion_rewrite
├── services/context_service.py   # Optional OpenAI: interpret_context(description) → category, sensitivity, focus_checks
├── services/data_checker.py      # Deterministic patterns on draft+conversation+attachments: SSN, 6-digit code, API key, confidential, financial, external recipient, internal→external
├── services/explanation_service.py # Optional GPT: human-readable explanation from rule output (detected_action, risk_level, pressure_signals, etc.)
├── core/engine.py          # Deterministic: tokenize → contextual tokens → action selection → persuasion → risk level → explanation
├── core/rule_loader.py     # Load behavior_rules.json
├── core/models.py          # ActionRule, PersuasionRule, EngineResult, etc.
├── data/behavior_rules.json # Action keywords, severity, recoverability, persuasion rules
├── frontend/
│   ├── public/logo.png     # CanaryGate logo (used on landing)
│   ├── index.html          # Title: CanaryGate
│   ├── src/
│   │   ├── App.jsx         # Auth state (canarygate_role); renders Landing | EmployeeView | ManagerDashboard
│   │   ├── main.jsx
│   │   ├── api/client.js   # interpretContext(), analyzeMessage(), fetchDecisions()
│   │   ├── components/
│   │   │   ├── Landing.jsx       # Hero, logo, features, Log in CTA; no auth form
│   │   │   ├── LoginModal.jsx    # Choose "Employee" or "Manager / Legal"
│   │   │   ├── EmployeeView.jsx  # Personal protection history only (stats from gmail-extension + web-simulated)
│   │   │   ├── ManagerDashboard.jsx # Tier 1 (company risk + breakdown), Tier 2 (incident cards, no email body), Tier 3 (HIGH only: sanitized message + explanation)
│   │   │   ├── SecurityDashboard.jsx # (Present but not in main flow; Manager view uses ManagerDashboard)
│   │   │   ├── ResultCard.jsx    # Risk card + Detected Data + explanation (used if Test Analyzer is re-added)
│   │   │   ├── MessageInput.jsx, AnalyzeButton.jsx, ExampleButtons.jsx
│   └── vite.config.js      # Proxy /analyze, /interpret_context, /decision, /decisions, /health to backend
└── phishpup-extension/     # Chrome extension (folder name unchanged; product name is CanaryGate)
    ├── manifest.json       # name: CanaryGate, host_permissions: Gmail + localhost:8000
    ├── popup.html          # CanaryGate Security Check, status, summary, explanation, Safer alternative, Detected Data, Show Details
    ├── popup.js            # Inject extract.js → POST /analyze → show SAFE/REVIEW/STOP_VERIFY + explanation + suggestion_rewrite + detected_data
    ├── popup.css
    └── extract.js          # Gmail: findEditor (compose/reply), return { draft, conversation, recipients }; waitForCompose (MutationObserver)
```

---

## 4. Backend API (current)

| Method | Path | Purpose |
|--------|------|---------|
| GET | /health | `{ "status": "ok" }` |
| POST | /interpret_context | Body: `{ "description": "string" }`. Returns `{ category, sensitivity, focus_checks }` or `{}`. Optional OpenAI. |
| POST | /analyze | Body: `conversation`, `draft`, `metadata` (source, recipients, attachments, role, internal_domains, user_context_description, interpreted_context). Returns: `action`, `risk_level`, `recoverability`, `pressure_signals`, `explanation`, `detected_data[]`, `suggestion_rewrite`. **Every call is also appended to in-memory decision store** with `user_decision="analyzed"`. |
| POST | /decision | Body: same as DecisionRecord fields (timestamp, user_identifier, role, draft, conversation, recipients, detected_action, risk_level, pressure_signals, explanation, user_decision). Appends to store. |
| GET | /decisions | Returns all decision records, newest first. No auth. |

**Analyze response fields:** `action` (e.g. SHARE_CODE, SEND_MONEY), `risk_level` (LOW/MEDIUM/HIGH), `recoverability`, `pressure_signals` (e.g. urgency, authority), `explanation` (from LLM if OPENAI_API_KEY set, else engine), `detected_data` (e.g. "Authentication code", "External recipient"), `suggestion_rewrite` (safer alternative text when risk not LOW).

**Decision record fields:** `timestamp`, `user_identifier`, `role`, `draft`, `conversation`, `recipients`, `detected_action`, `risk_level`, `pressure_signals`, `explanation`, `user_decision` (e.g. analyzed, sent, edited, cancelled).

---

## 5. Frontend flows (current)

1. **Unauthenticated:** Landing page only. Logo (header + hero), “A seatbelt for communication”, two feature cards, “Log in to get started” and header “Log in”.
2. **Login:** Click Log in → modal with “Employee” and “Manager / Legal”. Clicking one sets `localStorage.canarygate_role` and renders the corresponding view. No username/password.
3. **Employee view:** Header “CanaryGate — Your safety”, Log out. Content: “Personal protection history” (private), stats: potential incidents prevented, messages analyzed, times warned, most common risk. Data filtered to `user_identifier` in `['gmail-extension', 'web-simulated']`. No raw emails, no company scores.
4. **Manager view:** Header “CanaryGate — Risk dashboard”, Log out. Disclaimer: patterns only, no email content by default. **Tier 1:** Company human risk level (HIGH/MEDIUM/LOW) + reason; breakdown: credential sharing attempts, external domain interactions, urgent/authority messages (counts only, no names). **Tier 2:** Incident cards: title (e.g. Potential account takeover risk), employee role, external recipient, action, exposure level; no email body. **Tier 3:** Click HIGH-severity card → investigation panel: sanitized message (first 80 chars + “[content redacted]”), detected risky content (explanation), employee decision. No full draft or conversation.
5. **Test Analyzer:** Not in current nav; previously allowed manual draft + context + “Analyze Message” calling POST /analyze and showing ResultCard. Can be re-added if needed.

---

## 5a. Employee view (detailed)

**Purpose:** Safety copilot. “We protect you, not monitor you.” The employee never sees company-wide scores or other people’s data.

**Access:** Log in → choose **Employee**. Role stored as `canarygate_role = 'employee'`. No username or password.

**Data source:** `GET /decisions`; frontend filters to records where `user_identifier` is in `['gmail-extension', 'web-simulated']` (treats these as “my” activity).

**UI:**
- **Header:** “CanaryGate — Your safety”, **Log out** button.
- **Copy:** “Personal protection history” and “This page is only visible to you. Managers cannot see your messages or this summary.”
- **Stats (aggregate only, no raw emails):**
  - **Potential incidents you prevented** — count where `user_decision` is `edited` or `cancelled`.
  - **Messages analyzed** — total count of filtered decisions.
  - **Times you were warned (SAFE / CHECK / STOP)** — count of HIGH + MEDIUM risk.
  - **Most common risk in your traffic** — e.g. “share code (2 times)” from highest-frequency `detected_action`.
- **Footer:** “Use the Gmail extension to get instant feedback before you send. You’ll see SAFE, CHECK, or STOP & VERIFY plus a safer alternative when needed.”

**What the employee does NOT see:** Company risk level, other users, raw email bodies, full incident list with details, manager-only breakdowns.

**Component:** `frontend/src/components/EmployeeView.jsx`. Polls `/decisions` every 5 seconds.

---

## 5b. Manager view (detailed)

**Purpose:** Risk radar. Understand organizational exposure without spying on individuals. Managers never see raw employee emails by default.

**Access:** Log in → choose **Manager / Legal**. Role stored as `canarygate_role = 'manager'`.

**Data source:** `GET /decisions`; all records (organization-wide). No per-user filter.

**UI:**

- **Header:** “CanaryGate — Risk dashboard”, **Log out** button.
- **Disclaimer:** “Patterns and anonymized risk only. No employee email content by default.”

- **Tier 1 — Company overview (default, no names):**
  - **Company human risk level:** HIGH / MEDIUM / LOW with one-line reason (e.g. “Authentication credential or verification code shared with external party.”).
  - **Breakdown (counts only):**
    - Credential sharing attempts — count where `detected_action === 'SHARE_CODE'`.
    - External domain interactions — count where `recipients.length > 0`.
    - Urgent / authority pressure messages — count where `pressure_signals` includes `urgency` or `authority`.

- **Tier 2 — Incident alerts (no email body):**
  - Cards for each decision (newest first, up to 30). Each card shows:
    - **Title** — e.g. “Potential account takeover risk”, “Payment or transfer risk” (from `detected_action`).
    - **Employee role** — from record `role` or “General”.
    - **External recipient domain** — “Yes” if recipients exist, else “—”.
    - **Action** — e.g. “Message analyzed; no send recorded”, “Sent after warning”, “User modified or cancelled”.
    - **Exposure level** — SAFE / REVIEW / STOP_VERIFY.
  - **HIGH-severity cards are clickable**; others are not. No names, no email content.

- **Tier 3 — Investigation mode (restricted, HIGH only):**
  - Opened by clicking a HIGH-severity card. Modal/panel shows:
    - **Notice:** “Sanitized content only. Not full message or inbox.”
    - **Time,** **Employee role,** **Data action,** **Employee decision.**
    - **Sanitized message** — first 80 characters of draft + “… [content redacted]” (or “[No content]”).
    - **Detected risky content** — the `explanation` field only.
  - No full draft, no conversation thread, no recipient list in this view.

**What the manager does NOT see by default:** Full email bodies, full conversation history, employee names/identifiers (only “role” and anonymized counts).

**Component:** `frontend/src/components/ManagerDashboard.jsx`. Polls `/decisions` every 3 seconds.

---

## 5c. Demo flow and changes for demo

**Login (no credentials):**
- **Employee:** Click **Log in** → **Employee**. You are taken to the Employee view. No username/password.
- **Manager:** Click **Log in** → **Manager / Legal**. You are taken to the Manager dashboard. No username/password.
- **Log out** clears `canarygate_role` and returns to the landing page.

**Suggested demo script:**
1. **Landing:** Show CanaryGate logo, tagline, feature cards. Click **Log in**.
2. **Employee demo:** Choose Employee. Show “Personal protection history” and the four stats. Emphasize: “Only I see this; my manager never sees my emails.”
3. **Manager demo:** Log out, Log in → Manager / Legal. Show Tier 1 (company risk + breakdown with no names), Tier 2 (incident cards with no email body). For a HIGH-severity incident, click to show Tier 3 (sanitized snippet only).
4. **Extension (optional):** Open Gmail, compose a risky message (e.g. “Here is the verification code 123456”), open CanaryGate extension, **Analyze Message**. Show SAFE/REVIEW/STOP_VERIFY, explanation, “Safer alternative”, and Detected Data. Then refresh Manager view to show the new incident.

**Demo-specific behavior (current):**
- Every **Analyze** (extension or future Test Analyzer) is logged with `user_decision="analyzed"`; no “Send anyway / Edit / Cancel” buttons in the extension.
- Employee view treats `gmail-extension` and `web-simulated` as “my” activity; in a multi-user demo you could use different `metadata.source` values to simulate multiple employees.
- Manager view shows all decisions; in production you’d typically scope by org/tenant (not implemented).
- **Role** on a decision (e.g. “Finance”, “IT”) can be set via `metadata.role` when calling POST /analyze; Manager Tier 2 shows it as “Employee role”. Default is “General” if not provided.

---

## 6. Chrome extension (current)

- **Name:** CanaryGate. **Popup:** “CanaryGate Security Check”, “Outgoing communication risk assessment”, button “Analyze Message”.
- **Flow:** User clicks Analyze Message → inject `extract.js` into active tab (Gmail) → get `{ draft, conversation, recipients }` (with waitForCompose MutationObserver). POST to `http://localhost:8000/analyze` with that payload and `metadata.source: 'gmail-extension'`. Display: SAFE / REVIEW / STOP_VERIFY (green/orange/red), summary line, explanation, **Safer alternative** (if `suggestion_rewrite` present), **Detected Data** list, “Show Details” for draft/conversation/raw analysis.
- **No decision buttons:** The “Send anyway / Edit / Cancel” buttons were removed. Every analysis is logged server-side with `user_decision="analyzed"`.
- **Gmail extraction:** `extract.js` uses `findEditor()` (compose + reply selectors), `div.a3s.aiL` for thread messages (conversation, last 6000 chars), and `span[email], span[data-hovercard-id]` for recipients.

---

## 7. Core engine (unchanged behavior)

- **Input:** Draft text, conversation, metadata (optional interpreted_context, etc.).
- **Pipeline:** Normalize & tokenize → infer contextual tokens (verification code, transfer, commitment, urgency/authority from conversation) → action selection (keyword match from behavior_rules.json) → persuasion detection → recoverability from action → risk level (formula: severity, recoverability, pressure) → explanation from rule template.
- **Output:** EngineResult(action, risk_level, recoverability, pressure_signals, explanation). Product labels: LOW→SAFE, MEDIUM→REVIEW, HIGH→STOP_VERIFY.
- **No randomness, no external APIs inside engine.**

---

## 8. Data / attachment checker

- **Input:** Draft, conversation, metadata (recipients, attachments with optional `visible_text`, optional `internal_domains`).
- **Patterns:** SSN-like, 4–8 digit (auth code), API key/secret, “confidential”, financial terms, credentials/PII; external recipient; internal-to-external transfer; invoice to external.
- **Output:** List of strings for `detected_data` (e.g. "Authentication code", "External recipient"). Does not change engine risk score.

---

## 9. Optional AI layers

- **Context interpretation:** `interpret_context(description)` → category, sensitivity, focus_checks. Used to add virtual tokens for engine. Fails gracefully if no OPENAI_API_KEY.
- **Explanation:** After engine run, `explain_with_llm(detected_action, risk_level, pressure_signals, recipients, external_recipient, sensitive_data_detected, conversation_summary)` → human-readable paragraph. If no key or failure, engine explanation is used.
- **Suggestion rewrite:** Static map in `analyze_service`: per action (e.g. SHARE_CODE, SEND_MONEY) returns a “safer alternative” sentence for the employee. Only when risk is not LOW.

---

## 10. Design constraints (do not break)

- **Determinism:** Same inputs → same engine outcome.
- **No database:** All decision storage in memory.
- **No real auth:** Demo uses role-only login; no passwords or user DB.
- **Manager view:** Never show full employee email bodies by default; only anonymized patterns and, for HIGH, sanitized snippet in investigation mode.
- **Employee view:** Only their own aggregated stats; no company-wide risk or other users’ data.

---

## 11. How to run

- **Backend:** `uvicorn main:app --reload` (from project root). Listens on 8000.
- **Frontend (dev):** `cd frontend && npm run dev`. Vite on 5173, proxies API to 8000.
- **Production:** `cd frontend && npm run build && cd .. && ENV=prod uvicorn main:app`. Single server on 8000 serves SPA and API.
- **Extension:** Load `phishpup-extension` folder in Chrome via `chrome://extensions` (Developer mode). Requires backend on localhost:8000 for Analyze.

---

## 12. File checklist (quick reference)

| What | Where |
|------|--------|
| Landing page + logo | `frontend/src/components/Landing.jsx`, `Landing.css`, `frontend/public/logo.png` |
| Login (role picker) | `frontend/src/components/LoginModal.jsx` |
| Employee dashboard (personal stats only, no company risk) | `frontend/src/components/EmployeeView.jsx` |
| Manager dashboard (Tier 1: risk + breakdown; Tier 2: cards; Tier 3: HIGH investigation) | `frontend/src/components/ManagerDashboard.jsx` |
| Demo: role-only login, no passwords; Employee vs Manager flow | §5a, §5b, §5c in this doc |
| Auth state | `frontend/src/App.jsx` (localStorage `canarygate_role`) |
| API client | `frontend/src/api/client.js` |
| Analyze + decision logging | `api/routes.py`, `services/analyze_service.py` |
| Decision store | In-memory list in `api/routes.py` |
| Extension popup | `phishpup-extension/popup.html`, `popup.js`, `popup.css` |
| Gmail extraction | `phishpup-extension/extract.js` |
| Engine | `core/engine.py`, `data/behavior_rules.json` |
| Data/sensitivity patterns | `services/data_checker.py` |
| LLM explanation | `services/explanation_service.py` |
| Safer alternative text | `services/analyze_service.py` (`_suggestion_rewrite`) |

---

End of application state document.
