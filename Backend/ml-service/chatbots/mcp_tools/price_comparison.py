"""Price comparison workflow built from MCP-style product tools."""

from pydantic import ValidationError

from chatbots.schemas.products import PriceComparisonArguments, PriceComparisonData
from chatbots.schemas.tools import ToolError, ToolResponse
from chatbots.services.product_repository import (
    MongoProductRepository,
    ProductRepositoryError,
)


TOOL_NAME = "compare_prices"


def run(arguments, repository=None) -> ToolResponse:
    """Compare prices for a resolved product or for the best search match."""
    try:
        args = PriceComparisonArguments(**(arguments or {}))
        repo = repository or MongoProductRepository()

        product_id = args.product_id
        candidates = []

        if not product_id:
            if not args.product_name:
                return _clarify_response(
                    args,
                    "Which product would you like me to compare?",
                )

            candidates = repo.search_products(
                product_name=args.product_name,
                brand=args.brand,
                pack_size=args.pack_size,
                category=args.category,
                limit=args.limit,
            )
            if not candidates:
                data = PriceComparisonData(
                    query=args,
                    candidate_products=[],
                    status="not_found",
                    clarification_question=(
                        "I could not find that product in DiscountMate data. "
                        "Can you try a more specific product name?"
                    ),
                )
                return ToolResponse(
                    success=True,
                    tool=TOOL_NAME,
                    data=_model_dict(data),
                )

            best_score = candidates[0].get("score") or 0
            close_matches = [
                candidate for candidate in candidates
                if (candidate.get("score") or 0) >= best_score and best_score < 1.0
            ]
            if len(close_matches) > 1 and not args.pack_size:
                data = PriceComparisonData(
                    query=args,
                    candidate_products=candidates[:5],
                    status="needs_clarification",
                    clarification_question=(
                        "I found several matching products. Which product "
                        "and pack size should I compare?"
                    ),
                )
                return ToolResponse(
                    success=True,
                    tool=TOOL_NAME,
                    data=_model_dict(data),
                )

            product_id = candidates[0]["product_id"]

        comparison = repo.compare_prices(product_id, args.retailers)
        data = PriceComparisonData(
            query=args,
            matched_product=comparison["matched_product"],
            candidate_products=candidates[:5],
            prices=comparison["prices"],
            cheapest=comparison["cheapest"],
            status=comparison["status"],
            clarification_question=(
                "I found the product, but there are no current valid prices "
                "for the selected retailers."
                if comparison["status"] == "no_prices"
                else None
            ),
        )
        return ToolResponse(success=True, tool=TOOL_NAME, data=_model_dict(data))
    except ValidationError as exc:
        return ToolResponse(
            success=False,
            tool=TOOL_NAME,
            error=ToolError(code="invalid_arguments", message=str(exc)),
        )
    except ProductRepositoryError as exc:
        return ToolResponse(
            success=False,
            tool=TOOL_NAME,
            error=ToolError(code="repository_unavailable", message=str(exc)),
        )
    except Exception as exc:
        return ToolResponse(
            success=False,
            tool=TOOL_NAME,
            error=ToolError(code="tool_error", message=str(exc)),
        )


def _clarify_response(args: PriceComparisonArguments, question: str) -> ToolResponse:
    data = PriceComparisonData(
        query=args,
        status="needs_clarification",
        clarification_question=question,
    )
    return ToolResponse(success=True, tool=TOOL_NAME, data=_model_dict(data))


def _model_dict(model):
    if hasattr(model, "model_dump"):
        return model.model_dump()
    return model.dict()
