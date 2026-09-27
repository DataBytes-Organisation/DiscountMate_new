import pandas as pd
from ML.true_value_promotion.scoring import run_scoring_pipeline

def sample_df():
    # A small, controlled dataframe for scoring tests
    return pd.DataFrame({
        "retailer": ["coles", "woolworths", "iga"],
        "product_id": [1, 2, 3],
        "name": ["A", "B", "C"],
        "price_now": [5.0, 10.0, 20.0],
        "price_was": [10.0, 10.0, 20.0],
        "unit_price": [0.5, 1.0, 2.0],
        "size_value": [100, 200, 300],
        "size_unit": ["g", "g", "g"],
        "category": ["fruit", "fruit", "fruit"],
        "promotiontype": ["discount", "discount", "discount"]
    })


def test_scoring_pipeline_runs():
    df = sample_df()
    scored = run_scoring_pipeline(df)
    assert isinstance(scored, pd.DataFrame)
    assert len(scored) == 3


def test_discount_strength_score_range():
    df = sample_df()
    scored = run_scoring_pipeline(df)
    assert scored["discount_strength_score"].between(0, 1).all()


def test_unit_price_fairness_score_range():
    df = sample_df()
    scored = run_scoring_pipeline(df)
    assert scored["unit_price_fairness_score"].between(0, 1).all()


def test_historical_context_score_exists():
    df = sample_df()
    scored = run_scoring_pipeline(df)
    assert "historical_context_score" in scored.columns


def test_category_relevance_score_values():
    df = sample_df()
    scored = run_scoring_pipeline(df)
    assert set(scored["category_relevance_score"].unique()).issubset({0.0, 1.0})


def test_confidence_score_range():
    df = sample_df()
    scored = run_scoring_pipeline(df)
    assert scored["confidence_score"].between(0, 1).all()


def test_final_score_range():
    df = sample_df()
    scored = run_scoring_pipeline(df)
    assert scored["tvp_score"].between(0, 1).all()


def test_scoring_adds_all_expected_columns():
    df = sample_df()
    scored = run_scoring_pipeline(df)

    expected_cols = [
        "discount_strength_score",
        "unit_price_fairness_score",
        "historical_context_score",
        "category_relevance_score",
        "confidence_score",
        "tvp_score"
    ]

    for col in expected_cols:
        assert col in scored.columns


def test_scoring_handles_missing_values():
    df = sample_df()
    df.loc[0, "unit_price"] = None
    df.loc[1, "price_was"] = None
    df.loc[2, "category"] = None

    scored = run_scoring_pipeline(df)

    assert scored["discount_strength_score"].between(0, 1).all()
    assert scored["unit_price_fairness_score"].between(0, 1).all()
    assert scored["confidence_score"].between(0, 1).all()
    assert scored["tvp_score"].between(0, 1).all()
