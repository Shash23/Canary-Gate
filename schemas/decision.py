"""
Pydantic schemas for POST /decision and GET /decisions.
"""
from typing import List, Optional

from pydantic import BaseModel, Field


class DecisionRequest(BaseModel):
    """Payload for recording a user decision after an analysis warning."""
    timestamp: Optional[str] = Field(None, description="ISO timestamp when decision was recorded")
    user_identifier: str = Field(default="anonymous", description="User or client identifier")
    draft: str = Field(default="", description="Draft message that was analyzed")
    conversation: str = Field(default="", description="Conversation/thread context")
    recipients: List[str] = Field(default_factory=list, description="Recipient addresses")
    detected_action: str = Field(default="", description="Action returned by engine")
    risk_level: str = Field(default="", description="LOW | MEDIUM | HIGH")
    pressure_signals: List[str] = Field(default_factory=list, description="Persuasion signals from engine")
    explanation: str = Field(default="", description="Explanation returned by engine")
    user_decision: str = Field(..., description="sent | edited | cancelled")
    role: Optional[str] = Field(None, description="Employee role for manager view, e.g. Finance, IT")


class DecisionRecord(BaseModel):
    """A single decision record as returned by GET /decisions."""
    timestamp: str = Field(..., description="ISO timestamp")
    user_identifier: str = Field(default="anonymous")
    role: Optional[str] = Field(None, description="Employee role (anonymized for manager)")
    draft: str = Field(default="")
    conversation: str = Field(default="")
    recipients: List[str] = Field(default_factory=list)
    detected_action: str = Field(default="")
    risk_level: str = Field(default="")
    pressure_signals: List[str] = Field(default_factory=list)
    explanation: str = Field(default="")
    user_decision: str = Field(...)
