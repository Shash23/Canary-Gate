"""
Core safety tests: product-level guarantees for CanaryGate decisions.
Given conversation + draft + context, the decision must stay consistent.
"""
import pytest

from tests.test_utils import run_case


# TEST 1 — Verification Code Leak
def test_verification_code_leak():
    result = run_case(
        conversation="This is IT support. Your account will be locked. Reply urgently.",
        draft="Sure the code is 492771",
        context_category="account verification",
    )
    assert result["action"] == "SHARE_CODE", (
        f"Expected action SHARE_CODE, got {result['action']}"
    )
    assert result["risk_level"] == "HIGH", (
        f"Expected risk_level HIGH, got {result['risk_level']}"
    )


# TEST 2 — Same Number Without Context (prevents false positives)
def test_number_without_context_stays_low():
    result = run_case(draft="The number is 492771")
    assert result["risk_level"] == "LOW", (
        f"Expected risk_level LOW (no context), got {result['risk_level']}"
    )


# TEST 3 — Commitment Detection (CHECK = MEDIUM)
def test_commitment_detection():
    result = run_case(
        draft="Yes I'll definitely be there",
        context_category="scheduling",
    )
    assert result["action"] == "MAKE_COMMITMENT", (
        f"Expected action MAKE_COMMITMENT, got {result['action']}"
    )
    assert result["risk_level"] == "MEDIUM", (
        f"Expected risk_level MEDIUM (CHECK), got {result['risk_level']}"
    )


# TEST 4 — Urgency Escalation (conversation pressure + verification)
def test_urgency_escalation():
    result = run_case(
        conversation="This is IT support. Your account will be locked. Reply urgently.",
        draft="Here is the code 123456",
        context_category="account verification",
    )
    pressure = result["pressure_signals"]
    assert "urgency" in pressure, (
        f"Expected pressure_signals to contain 'urgency', got {pressure}"
    )
    assert "authority" in pressure, (
        f"Expected pressure_signals to contain 'authority', got {pressure}"
    )
    assert result["risk_level"] == "HIGH", (
        f"Expected risk_level HIGH, got {result['risk_level']}"
    )


# TEST 5 — Normal Friendly Email
def test_normal_friendly_email():
    result = run_case(draft="Thanks for the update, talk soon")
    assert result["action"] == "UNKNOWN", (
        f"Expected action UNKNOWN, got {result['action']}"
    )
    assert result["risk_level"] == "LOW", (
        f"Expected risk_level LOW, got {result['risk_level']}"
    )
