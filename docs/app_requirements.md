# CanaryGate — Web Application PRD (React Version)

## 1. Goal

Build a local web application that analyzes a message and warns a user before they perform risky actions such as sharing a verification code or sending money.

The React web app is the primary interface for testing the analysis engine and must be fully functional before browser extension integration.

The backend performs deterministic behavioral risk analysis.

---

## 2. Architecture

Single local application:

FastAPI backend
serves API at `/analyze`
serves compiled React frontend at `/`

React app communicates only with the local backend.

The React app must be built once and then served statically by FastAPI.

No separate dev servers during demo.

---

## 3. Tech Stack

Backend:
Python
FastAPI
Pydantic

Frontend:
React (Vite)
TypeScript optional but not required
No UI frameworks required (can use simple CSS)

No database
No authentication
Runs entirely locally

Run command:
uvicorn main:app --reload

---

## 4. Functional Requirements

### 4.1 User Flow

User pastes message
User clicks Analyze
Frontend calls `/analyze`
Backend returns structured risk result
Frontend renders warning card

---

## 5. API Specification

POST `/analyze`

Request:

```json id="cq9a8n"
{
  "text": "string"
}
```

Response:

```json id="kdf5ti"
{
  "action": "SEND_MONEY | SHARE_CODE | GRANT_ACCESS | CLICK_LINK | DOWNLOAD | UNKNOWN",
  "risk_level": "LOW | MEDIUM | HIGH",
  "recoverability": "REVERSIBLE | CONDITIONAL | IRREVERSIBLE",
  "pressure_signals": ["urgency", "authority", "fear", "scarcity", "familiarity"],
  "explanation": "human readable explanation"
}
```

---

## 6. React UI Requirements

### Page Layout

Centered container
Title CanaryGate
Large message input box
Analyze button
Example buttons
Result card area

---

## 7. React Components

### App

Top level container

### MessageInput

Large textarea for message input

### ExampleButtons

Buttons that autofill known scam examples

### AnalyzeButton

Triggers API call

### ResultCard

Displays risk output

Props:
risk_level
action
explanation
pressure_signals

---

### ResultCard Styling

LOW → green border
MEDIUM → yellow border
HIGH → red border

Card sections:
Detected action
Risk level
Explanation
Why this is risky
Safer suggestion

---

## 8. Backend Analysis Logic

Order:

Action Extraction
Persuasion Detection
Recoverability
Risk Score
Explanation

No LLM usage required.

---

## 9. Static Serving Requirement

After building React:

`npm run build`

FastAPI must serve `/frontend/dist` as static files at `/`.

Visiting `localhost:8000` loads the React app.

---

## 10. Acceptance Tests

send me the verification code → HIGH
transfer deposit today → HIGH
check this link → MEDIUM
hello how are you → LOW

---

## 11. Future Integration

Chrome extension and Gmail integration will reuse `/analyze`. Do not implement extension yet.

---

END
