import json
import sys
from contextlib import redirect_stdout
from mcp.server.mcpserver import MCPServer

with redirect_stdout(sys.stderr):
    from catalog_loader_prototype import DummyCatalog
    from chatbot_pipeline_prototype import process_chat_query

    # Initialize the MCP Server (Updated for MCP v2.x API)
    mcp = MCPServer("DiscountMate_Product_Search")

    # Load the catalog into memory once when the server starts
    db = DummyCatalog()

# 2. Define the Tool
@mcp.tool()
def search_grocery_prices(user_query: str) -> str:
    """
    Use this tool when the user asks for grocery prices, product comparisons, 
    or availability. Pass the user's raw natural language query directly into 
    this tool (e.g., 'cheapest 2L milk at Woolies').
    
    Returns a JSON string containing the extracted intent, matched product, 
    and price details from the DiscountMate database.
    """
    # Route tool-level logging to stderr
    print(f"\n[MCP Server] Tool triggered with query: '{user_query}'", file=sys.stderr)
    
    # Safely execute the pipeline, routing its internal prints to stderr
    with redirect_stdout(sys.stderr):
        result = process_chat_query(user_query, db.catalog)
    
    # Return ONLY the pure JSON string to stdout for the AI to read
    return json.dumps(result, indent=2)

if __name__ == "__main__":
    # Route server startup logs to stderr
    print("Initializing DiscountMate MCP Tool Server (v2 API)...", file=sys.stderr)
    print("Available Tools: search_grocery_prices", file=sys.stderr)
    
    # Run the server
    mcp.run()