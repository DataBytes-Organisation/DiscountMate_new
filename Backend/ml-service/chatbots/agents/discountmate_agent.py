"""Combined RAG + MCP chatbot agent for DiscountMate."""

from typing import Any, Dict, Optional

from chatbots.agents.langgraph_workflow import DiscountMateLangGraphWorkflow


class DiscountMateAgent:
    """Compatibility wrapper around the LangGraph chatbot workflow."""

    def __init__(
        self,
        tool_registry: Optional[Dict] = None,
        llm_client=None,
        enable_llm_planning: bool = True,
    ):
        self.workflow = DiscountMateLangGraphWorkflow(
            tool_registry=tool_registry,
            llm_client=llm_client,
            enable_llm_planning=enable_llm_planning,
        )
        self.workflow_backend = self.workflow.backend

    def chat(self, payload: Dict[str, Any]):
        """Handle one chatbot turn through the graph workflow."""
        return self.workflow.invoke(payload)
