"""
GPT explanation layer. Rules decide; AI explains in human language.
Called after the deterministic engine produces action + risk_level.
If no API key or failure, returns None so caller uses engine explanation.
"""
import json
import os
from typing import List, Optional


SYSTEM_PROMPT = """You write a short, professional explanation of communication risk for an enterprise security product.

You receive:
- detected_action: what the rule engine identified (e.g. SHARE_CODE, SEND_MONEY)
- risk_level: LOW, MEDIUM, or HIGH
- pressure_signals: persuasion tactics detected (e.g. urgency, authority)
- recipients: list of email addresses
- external_recipient: whether any recipient is outside the organization
- sensitive_data_detected: list of data triggers (e.g. Authentication code, Financial language)
- conversation_summary: brief context (may be truncated)

Write 2-4 sentences that:
1. State what action the message performs in plain language
2. Explain why this creates risk (recipient, channel, or data exposure)
3. Recommend verification through an approved channel when appropriate

Tone: risk, compliance, verification, data exposure. No "phishing" or "scam" language.
Output: plain text only. No bullet points, no JSON."""


def explain_with_llm(
    detected_action: str,
    risk_level: str,
    pressure_signals: List[str],
    recipients: List[str],
    external_recipient: bool,
    sensitive_data_detected: List[str],
    conversation_summary: str,
) -> Optional[str]:
    """
    Call GPT to produce human-readable reasoning. Returns None if no API key or on failure.
    """
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        return None

    user_content = json.dumps({
        "detected_action": detected_action,
        "risk_level": risk_level,
        "pressure_signals": pressure_signals,
        "recipients": recipients[:10],
        "external_recipient": external_recipient,
        "sensitive_data_detected": sensitive_data_detected,
        "conversation_summary": (conversation_summary or "")[:1500],
    }, indent=2)

    try:
        from openai import OpenAI
        client = OpenAI(api_key=api_key)
        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_content},
            ],
            temperature=0.3,
        )
        content = (resp.choices[0].message.content or "").strip()
        return content if content else None
    except Exception:
        return None
