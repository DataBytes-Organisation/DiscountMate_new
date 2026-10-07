import pandas as pd
from ML.true_value_promotion.promotion_detection import run_promotion_pipeline

def make_base_df():
    return pd.DataFrame([
        {
            "retailer": "woolworths",
            "product_id": 111,
            "name": "Test Product",
            "brand": "BrandX",
            "category": "Fruit",
            "size_value": 1.0,
            "size_unit": "kg",
            "price_now": 5.00,
            "price_was": 10.00,
            "unit_price": 5.00,
            "timestamp": "2026-05-04 15:31:27",
            "image_url": "/x.jpg",

            # Promotion metadata
            "promotiontype": "Special",

            # Scoring fields required by promotion detection
            "discount_strength_score": 0.8,
            "unit_price_fairness_score": 0.9,
            "historical_context_score": 0.5,
            "category_relevance_score": 1.0,
            "confidence_score": 0.8,
            "tvp_score": 0.505,
        }
    ])


def test_valid_promotion():
    df = make_base_df()
    result = run_promotion_pipeline(df)
    row = result.iloc[0]

    assert row["promotion_valid"] == True
    assert row["promotion_label"] != "invalid"


def test_invalid_promotion_empty_type():
    df = make_base_df()
    df.loc[0, "promotiontype"] = ""

    result = run_promotion_pipeline(df)
    row = result.iloc[0]

    assert row["promotion_valid"] == False
    assert row["promotion_label"] == "invalid"


def test_fake_promotion_price_not_changed():
    df = make_base_df()
    df.loc[0, "price_now"] = df.loc[0, "price_was"]  # no discount

    result = run_promotion_pipeline(df)
    row = result.iloc[0]

    assert row["promotion_fake"] == True
    assert row["promotion_label"] == "fake"


def test_strong_promotion():
    df = make_base_df()
    df.loc[0, "discount_strength_score"] = 1.0
    df.loc[0, "confidence_score"] = 1.0

    result = run_promotion_pipeline(df)
    row = result.iloc[0]

    assert row["promotion_strong"] == True
    assert row["promotion_label"] == "strong"


def test_weak_promotion():
    df = make_base_df()
    df.loc[0, "discount_strength_score"] = 0.2
    df.loc[0, "confidence_score"] = 0.5

    result = run_promotion_pipeline(df)
    row = result.iloc[0]

    assert row["promotion_weak"] == True
    assert row["promotion_label"] == "weak"
