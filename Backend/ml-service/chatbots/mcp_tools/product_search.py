"""MCP-style product search tool."""

from pydantic import ValidationError

from chatbots.schemas.products import ProductSearchArguments
from chatbots.schemas.tools import ToolError, ToolResponse
from chatbots.services.product_repository import (
    MongoProductRepository,
    ProductRepositoryError,
)


TOOL_NAME = "search_products"


def run(arguments, repository=None) -> ToolResponse:
    """Find product candidates matching user-supplied criteria."""
    try:
        args = ProductSearchArguments(**(arguments or {}))
        repo = repository or MongoProductRepository()
        products = repo.search_products(
            product_name=args.product_name,
            brand=args.brand,
            pack_size=args.pack_size,
            category=args.category,
            limit=args.limit,
        )
        return ToolResponse(success=True, tool=TOOL_NAME, data={"products": products})
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
