"""Evaluate deterministic tool selection for the recipe chatbot workflow."""

from recipe_rag.tool_selector import ChatToolSelector


CASES = [
    ("Find chicken recipes", False, ["recipe_search", "llm"]),
    ("Suggest vegetarian dinner ideas", False, ["recipe_search", "llm"]),
    ("Do you have pasta recipes?", False, ["recipe_search", "llm"]),
    ("I need a dessert recipe", False, ["recipe_search", "llm"]),
    ("Find a soup recipe", False, ["recipe_search", "llm"]),
    ("What can I cook with rice?", False, ["recipe_search", "llm"]),
    ("Give me the full recipe for chicken pasta", False, ["recipe_search", "product_lookup", "llm"]),
    ("How do I make beef curry?", False, ["recipe_search", "product_lookup", "llm"]),
    ("List the ingredients for salmon salad", False, ["recipe_search", "product_lookup", "llm"]),
    ("What are the steps for a vegan stir fry?", False, ["recipe_search", "product_lookup", "llm"]),
    ("Show cooking instructions for noodle soup", False, ["recipe_search", "product_lookup", "llm"]),
    ("I want the complete recipe for pancakes", False, ["recipe_search", "product_lookup", "llm"]),
    ("What do I need to buy for tacos?", False, ["recipe_search", "product_lookup", "llm"]),
    ("Make a shopping list for chicken curry", False, ["recipe_search", "product_lookup", "llm"]),
    ("Where can I buy ingredients for pasta bake?", False, ["recipe_search", "product_lookup", "llm"]),
    ("Find grocery products for this soup recipe", False, ["recipe_search", "product_lookup", "llm"]),
    ("Show me the first one", True, ["product_lookup", "llm"]),
    ("Give me the second one", True, ["product_lookup", "llm"]),
    ("Tell me about the previous one", True, ["llm"]),
    ("How do I cook that?", True, ["product_lookup", "llm"]),
    ("What ingredients are in the 3rd one?", True, ["product_lookup", "llm"]),
    ("Open this one", True, ["llm"]),
    ("What is the weather today?", False, []),
    ("Tell me a joke", False, []),
    ("Write Python code for sorting", False, []),
    ("Who is the president?", False, []),
    ("Give me stock market news", False, []),
    ("Book a flight to Sydney", False, []),
    ("What is the capital of France?", False, []),
    ("Help with my assignment essay", False, []),
]


def baseline_tools(message):
    """Old workflow always reached retrieval, product prefetch and LLM generation."""
    return ["recipe_search", "product_lookup", "llm"]


def main():
    selector = ChatToolSelector()
    baseline_passed = 0
    refactored_passed = 0

    for message, has_previous_results, expected in CASES:
        baseline_passed += baseline_tools(message) == expected
        selected = selector.select(
            message,
            has_previous_results=has_previous_results,
        ).tools
        refactored_passed += selected == expected

    total = len(CASES)
    print("Tool-selection regression evaluation")
    print("------------------------------------")
    print(f"Cases:             {total}")
    print(f"Baseline exact:    {baseline_passed}/{total} ({baseline_passed / total:.1%})")
    print(f"Refactored exact:  {refactored_passed}/{total} ({refactored_passed / total:.1%})")

    if refactored_passed != total:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
