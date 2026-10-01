"""Structured contracts for the combined DiscountMate chatbot agent."""

from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field

from chatbots.schemas.tools import ChatbotContext, ToolError


AgentToolName = Literal[
    "search_products",
    "compare_prices",
    "clarification",
]


class ChatbotMessageRequest(BaseModel):
    """User message handled by the product-search and price-comparison chatbot."""

    session_id: str = Field(..., min_length=1)
    message: str = Field(..., min_length=1)
    top_k: int = Field(default=5, ge=1, le=10)
    context: ChatbotContext = Field(default_factory=ChatbotContext)


class AgentToolCall(BaseModel):
    """Validated tool decision made by the agent planner."""

    tool: AgentToolName
    arguments: Dict[str, Any] = Field(default_factory=dict)
    rationale: Optional[str] = None


class AgentResponse(BaseModel):
    """Unified response returned by the combined chatbot endpoint."""

    success: bool
    answer: str
    action: AgentToolName
    tool_calls: List[AgentToolCall] = Field(default_factory=list)
    data: Dict[str, Any] = Field(default_factory=dict)
    needs_clarification: bool = False
    clarification_question: Optional[str] = None
    error: Optional[ToolError] = None
