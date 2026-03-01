"""
Deterministic risk narrative service. Converts decision records into
human-readable organizational risk insights. No ML; rule-based only.
"""
from dataclasses import dataclass
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional

# Type alias for decision-like dicts (DecisionRecord from API)
DecisionLike = Dict[str, Any]


@dataclass
class RiskNarrative:
    id: str
    severity: str  # "info" | "elevated" | "critical"
    title: str
    description: str
    supporting_metrics: Dict[str, Any]
    timestamp: str  # UTC ISO


def _parse_ts(ts: str) -> Optional[datetime]:
    if not ts:
        return None
    try:
        return datetime.fromisoformat(ts.replace("Z", "+00:00"))
    except Exception:
        return None


def _recent(decisions: List[DecisionLike], minutes: int) -> List[DecisionLike]:
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(minutes=minutes)
    out = []
    for d in decisions:
        t = _parse_ts(d.get("timestamp") or "")
        if t and t >= cutoff:
            out.append(d)
    return out


def _has_external(d: DecisionLike) -> bool:
    r = d.get("recipients") or []
    return isinstance(r, list) and len(r) > 0


def _has_authority(d: DecisionLike) -> bool:
    p = d.get("pressure_signals") or []
    return isinstance(p, list) and "authority" in p


def _is_high(d: DecisionLike) -> bool:
    return (d.get("risk_level") or "").upper() == "HIGH"


def _is_share_code(d: DecisionLike) -> bool:
    return (d.get("detected_action") or "") == "SHARE_CODE"


def generate_risk_narratives(decisions: List[DecisionLike]) -> List[RiskNarrative]:
    """
    Rule-based conversion of decision logs into risk narratives.
    Uses last 30 min for recent window; all decisions for baseline when needed.
    """
    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()
    narratives: List[RiskNarrative] = []
    seen_ids: set = set()

    def add(n: RiskNarrative) -> None:
        if n.id not in seen_ids:
            seen_ids.add(n.id)
            narratives.append(n)

    if not decisions:
        return []

    recent_10 = _recent(decisions, 10)
    recent_15 = _recent(decisions, 15)
    recent_20 = _recent(decisions, 20)
    recent_30 = _recent(decisions, 30)

    # 1. Credential Surge: >= 2 SHARE_CODE within 10 minutes
    share_in_10 = [d for d in recent_10 if _is_share_code(d)]
    if len(share_in_10) >= 2:
        add(RiskNarrative(
            id="credential-surge",
            severity="critical",
            title="Credential sharing attempts increasing",
            description="Multiple verification or credential-sharing actions in a short window. Possible account takeover preparation.",
            supporting_metrics={"count": len(share_in_10), "window_minutes": 10},
            timestamp=now_iso,
        ))

    # 2. External Interaction Spike: >= 3 decisions with external recipients in 15 minutes
    external_in_15 = [d for d in recent_15 if _has_external(d)]
    if len(external_in_15) >= 3:
        add(RiskNarrative(
            id="external-spike",
            severity="elevated",
            title="Unusual outbound communication volume",
            description="Multiple interactions with external recipients in a short period.",
            supporting_metrics={"count": len(external_in_15), "window_minutes": 15},
            timestamp=now_iso,
        ))

    # 3. Authority Pressure Cluster: >= 2 decisions with "authority" pressure
    authority_decisions = [d for d in recent_30 if _has_authority(d)]
    if len(authority_decisions) >= 2:
        add(RiskNarrative(
            id="authority-pressure",
            severity="elevated",
            title="Authority pressure patterns detected",
            description="Multiple messages involving authority-based persuasion signals.",
            supporting_metrics={"count": len(authority_decisions)},
            timestamp=now_iso,
        ))

    # 4. Repeated STOP_VERIFY Ignored: HIGH after another HIGH within 20 minutes
    high_in_20 = [d for d in recent_20 if _is_high(d)]
    if len(high_in_20) >= 2:
        add(RiskNarrative(
            id="repeated-high",
            severity="critical",
            title="Repeated high-exposure behavior",
            description="Multiple high-risk events in a short window. Unsafe behavior persistence.",
            supporting_metrics={"count": len(high_in_20), "window_minutes": 20},
            timestamp=now_iso,
        ))

    # 5. Sensitive Data Exposure: SHARE_CODE (auth/credential proxy) >= 2 in 30 minutes
    share_in_30 = [d for d in recent_30 if _is_share_code(d)]
    if len(share_in_30) >= 2:
        add(RiskNarrative(
            id="sensitive-exposure",
            severity="critical",
            title="Sensitive data exposure pattern",
            description="Repeated authentication or credential-related actions detected.",
            supporting_metrics={"count": len(share_in_30), "window_minutes": 30},
            timestamp=now_iso,
        ))

    # 6. New Risk Pattern: action appears for the first time in the dataset
    actions_seen_earlier: set = set()
    for d in decisions:
        action = (d.get("detected_action") or "").strip()
        if not action or action == "UNKNOWN":
            continue
        ts = _parse_ts(d.get("timestamp") or "")
        if ts and ts < now - timedelta(minutes=30):
            actions_seen_earlier.add(action)
    for d in recent_30:
        action = (d.get("detected_action") or "").strip()
        if not action or action == "UNKNOWN" or action in actions_seen_earlier:
            continue
        actions_seen_earlier.add(action)
        action_label = action.replace("_", " ").lower()
        add(RiskNarrative(
            id=f"new-pattern-{action}",
            severity="info",
            title=f"New risk pattern: {action_label}",
            description=f"First occurrence of this action type in the current window.",
            supporting_metrics={"action": action},
            timestamp=now_iso,
        ))

    # Sort newest first (all have same timestamp now; preserve order)
    narratives.sort(key=lambda n: n.timestamp, reverse=True)
    return narratives
