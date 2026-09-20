import unittest

from recipe_rag.tool_selector import ChatToolSelector, ordinal_index


class ChatToolSelectorTests(unittest.TestCase):
    def setUp(self):
        self.selector = ChatToolSelector()

    def test_off_topic_skips_all_tools(self):
        result = self.selector.select("What is the weather today?")
        self.assertEqual(result.intent, "unsupported")
        self.assertEqual(result.tools, [])

    def test_recipe_browse_uses_search_and_llm_only(self):
        result = self.selector.select("Find vegetarian dinner recipes")
        self.assertEqual(result.tools, ["recipe_search", "llm"])

    def test_detailed_recipe_allows_product_lookup_before_generation(self):
        result = self.selector.select("Give me the full recipe for chicken pasta")
        self.assertEqual(result.tools, ["recipe_search", "product_lookup", "llm"])

    def test_shopping_request_allows_product_lookup(self):
        result = self.selector.select("What do I need to buy for beef curry?")
        self.assertEqual(result.intent, "shopping_product_request")
        self.assertIn("product_lookup", result.tools)

    def test_referential_followup_reuses_previous_results(self):
        result = self.selector.select("Show me the second one", has_previous_results=True)
        self.assertTrue(result.reuse_previous_results)
        self.assertEqual(result.tools, ["product_lookup", "llm"])

    def test_referential_without_history_runs_search(self):
        result = self.selector.select("Show me the second one", has_previous_results=False)
        self.assertFalse(result.reuse_previous_results)
        self.assertIn("recipe_search", result.tools)

    def test_ordinal_index(self):
        self.assertEqual(ordinal_index("Show me the first one"), 0)
        self.assertEqual(ordinal_index("Show me the 2nd one"), 1)
        self.assertEqual(ordinal_index("Show me the third one"), 2)
        self.assertIsNone(ordinal_index("Show me pasta recipes"))


if __name__ == "__main__":
    unittest.main()
