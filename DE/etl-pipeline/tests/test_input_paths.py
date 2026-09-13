from __future__ import annotations

from datetime import date
from pathlib import Path

from common.paths import resolve_input_paths
from config.settings import RuntimeConfig


def test_all_retailer_patterns_accept_showcase_and_future_sample_names(tmp_path: Path) -> None:
    filenames = {
        "products_aldi": "aldi_sample_20260814.csv",
        "products_coles": "coles_sample_20260814.csv",
        "products_iga": "iga_sample_20260814.csv",
        "products_woolworths": "woolworth_sample_20260814.csv",
    }
    models = {}
    for model, filename in filenames.items():
        retailer = model.removeprefix("products_")
        folder = tmp_path / retailer
        folder.mkdir()
        (folder / filename).write_text("product,price\nexample,1\n", encoding="utf-8")
        prefix = "woolworth" if retailer == "woolworths" else retailer
        models[model] = {"products": f"{folder}/{prefix}*{{date_compact}}*.csv"}

    config = RuntimeConfig.model_validate({
        "mode": "local",
        "paths": {"bronze_root": str(tmp_path)},
        "models": models,
    })

    for model, filename in filenames.items():
        assert resolve_input_paths(None, config, model, "products", date(2026, 8, 14)) == [
            str(tmp_path / model.removeprefix("products_") / filename)
        ]


def test_products_glob_is_used_when_the_exact_template_does_not_exist(tmp_path: Path) -> None:
    folder = tmp_path / "aldi"
    folder.mkdir()
    expected = folder / "aldi_all_products_20260504_124316(in).csv"
    expected.write_text("product,price\nexample,1\n", encoding="utf-8")
    config = RuntimeConfig.model_validate({
        "paths": {"bronze_root": str(tmp_path)},
        "models": {
            "products_aldi": {
                "products": f"{folder}/aldi_sample_{{date_compact}}.csv",
                "products_glob": f"{folder}/aldi*{{date_compact}}*.csv",
            }
        },
    })

    assert resolve_input_paths(None, config, "products_aldi", "products", date(2026, 5, 4)) == [
        str(expected)
    ]
