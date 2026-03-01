"""
Deterministic data/attachment checker. Detects sensitive data patterns.
Does not change engine scoring; produces a list of trigger labels for UI.
"""
import re
from typing import Any, Dict, List

# Default internal domains (override via metadata.internal_domains)
_DEFAULT_INTERNAL_DOMAINS = {"company.com", "internal.local", "corp.example.com"}

# Patterns and their display labels
_PATTERNS = [
    (re.compile(r"\b\d{3}-\d{2}-\d{4}\b"), "SSN or national ID pattern"),
    (re.compile(r"\b\d{4,8}\b"), "Authentication code"),
    (re.compile(r"(?i)(api[_-]?key|apikey|secret[_-]?key|Bearer\s+[a-zA-Z0-9_-]{20,})"), "API key or secret"),
    (re.compile(r"(?i)\bconfidential\b"), "Possible confidential document"),
    (re.compile(r"(?i)\b(invoice|payment|wire|transfer|routing number|account number)\b"), "Financial language"),
    (re.compile(r"(?i)\b(credentials|password|login|ssn|social security)\b"), "Credentials or PII"),
]


def _collect_text(draft: str, conversation: str, attachments: List[Dict[str, Any]]) -> str:
    """Combine all visible text for pattern matching."""
    parts = [draft or "", conversation or ""]
    for att in attachments or []:
        if isinstance(att, dict) and att.get("visible_text"):
            parts.append(str(att["visible_text"]))
    return "\n".join(parts)


def _has_external_recipient(recipients: List[str], internal_domains: set) -> bool:
    if not recipients:
        return False
    for r in recipients:
        if not isinstance(r, str) or "@" not in r:
            continue
        domain = r.strip().split("@")[-1].lower()
        if domain and domain not in internal_domains:
            return True
    return False


def _has_internal_to_external(recipients: List[str], internal_domains: set) -> bool:
    if not recipients or len(recipients) < 2:
        return False
    has_internal = any(
        isinstance(r, str) and "@" in r and r.strip().split("@")[-1].lower() in internal_domains
        for r in recipients
    )
    has_external = any(
        isinstance(r, str) and "@" in r and r.strip().split("@")[-1].lower() not in internal_domains
        for r in recipients
    )
    return has_internal and has_external


def _invoice_with_external(text: str, recipients: List[str], internal_domains: set) -> bool:
    if not re.search(r"(?i)\binvoice\b", text):
        return False
    return _has_external_recipient(recipients or [], internal_domains)


def check_data(
    draft: str,
    conversation: str,
    metadata: Dict[str, Any],
) -> List[str]:
    """
    Run deterministic patterns on draft, conversation, and attachment visible text.
    Returns list of human-readable trigger labels for the UI.
    """
    triggers: List[str] = []
    meta = metadata or {}
    recipients = meta.get("recipients") or []
    if not isinstance(recipients, list):
        recipients = []
    attachments = meta.get("attachments") or []
    if not isinstance(attachments, list):
        attachments = []
    internal_raw = meta.get("internal_domains")
    if isinstance(internal_raw, list):
        internal_domains = {str(d).lower().strip() for d in internal_raw}
    else:
        internal_domains = _DEFAULT_INTERNAL_DOMAINS

    combined = _collect_text(draft, conversation, attachments)

    for pattern, label in _PATTERNS:
        if pattern.search(combined) and label not in triggers:
            triggers.append(label)

    if _has_external_recipient(recipients, internal_domains):
        if "External recipient" not in triggers:
            triggers.append("External recipient")

    if _has_internal_to_external(recipients, internal_domains):
        if "Internal-to-external transfer" not in triggers:
            triggers.append("Internal-to-external transfer")

    if _invoice_with_external(combined, recipients, internal_domains):
        if "Invoice to external party" not in triggers:
            triggers.append("Invoice to external party")

    return triggers
