from __future__ import annotations

import importlib.util
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock


class ComparisonRuntimeAccessMigrationTest(unittest.TestCase):
    def test_latest_migration_grants_the_runtime_reader_every_required_relation(self) -> None:
        execute = Mock()
        previous_alembic = sys.modules.get("alembic")
        sys.modules["alembic"] = SimpleNamespace(op=SimpleNamespace(execute=execute))
        try:
            path = (
                Path(__file__).parents[1]
                / "migrations/versions/20260828_0011_comparison_runtime_access.py"
            )
            spec = importlib.util.spec_from_file_location("comparison_runtime_access", path)
            self.assertIsNotNone(spec)
            module = importlib.util.module_from_spec(spec)
            self.assertIsNotNone(spec.loader)
            spec.loader.exec_module(module)

            self.assertEqual(module.down_revision, "20260827_0010")
            module.upgrade()
        finally:
            if previous_alembic is None:
                sys.modules.pop("alembic", None)
            else:
                sys.modules["alembic"] = previous_alembic

        sql = "\n".join(call.args[0] for call in execute.call_args_list)
        for relation in (
            "silver.comparison_latest_offers",
            "silver.comparison_match_review_queue",
            "silver.comparison_price_history",
            "silver.comparison_product_groups",
            "silver.comparison_product_members",
            "silver.comparison_products",
            "silver.dim_retailers",
        ):
            self.assertIn(relation, sql)
        self.assertIn("TO comparison_reader", sql)
        self.assertIn("IF EXISTS", sql)
        self.assertIn("RAISE EXCEPTION", sql)
        self.assertIn("shared database user", sql)
        self.assertNotIn("must exist before", sql)
        self.assertIn("rolcreatedb", sql)
        self.assertIn("rolcreaterole", sql)
        self.assertIn("rolinherit", sql)


if __name__ == "__main__":
    unittest.main()
