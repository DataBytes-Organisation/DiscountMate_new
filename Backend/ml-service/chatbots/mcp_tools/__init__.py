"""Tool implementations exposed to chatbot agents."""

from chatbots.mcp_tools import price_comparison
from chatbots.mcp_tools import product_search


TOOL_REGISTRY = {
    product_search.TOOL_NAME: product_search.run,
    price_comparison.TOOL_NAME: price_comparison.run,
}
