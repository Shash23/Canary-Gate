"""
Thin wrapper around core engine; returns API response shape.
Rules decide; AI explains. Data checker adds detected_data triggers.
"""
from typing import Optional

from core.engine import run_analysis
from schemas.analyze import AnalyzeResponse, SecurityContext
from services.context_service import interpret_context
from services.data_checker import check_data
from services.explanation_service import explain_with_llm


def _external_recipient(metadata: dict) -> bool:
    recipients = metadata.get("recipients") or []
    if not isinstance(recipients, list):
        return False
    internal_raw = metadata.get("internal_domains")
    if isinstance(internal_raw, list):
        internal = {str(d).lower().strip() for d in internal_raw}
    else:
        internal = {"company.com", "internal.local", "corp.example.com"}
    for r in recipients:
        if isinstance(r, str) and "@" in r:
            domain = r.strip().split("@")[-1].lower()
            if domain and domain not in internal:
                return True
    return False


def analyze_text(conversation: str, draft: str, metadata: dict) -> AnalyzeResponse:
    meta = dict(metadata)
    desc = meta.get("user_context_description") or ""
    if desc and isinstance(desc, str) and desc.strip() and "interpreted_context" not in meta:
        interpreted = interpret_context(desc.strip())
        if interpreted:
            meta["interpreted_context"] = interpreted

    result = run_analysis(conversation, draft, meta)
    detected_data = check_data(draft, conversation, meta)
    external = _external_recipient(meta)
    conversation_summary = (conversation or "")[:1500]

    llm_explanation = explain_with_llm(
        detected_action=result.action,
        risk_level=result.risk_level,
        pressure_signals=result.pressure_signals,
        recipients=meta.get("recipients") or [],
        external_recipient=external,
        sensitive_data_detected=detected_data,
        conversation_summary=conversation_summary,
    )
    explanation = llm_explanation if llm_explanation else result.explanation

    suggestion_rewrite = _suggestion_rewrite(result.action, result.risk_level)
    context = _build_context(
        conversation_summary=conversation_summary,
        external=external,
        action=result.action,
        risk_level=result.risk_level,
        pressure_signals=result.pressure_signals,
        detected_data=detected_data,
    )

    return AnalyzeResponse(
        action=result.action,
        risk_level=result.risk_level,
        recoverability=result.recoverability,
        pressure_signals=result.pressure_signals,
        explanation=explanation,
        detected_data=detected_data,
        suggestion_rewrite=suggestion_rewrite,
        context=context,
    )


def _build_context(
    conversation_summary: str,
    external: bool,
    action: str,
    risk_level: str,
    pressure_signals: list,
    detected_data: list,
) -> SecurityContext:
    """Build SecurityContext deterministically from analysis result (no LLM)."""
    relationship_type = "external" if external else "internal"
    sender_intent = None
    if (action or "").upper() == "SHARE_CODE" or any(
        "credential" in (d or "").lower() or "code" in (d or "").lower() or "verification" in (d or "").lower()
        for d in (detected_data or [])
    ):
        sender_intent = "request_credentials"
    elif (action or "").upper() in ("SEND_MONEY", "GRANT_ACCESS", "CLICK_LINK", "DOWNLOAD") or (risk_level or "").upper() == "MEDIUM":
        sender_intent = "request_information"

    flags = []
    if (action or "").upper() == "SHARE_CODE" or any(
        "credential" in (d or "").lower() or "code" in (d or "").lower() or "verification" in (d or "").lower()
        for d in (detected_data or [])
    ):
        flags.append("credential_request")
    if "urgency" in (pressure_signals or []):
        flags.append("urgency_language")
    if "authority" in (pressure_signals or []):
        flags.append("authority_claim")
    if (action or "").upper() == "SHARE_CODE" and "authority" in (pressure_signals or []):
        flags.append("impersonation_possible")
    if (action or "").upper() == "SEND_MONEY":
        flags.append("payment_request")
    if (action or "").upper() == "CLICK_LINK" or external:
        flags.append("link_to_external_site")

    response_nature = None
    if (risk_level or "").upper() == "HIGH" and (
        (action or "").upper() == "SHARE_CODE"
        or any("credential" in (d or "").lower() or "code" in (d or "").lower() or "API" in (d or "").upper() for d in (detected_data or []))
    ):
        response_nature = "providing_secret"
    elif (risk_level or "").upper() in ("MEDIUM", "HIGH"):
        response_nature = "providing_information"

    summary = (conversation_summary or "").strip()
    if len(summary) > 500:
        summary = summary[:497] + "..."

    return SecurityContext(
        conversation_summary=summary or None,
        sender_intent=sender_intent,
        relationship_type=relationship_type,
        conversation_risk_flags=flags,
        response_nature=response_nature,
    )


def _suggestion_rewrite(action: str, risk_level: str) -> Optional[str]:
    """Return a safer alternative phrasing when risk is not LOW."""
    if (risk_level or "").upper() == "LOW":
        return None
    suggestions = {
        "SHARE_CODE": "I cannot share verification codes over email. Please confirm your identity through the company IT portal or the official app.",
        "SEND_MONEY": "I need to verify this payment request through our standard approval process before sending any transfer.",
        "GRANT_ACCESS": "I cannot grant access based on email alone. Please submit the request through our IT ticketing system.",
        "CLICK_LINK": "I don’t click links from email for security reasons. I’ll go directly to the company site or contact IT.",
        "DOWNLOAD": "I won’t open attachments from this channel. Please share via our secure file system or I’ll confirm with you another way.",
    }
    return suggestions.get((action or "").upper())
