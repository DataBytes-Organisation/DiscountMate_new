"""LangGraph orchestration workflow for the DiscountMate chatbot."""

import json
import re
from typing import Any, Dict, Optional, TypedDict

from pydantic import ValidationError

from chatbots.mcp_tools import TOOL_REGISTRY
from chatbots.schemas.agent import (
    AgentResponse,
    AgentToolCall,
    ChatbotMessageRequest,
)
from chatbots.schemas.products import (
    PriceComparisonArguments,
    ProductSearchArguments,
)
from chatbots.schemas.tools import ToolError

try:
    from langgraph.graph import END, StateGraph
except Exception:
    END = "__end__"
    StateGraph = None


PLANNER_SYSTEM_PROMPT = """You are DiscountMate's tool planner.
Return only valid JSON with keys: tool, arguments, rationale.

Available tools:
- search_products: find grocery products by product_name, brand, pack_size, category.
- compare_prices: compare retailer prices by product_id or product_name.
- clarification: ask for missing information.

Rules:
- Pick exactly one tool.
- Use compare_prices when the user asks for cheapest, price comparison, specials,
  deals, or where to buy a product cheaper.
- Use search_products for every other grocery-product lookup.
- If a product-price request has no product_id and no product_name, choose
  clarification.
- Never invent a product_id.
- Arguments must match the selected tool only."""


PRODUCT_ARG_MODELS = {
    "search_products": ProductSearchArguments,
    "compare_prices": PriceComparisonArguments,
}


class ChatbotGraphState(TypedDict, total=False):
    payload: Dict[str, Any]
    request: ChatbotMessageRequest
    tool_call: AgentToolCall
    tool_response: Dict[str, Any]
    response: AgentResponse
    error: ToolError


class DiscountMateLangGraphWorkflow:
    """Stateful chatbot workflow implemented as a LangGraph graph.

    LangGraph is optional at import time so local smoke tests can run before the
    dependency is installed. When `langgraph` is available, the same node methods
    are compiled into a real StateGraph.
    """

    def __init__(
        self,
        tool_registry: Optional[Dict] = None,
        llm_client=None,
        enable_llm_planning: bool = True,
    ):
        self.tool_registry = tool_registry or TOOL_REGISTRY
        self.llm_client = llm_client
        self.enable_llm_planning = enable_llm_planning
        self.backend = "langgraph" if StateGraph is not None else "local-fallback"
        self.graph = self._build_graph()

    def invoke(self, payload: Dict[str, Any]) -> AgentResponse:
        initial_state: ChatbotGraphState = {"payload": payload or {}}
        final_state = self.graph.invoke(initial_state)
        return final_state["response"]

    def _build_graph(self):
        if StateGraph is None:
            return _LocalWorkflowRunner(self)

        graph = StateGraph(ChatbotGraphState)
        graph.add_node("validate_request", self._validate_request_node)
        graph.add_node("plan_tool", self._plan_tool_node)
        graph.add_node("validate_tool", self._validate_tool_node)
        graph.add_node("clarify", self._clarify_node)
        graph.add_node("execute_tool", self._execute_tool_node)
        graph.add_node("compose_answer", self._compose_answer_node)

        graph.set_entry_point("validate_request")
        graph.add_conditional_edges(
            "validate_request",
            self._route_after_request_validation,
            {"valid": "plan_tool", "invalid": "compose_answer"},
        )
        graph.add_edge("plan_tool", "validate_tool")
        graph.add_conditional_edges(
            "validate_tool",
            self._route_after_tool_validation,
            {
                "clarification": "clarify",
                "valid": "execute_tool",
                "invalid": "compose_answer",
            },
        )
        graph.add_edge("clarify", END)
        graph.add_edge("execute_tool", "compose_answer")
        graph.add_edge("compose_answer", END)
        return graph.compile()

    def _validate_request_node(self, state: ChatbotGraphState) -> ChatbotGraphState:
        try:
            return {"request": ChatbotMessageRequest(**(state.get("payload") or {}))}
        except ValidationError as exc:
            error = ToolError(code="invalid_request", message=str(exc))
            return {
                "error": error,
                "response": self._error_response(
                    "clarification",
                    "I need a session and message before I can help.",
                    error,
                ),
            }

    def _plan_tool_node(self, state: ChatbotGraphState) -> ChatbotGraphState:
        request = state["request"]
        tool_call = None
        if self.enable_llm_planning:
            tool_call = self._llm_plan(request)
        if tool_call is None:
            tool_call = self._heuristic_plan(request)
        return {"tool_call": self._complete_tool_arguments(tool_call, request)}

    def _validate_tool_node(self, state: ChatbotGraphState) -> ChatbotGraphState:
        tool_call = state["tool_call"]
        if tool_call.tool == "clarification":
            return {}
        if tool_call.tool not in self.tool_registry:
            error = ToolError(
                code="unknown_tool",
                message=f"Unknown chatbot tool: {tool_call.tool}",
            )
            return {
                "error": error,
                "response": self._error_response(
                    tool_call.tool,
                    "I could not safely run that chatbot action.",
                    error,
                    tool_call=tool_call,
                ),
            }

        model = PRODUCT_ARG_MODELS.get(tool_call.tool)
        if model is None:
            error = ToolError(
                code="unknown_schema",
                message=f"No validation schema for chatbot tool: {tool_call.tool}",
            )
            return {
                "error": error,
                "response": self._error_response(
                    tool_call.tool,
                    "I could not safely run that chatbot action.",
                    error,
                    tool_call=tool_call,
                ),
            }

        try:
            validated_args = model(**(tool_call.arguments or {}))
            tool_call.arguments = _model_dict(validated_args)
            return {"tool_call": tool_call}
        except ValidationError as exc:
            error = ToolError(code="invalid_arguments", message=str(exc))
            return {
                "error": error,
                "response": self._error_response(
                    tool_call.tool,
                    "I could not safely run that chatbot action.",
                    error,
                    tool_call=tool_call,
                ),
            }

    def _clarify_node(self, state: ChatbotGraphState) -> ChatbotGraphState:
        tool_call = state["tool_call"]
        question = tool_call.arguments.get(
            "question",
            "Which grocery product would you like me to find or compare?",
        )
        return {
            "response": AgentResponse(
                success=True,
                answer=question,
                action="clarification",
                tool_calls=[tool_call],
                needs_clarification=True,
                clarification_question=question,
            )
        }

    def _execute_tool_node(self, state: ChatbotGraphState) -> ChatbotGraphState:
        tool_call = state["tool_call"]
        response = self.tool_registry[tool_call.tool](tool_call.arguments)
        return {"tool_response": _model_dict(response)}

    def _compose_answer_node(self, state: ChatbotGraphState) -> ChatbotGraphState:
        if "response" in state:
            return {"response": state["response"]}

        tool_call = state["tool_call"]
        response_dict = state.get("tool_response") or {}
        answer = self._answer_for_tool(tool_call, response_dict)
        needs_clarification, question = self._clarification_from_tool(response_dict)

        return {
            "response": AgentResponse(
                success=bool(response_dict.get("success")),
                answer=answer,
                action=tool_call.tool,
                tool_calls=[tool_call],
                data=response_dict.get("data") or {},
                needs_clarification=needs_clarification,
                clarification_question=question,
                error=response_dict.get("error"),
            )
        }

    def _route_after_request_validation(self, state: ChatbotGraphState) -> str:
        return "valid" if state.get("request") else "invalid"

    def _route_after_tool_validation(self, state: ChatbotGraphState) -> str:
        if state.get("response"):
            return "invalid"
        tool_call = state.get("tool_call")
        if tool_call and tool_call.tool == "clarification":
            return "clarification"
        return "valid"

    def _llm_plan(self, request: ChatbotMessageRequest) -> Optional[AgentToolCall]:
        llm = self._get_llm_client()
        if llm is None:
            return None

        prompt = {
            "session_id": request.session_id,
            "message": request.message,
            "top_k": request.top_k,
            "context": _model_dict(request.context),
        }
        try:
            raw = llm.generate(
                PLANNER_SYSTEM_PROMPT,
                [{"role": "user", "content": json.dumps(prompt)}],
            )
            payload = _extract_json(raw)
            if not payload:
                return None
            return AgentToolCall(**payload)
        except Exception as exc:
            print(f"[DiscountMateWorkflow] planner fallback: {exc}")
            return None

    def _get_llm_client(self):
        return self.llm_client

    def _heuristic_plan(self, request: ChatbotMessageRequest) -> AgentToolCall:
        message = request.message.strip()
        lower = message.lower()
        product_id = request.context.product_id

        if self._is_price_request(lower):
            retailers = self._extract_retailers(lower)
            if product_id:
                return AgentToolCall(
                    tool="compare_prices",
                    arguments={
                        "product_id": product_id,
                        "retailers": retailers,
                    },
                    rationale="Price comparison for known product context.",
                )

            product_name = self._extract_product_name(message)
            if not product_name:
                return AgentToolCall(
                    tool="clarification",
                    arguments={
                        "question": "Which product would you like me to compare?",
                    },
                    rationale="Missing product name for price comparison.",
                )

            return AgentToolCall(
                tool="compare_prices",
                arguments={
                    "product_name": product_name,
                    "retailers": retailers,
                },
                rationale="Price comparison request.",
            )

        product_name = self._extract_product_name(message)
        if product_name:
            return AgentToolCall(
                tool="search_products",
                arguments={"product_name": product_name, "limit": 5},
                rationale="Product lookup request.",
            )

        return AgentToolCall(
            tool="clarification",
            arguments={"question": "Which grocery product would you like me to find or compare?"},
            rationale="No clear tool intent.",
        )

    def _complete_tool_arguments(
        self,
        tool_call: AgentToolCall,
        request: ChatbotMessageRequest,
    ) -> AgentToolCall:
        arguments = dict(tool_call.arguments or {})
        if tool_call.tool == "compare_prices":
            if request.context.product_id:
                arguments.setdefault("product_id", request.context.product_id)
        elif tool_call.tool == "search_products":
            if arguments.get("product_name"):
                arguments["product_name"] = self._extract_product_name(arguments["product_name"])
            else:
                product_name = self._extract_product_name(request.message)
                if product_name:
                    arguments["product_name"] = product_name
            arguments.setdefault("limit", 5)

        if tool_call.tool == "compare_prices":
            if arguments.get("product_name"):
                arguments["product_name"] = self._extract_product_name(arguments["product_name"])
            if not arguments.get("product_id") and not arguments.get("product_name"):
                product_name = self._extract_product_name(request.message)
                if product_name:
                    arguments["product_name"] = product_name
            arguments.setdefault("retailers", self._extract_retailers(request.message.lower()))

        tool_call.arguments = arguments
        return tool_call

    def _answer_for_tool(self, tool_call: AgentToolCall, response: Dict[str, Any]) -> str:
        if not response.get("success"):
            error = response.get("error") or {}
            return error.get("message") or "That chatbot action failed."

        data = response.get("data") or {}
        if tool_call.tool == "compare_prices":
            return self._price_comparison_answer(data)
        if tool_call.tool == "search_products":
            products = data.get("products") or []
            if not products:
                return "I could not find matching products."
            names = [p.get("product_name") for p in products[:5] if p.get("product_name")]
            return "I found these matching products: " + ", ".join(names)
        return "Done."

    def _price_comparison_answer(self, data: Dict[str, Any]) -> str:
        status = data.get("status")
        question = data.get("clarification_question")
        if status == "needs_clarification" and question:
            return question
        if status == "not_found":
            return question or "I could not find that product in DiscountMate data."
        if status == "no_prices":
            return question or "I found the product, but no current prices are available."

        product = data.get("matched_product") or {}
        cheapest = data.get("cheapest") or {}
        prices = data.get("prices") or []
        if not cheapest:
            return "I found the product, but no current prices are available."

        name = product.get("product_name") or "that product"
        answer = (
            f"The cheapest current price for {name} is "
            f"${float(cheapest['price']):.2f} at {cheapest['retailer']}."
        )
        other_prices = [
            f"{p.get('retailer')} ${float(p.get('price')):.2f}"
            for p in prices[1:4]
            if p.get("retailer") and p.get("price") is not None
        ]
        if other_prices:
            answer += " Other prices: " + ", ".join(other_prices) + "."
        return answer

    def _clarification_from_tool(self, response: Dict[str, Any]):
        data = response.get("data") or {}
        question = data.get("clarification_question")
        return bool(question), question

    def _is_price_request(self, lower: str) -> bool:
        return bool(re.search(
            r"\b(price|prices|cheapest|compare|comparison|cost|deal|deals|"
            r"special|specials|discount|buy)\b",
            lower,
        ))

    def _extract_retailers(self, lower: str):
        retailers = []
        aliases = {
            "coles": "coles",
            "woolworths": "woolworths",
            "woolies": "woolworths",
            "iga": "iga",
        }
        for alias, retailer in aliases.items():
            if alias in lower and retailer not in retailers:
                retailers.append(retailer)
        return retailers

    def _extract_product_name(self, message: str) -> str:
        text = message.strip()
        text = re.sub(r"\b(at|from)\s+(coles|woolworths|woolies|iga)\b", " ", text, flags=re.I)
        text = re.sub(r"\b(and|or)\s+(coles|woolworths|woolies|iga)\b", " ", text, flags=re.I)
        text = re.sub(r"\b(coles|woolworths|woolies|iga)\b", " ", text, flags=re.I)
        text = re.sub(
            r"\b(can you|could you|please|show me|find me|find|search|look up|"
            r"compare|price|prices|cheapest|current|cost|deal|deals|specials?|"
            r"for|of|the|a|an|product|products|grocery|groceries|where to buy)\b",
            " ",
            text,
            flags=re.I,
        )
        text = re.sub(r"[^A-Za-z0-9 .'-]+", " ", text)
        text = re.sub(r"\s+", " ", text).strip(" .")
        return text[:120]

    def _error_response(
        self,
        action,
        answer: str,
        error: ToolError,
        tool_call: Optional[AgentToolCall] = None,
    ) -> AgentResponse:
        return AgentResponse(
            success=False,
            answer=answer,
            action=action,
            tool_calls=[tool_call] if tool_call else [],
            error=error,
        )


class _LocalWorkflowRunner:
    """Runs the same nodes when LangGraph is not installed locally."""

    def __init__(self, workflow: DiscountMateLangGraphWorkflow):
        self.workflow = workflow

    def invoke(self, state: ChatbotGraphState) -> ChatbotGraphState:
        state.update(self.workflow._validate_request_node(state))
        if self.workflow._route_after_request_validation(state) == "invalid":
            state.update(self.workflow._compose_answer_node(state))
            return state

        state.update(self.workflow._plan_tool_node(state))
        state.update(self.workflow._validate_tool_node(state))
        route = self.workflow._route_after_tool_validation(state)
        if route == "clarification":
            state.update(self.workflow._clarify_node(state))
            return state
        if route == "invalid":
            state.update(self.workflow._compose_answer_node(state))
            return state

        state.update(self.workflow._execute_tool_node(state))
        state.update(self.workflow._compose_answer_node(state))
        return state


def _model_dict(model):
    if hasattr(model, "model_dump"):
        return model.model_dump()
    if hasattr(model, "dict"):
        return model.dict()
    return model


def _extract_json(raw: str) -> Dict[str, Any]:
    text = str(raw or "").strip()
    try:
        return json.loads(text)
    except ValueError:
        pass

    match = re.search(r"\{.*\}", text, flags=re.S)
    if not match:
        return {}
    try:
        return json.loads(match.group(0))
    except ValueError:
        return {}
