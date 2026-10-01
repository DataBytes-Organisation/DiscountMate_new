import pytest
from ML.true_value_promotion.pipeline import run_pipeline

def test_pipeline_end_to_end():
    """
    Integration Test:
    Runs the full TVP pipeline and verifies that all major outputs exist.
    """

    result = run_pipeline()

    # Check that pipeline returns a dictionary
    assert isinstance(result, dict)

    # Check key stages exist
    assert "coles_raw" in result
    assert "wool_raw" in result
    assert "iga_raw" in result

    assert "combined_harmonised" in result
    assert "scored" in result
    assert "promotions" in result
    assert "final_tvp" in result
    assert "top_deals" in result
    assert "deal_labels" in result
    assert "json_output" in result

    # Check final TVP output is not empty
    final_tvp = result["final_tvp"]
    assert len(final_tvp) > 0

    # Check JSON output structure
    json_output = result["json_output"]
    assert "top_deals" in json_output
    assert isinstance(json_output["top_deals"], list)
    assert len(json_output["top_deals"]) > 0
