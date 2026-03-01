"""
API route definitions.
"""
from datetime import datetime, timezone, timedelta
from typing import List

from fastapi import APIRouter

from schemas.analyze import AnalyzeRequest, AnalyzeResponse, InterpretContextRequest
from schemas.decision import DecisionRecord, DecisionRequest
from services.analyze_service import analyze_text
from services.context_service import interpret_context
from services.risk_narrative_service import generate_risk_narratives

router = APIRouter()

# In-memory store for decision telemetry (no database).
_decision_store: List[DecisionRecord] = []


def _seed_dummy_decisions() -> None:
    """Seed detailed dummy decisions so the dashboard and risk feed show realistic incidents."""
    if _decision_store:
        return
    now = datetime.now(timezone.utc)
    base = (now - timedelta(minutes=5)).isoformat()
    dummy = [
        DecisionRecord(
            timestamp=base,
            user_identifier="web-simulated",
            role="Finance",
            draft="Hi, as requested here is the verification code from the email: 847291. Please confirm once you have logged in.",
            conversation="From: support@secure-portal.com\nSubject: Your verification code\n\nHello, we need you to confirm your identity. Please reply to this email with the 6-digit code we sent to your phone so we can complete the account recovery process. Thank you, Support Team.",
            recipients=["support@secure-portal.com", "external@example.com"],
            detected_action="SHARE_CODE",
            risk_level="HIGH",
            pressure_signals=["authority"],
            explanation="Verification code or credential detected. Replying to an external address with a code increases account takeover risk.",
            user_decision="analyzed",
        ),
        DecisionRecord(
            timestamp=(now - timedelta(minutes=4)).isoformat(),
            user_identifier="web-simulated",
            role="IT",
            draft="I've attached the API key for the staging environment as you asked. Let me know if you need the production one too.",
            conversation="From: contractor@partner-org.com\nSubject: Re: Access for integration\n\nHi, could you send over the credentials we discussed on the call? Need to finish the integration by EOD. Thanks.",
            recipients=["contractor@partner-org.com", "partner@external.org"],
            detected_action="SHARE_CODE",
            risk_level="HIGH",
            pressure_signals=[],
            explanation="Possible credential share. Message appears to provide API key or similar secret to external recipient.",
            user_decision="edited",
        ),
        DecisionRecord(
            timestamp=(now - timedelta(minutes=3)).isoformat(),
            user_identifier="web-simulated",
            role="General",
            draft="I'll click the link and reset my password right away. Thanks for the urgent notice.",
            conversation="From: no-reply@login-service.net\nSubject: URGENT: Your password expires in 2 hours\n\nClick here immediately to reset your password or your account will be locked: http://login-service.net/reset?token=xxxxx. Do not ignore this message.",
            recipients=[],
            detected_action="CLICK_LINK",
            risk_level="MEDIUM",
            pressure_signals=["urgency"],
            explanation="Link to external site with urgency language. Verify the URL and sender before clicking.",
            user_decision="analyzed",
        ),
        DecisionRecord(
            timestamp=(now - timedelta(minutes=2)).isoformat(),
            user_identifier="web-simulated",
            role="Finance",
            draft="Please find the wire details below. I've initiated the transfer for $15,000 as requested.",
            conversation="From: ceo@company.com (display name)\nSubject: Re: Urgent wire\n\nI need you to process this transfer today. Our usual process is suspended due to the holiday. Send the details to the account below.",
            recipients=["wire-transfer@external-bank.com"],
            detected_action="SEND_MONEY",
            risk_level="HIGH",
            pressure_signals=["authority", "urgency"],
            explanation="Payment or transfer request detected. High-risk indicators: external recipient and authority/urgency pressure.",
            user_decision="cancelled",
        ),
    ]
    _decision_store.extend(dummy)


@router.post("/interpret_context")
def post_interpret_context(request: InterpretContextRequest) -> dict:
    """Optional AI context. Returns {} if no API key or on failure."""
    return interpret_context(request.description or "")


@router.post("/analyze", response_model=AnalyzeResponse)
def analyze(request: AnalyzeRequest) -> AnalyzeResponse:
    conversation, draft, metadata = request.normalized()
    response = analyze_text(conversation, draft, metadata)
    # Log every analysis to Human Risk Activity Monitor
    recipients = metadata.get("recipients") if isinstance(metadata.get("recipients"), list) else []
    source = metadata.get("source") or "unknown"
    role = metadata.get("role") if isinstance(metadata.get("role"), str) else None
    record = DecisionRecord(
        timestamp=datetime.now(timezone.utc).isoformat(),
        user_identifier=source,
        role=role,
        draft=draft or "",
        conversation=conversation or "",
        recipients=recipients,
        detected_action=response.action or "",
        risk_level=response.risk_level or "",
        pressure_signals=response.pressure_signals or [],
        explanation=response.explanation or "",
        user_decision="analyzed",
    )
    _decision_store.append(record)
    return response


@router.post("/decision")
def post_decision(request: DecisionRequest) -> dict:
    """Store a decision event. Does not affect /analyze."""
    ts = request.timestamp or datetime.now(timezone.utc).isoformat()
    record = DecisionRecord(
        timestamp=ts,
        user_identifier=request.user_identifier or "anonymous",
        role=request.role,
        draft=request.draft or "",
        conversation=request.conversation or "",
        recipients=request.recipients or [],
        detected_action=request.detected_action or "",
        risk_level=request.risk_level or "",
        pressure_signals=request.pressure_signals or [],
        explanation=request.explanation or "",
        user_decision=request.user_decision,
    )
    _decision_store.append(record)
    return {"status": "recorded"}


@router.get("/decisions", response_model=List[DecisionRecord])
def get_decisions() -> List[DecisionRecord]:
    """Return all recorded decisions, newest first."""
    _seed_dummy_decisions()
    return list(reversed(_decision_store))


@router.get("/risk-feed")
def get_risk_feed() -> list:
    """Return risk narratives from recent decisions (newest first). No auth."""
    _seed_dummy_decisions()
    decisions = [r.model_dump() for r in _decision_store]
    narratives = generate_risk_narratives(decisions)
    return [
        {
            "id": n.id,
            "severity": n.severity,
            "title": n.title,
            "description": n.description,
            "supporting_metrics": n.supporting_metrics,
            "timestamp": n.timestamp,
        }
        for n in narratives
    ]
