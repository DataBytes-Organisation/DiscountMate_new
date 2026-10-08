import pandas as pd
from ML.true_value_promotion.final_scoring import compute_final_tvp_score


def test_final_score_strong_promotion():
    df = pd.DataFrame([
        {
            "tvp_score": 0.50,
            "promotion_strong": True,
            "promotion_weak": False,
            "promotion_misleading": False,
            "promotion_fake": False,
        }
    ])

    result = compute_final_tvp_score(df)
    assert result.loc[0, "final_tvp_score"] > 0.50


def test_final_score_fake_promotion():
    df = pd.DataFrame([
        {
            "tvp_score": 0.50,
            "promotion_strong": False,
            "promotion_weak": False,
            "promotion_misleading": False,
            "promotion_fake": True,
        }
    ])

    result = compute_final_tvp_score(df)
    assert result.loc[0, "final_tvp_score"] < 0.50


def test_final_score_weak_promotion():
    df = pd.DataFrame([
        {
            "tvp_score": 0.50,
            "promotion_strong": False,
            "promotion_weak": True,
            "promotion_misleading": False,
            "promotion_fake": False,
        }
    ])

    result = compute_final_tvp_score(df)
    assert result.loc[0, "final_tvp_score"] == 0.55


def test_final_score_misleading_promotion():
    df = pd.DataFrame([
        {
            "tvp_score": 0.50,
            "promotion_strong": False,
            "promotion_weak": False,
            "promotion_misleading": True,
            "promotion_fake": False,
        }
    ])

    result = compute_final_tvp_score(df)
    assert result.loc[0, "final_tvp_score"] == 0.40


def test_final_score_invalid_promotion():
    df = pd.DataFrame([
        {
            "tvp_score": 0.50,
            "promotion_strong": False,
            "promotion_weak": False,
            "promotion_misleading": False,
            "promotion_fake": False,
        }
    ])

    result = compute_final_tvp_score(df)
    assert result.loc[0, "final_tvp_score"] == 0.50
