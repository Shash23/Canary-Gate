Full System Workflow
1) User Action (inside Gmail)

Actor: employee
Location: Gmail compose window

User writes an email

User opens the PhishPup extension

Extension extracts:

draft message

conversation thread

recipients

Extension calls backend:

POST /analyze

Server returns:

action
risk_level
pressure_signals
explanation
2) User Decision

Now the important part happens.

PhishPup shows:

SAFE / CHECK / STOP_VERIFY

User chooses:

User Choice	Meaning
Send anyway	ignored warning
Edit	behavior corrected
Cancel	avoided mistake

This decision matters more than the classification.

3) Extension Logs Behavior

After the user clicks a button, the extension sends an event:

POST /decision

Payload:

{
  "user": "employee@company.com",
  "draft": "...",
  "conversation": "...",
  "recipients": ["boss@company.com"],
  "action": "SHARE_CODE",
  "risk_level": "HIGH",
  "pressure_signals": ["urgency","authority"],
  "explanation": "...",
  "user_choice": "sent"
}

This is NOT analysis.

This is a human behavior record.

4) Backend Stores the Event

No database needed.

Server keeps:

DECISIONS = [
  decision_1,
  decision_2,
  decision_3
]

Each decision has:

Field	Purpose
timestamp	when mistake happened
risk_level	severity
action	what could happen
user_choice	did they ignore it
conversation	training context

This becomes your security telemetry.

5) Dashboard Queries History

Frontend dashboard calls:

GET /decisions

Server returns all recorded events.

6) Dashboard Displays Security Timeline

The dashboard shows a human risk feed.

Table View
Time	Action	Risk	User Decision
10:03	SHARE_CODE	HIGH	Sent anyway
10:07	MAKE_COMMITMENT	MEDIUM	Edited
10:10	UNKNOWN	LOW	Sent

Color coding:

HIGH → red

MEDIUM → orange

LOW → green

7) Incident Detail View

Click row →

Show:

Message sent
System warning
User ignored or corrected

This creates the “oh wow” moment for judges.

What the System Now Demonstrates

You are proving something deeper:

Traditional security logs attacks
PhishPup logs human decision risk

This turns your project into:

Behavioral security infrastructure

Implementation Steps (Ordered)

Follow exactly in this order.

Backend

Create DecisionRecord model

Create in-memory decision store

Add POST /decision endpoint

Add GET /decisions endpoint

Extension

After analysis → show buttons:

Send anyway

Edit

Cancel

On click → POST /decision

Frontend Dashboard

Add /dashboard page

Fetch /decisions

Render table

Add detail panel when clicked

Demo Flow

Simulate risky email in Gmail

Ignore warning

Open dashboard

Show logged incident