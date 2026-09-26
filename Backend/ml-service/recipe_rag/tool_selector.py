"""Deterministic pre-execution routing for the recipe RAG chatbot."""

from dataclasses import asdict, dataclass
import re
from typing import List


RECIPE_ONLY_MESSAGE = (
    "I can only help with recipe and cooking questions from DiscountMate's "
    "recipe collection. What would you like to cook?"
)


@dataclass(frozen=True)
class ToolSelection:
    intent: str
    tools: List[str]
    reason: str
    confidence: float
    reuse_previous_results: bool = False

    def to_dict(self, reused_previous_results: bool = False) -> dict:
        payload = asdict(self)
        payload["reused_previous_results"] = reused_previous_results
        return payload

    @property
    def run_recipe_search(self) -> bool:
        return "recipe_search" in self.tools

    @property
    def run_product_lookup(self) -> bool:
        return "product_lookup" in self.tools

    @property
    def run_llm(self) -> bool:
        return "llm" in self.tools


class ChatToolSelector:
    """Select the minimum safe tool set before retrieval, product lookup or LLM use."""

    _recipe_terms = re.compile(
        r"\b(recipe|recipes|cook|cooking|bake|meal|meals|dinner|lunch|breakfast|"
        r"ingredient|ingredients|dish|dishes|pasta|chicken|beef|salmon|fish|"
        r"vegetarian|vegan|dessert|soup|curry|salad|stir[- ]?fry|noodle|rice|"
        r"what can i make|how do i make|how to make|how to cook)\b",
        re.I,
    )
    _browse_terms = re.compile(
        r"\b(find|show|suggest|recommend|ideas?|options?|list|browse|have|"
        r"what.*recipes?|recipes?.*with)\b",
        re.I,
    )
    _detail_terms = re.compile(
        r"\b(full|complete|detail|details|show me|give me|recipe for|ingredients?|"
        r"ingredient list|shopping list|what do i need|steps?|instructions?|"
        r"method|directions|how (to|do i) (make|cook|prepare))\b",
        re.I,
    )
    _product_terms = re.compile(
        r"\b(shopping|shop|buy|products?|grocer(?:y|ies)|ingredient list|"
        r"what do i need|where can i buy|price|prices|cheapest|specials?|deals?)\b",
        re.I,
    )
    _referential_terms = re.compile(
        r"\b(first|second|third|1st|2nd|3rd|one|that|this|last|previous)\s+one\b|"
        r"\b(show|open|give|make|cook|prepare|tell me about)\s+(it|that|this)\b",
        re.I,
    )
    _unsupported_terms = re.compile(
        r"\b(weather|forecast|joke|news|politics|president|prime minister|stock|"
        r"crypto|code|coding|python|javascript|homework|assignment|essay|capital of|"
        r"sports?|movie|song|travel|flight|hotel)\b",
        re.I,
    )

    def select(self, message: str, has_previous_results: bool = False) -> ToolSelection:
        text = self._normalise(message)
        if not text:
            return ToolSelection(
                intent="unsupported",
                tools=[],
                reason="empty message",
                confidence=1.0,
            )

        is_recipe = bool(self._recipe_terms.search(text))
        is_referential = bool(self._referential_terms.search(text))
        asks_for_detail = bool(self._detail_terms.search(text))
        asks_for_products = bool(self._product_terms.search(text))
        unsupported = bool(self._unsupported_terms.search(text))

        if unsupported and not is_recipe and not is_referential:
            return ToolSelection(
                intent="unsupported",
                tools=[],
                reason="message is outside the recipe and cooking scope",
                confidence=0.95,
            )

        if is_referential and has_previous_results:
            tools = ["llm"]
            if asks_for_detail or asks_for_products:
                tools.insert(0, "product_lookup")
            return ToolSelection(
                intent="referential_recipe_followup",
                tools=tools,
                reason="reuse the previous recipe candidates for a referential follow-up",
                confidence=0.9,
                reuse_previous_results=True,
            )

        if asks_for_products:
            return ToolSelection(
                intent="shopping_product_request",
                tools=["recipe_search", "product_lookup", "llm"],
                reason="message asks for recipe-related shopping or product support",
                confidence=0.88,
            )

        if asks_for_detail:
            return ToolSelection(
                intent="detailed_recipe",
                tools=["recipe_search", "product_lookup", "llm"],
                reason="message asks for a detailed recipe or ingredients",
                confidence=0.86,
            )

        if is_recipe or self._browse_terms.search(text):
            return ToolSelection(
                intent="recipe_search",
                tools=["recipe_search", "llm"],
                reason="message asks to browse or discuss recipes",
                confidence=0.82,
            )

        return ToolSelection(
            intent="unsupported",
            tools=[],
            reason="message did not match recipe or cooking support",
            confidence=0.8,
        )

    @staticmethod
    def _normalise(message: str) -> str:
        return re.sub(r"\s+", " ", str(message or "").strip().lower())


def ordinal_index(message: str) -> int | None:
    text = ChatToolSelector._normalise(message)
    patterns = (
        (0, r"\b(first|1st)\s+one\b"),
        (1, r"\b(second|2nd)\s+one\b"),
        (2, r"\b(third|3rd)\s+one\b"),
    )
    for index, pattern in patterns:
        if re.search(pattern, text):
            return index
    return None
