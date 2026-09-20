"""Shared tool envelope schemas for the chatbot agent layer."""

from typing import Any, Dict, Literal, Optional

from pydantic import BaseModel, Field


ChatbotAction = Literal[
    "product_search",
    "price_comparison",
    "clarification",
]


class ChatbotContext(BaseModel):
    """Optional frontend/app context passed into the chatbot."""

    screen: Optional[str] = None
    product_id: Optional[str] = None
    retailer: Optional[str] = None
    extra: Dict[str, Any] = Field(default_factory=dict)


class ToolRequest(BaseModel):
    """Common request envelope used by agent-selected tools."""

    action: ChatbotAction
    arguments: Dict[str, Any] = Field(default_factory=dict)
    context: ChatbotContext = Field(default_factory=ChatbotContext)


class ToolError(BaseModel):
    """Predictable error payload for tool failures."""

    code: str
    message: str
    details: Dict[str, Any] = Field(default_factory=dict)


class ToolResponse(BaseModel):
    """Common response envelope returned by every chatbot tool."""

    success: bool
    tool: str
    data: Optional[Dict[str, Any]] = None
    error: Optional[ToolError] = None
