# CanaryGate — Application Description

**CanaryGate** is a human-layer safety system for outgoing communication. It answers one question before a message is sent: *What happens if this is sent?*

The product does not classify messages as “phish” or “not phish” and does not block sending. It identifies the **action** the message performs (e.g. sharing a verification code, sending money, granting access, clicking a link), explains the possible outcome, and records the sender’s decision. The goal is to reduce risky human actions—such as sharing credentials under pressure or sending sensitive data to the wrong party—by adding a verification step before the message leaves the sender.

---

## For the person sending

**In the moment:** A Gmail extension analyzes the draft and thread before send. The user sees a clear label (**SAFE**, **REVIEW**, or **STOP_VERIFY**), a short explanation, and when relevant a “Situation Understanding” summary (e.g. “You are communicating with someone outside your organization” and “The other party is asking for sensitive authentication information”). For higher-risk cases, the system suggests a safer alternative phrasing. The user can still send, edit, or cancel; the extension only informs.

**After the fact:** An employee view shows a private “protection history”: how many messages were analyzed, how often they were warned, and how many risky actions they avoided (e.g. by editing or cancelling). No company-wide risk scores or other people’s data are shown.

---

## For the organization

A manager dashboard provides **behavioral risk intelligence**, not per-message content. It shows:

- **Company human risk level** (LOW / MEDIUM / HIGH) and a short reason.
- **Exposure feed:** Short, live narratives such as “Credential sharing attempts increasing” or “Unusual outbound communication volume,” derived from recent decisions. No employee names or message bodies—only patterns.
- **Incident-style cards:** Risk type (e.g. potential account takeover, payment risk), role, whether the recipient was external, and the exposure level. For high-severity cases, a restricted “investigation” view can show a very short, sanitized snippet and explanation—still no full email.

So the organization sees *what kind of risk is happening* and *how often*, without reading people’s mail by default.

---

## How it works technically

- A **rules-based engine** decides the action and risk level (LOW / MEDIUM / HIGH). That result is deterministic and is not changed by any AI.
- **Optional AI** is used only to improve wording: e.g. turning engine output into a clearer explanation, or summarizing “situation understanding” for the popup. The final SAFE / REVIEW / STOP_VERIFY outcome always comes from the rules.
- Every analysis is recorded (e.g. “analyzed”, “sent”, “edited”, “cancelled”). These records feed the exposure feed and manager dashboard. No database is required for the demo; an in-memory store is used.

---

## In one sentence

CanaryGate is a pre-send checkpoint that explains the real-world consequence of a message and records whether the sender heeded the warning—giving employees protection and companies risk visibility without reading their email.
