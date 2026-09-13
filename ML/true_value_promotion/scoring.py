import pandas as pd
import numpy as np
# NOTE: historical_context_score currently uses a temporary synthetic dataset
# (see synthetic_price_history.py) because the real Gold Layer historical
# price data is not yet available this trimester (confirmed with Data
# Engineering). Replace with a real historical price lookup once ready.

# ------------------------------------------------------------
# 1. DISCOUNT STRENGTH SCORE
# ------------------------------------------------------------
def score_discount_strength(df: pd.DataFrame) -> pd.DataFrame:
    # Safe discount calculation
    price_was = df["price_was"].replace(0, np.nan)
    discount_strength = (price_was - df["price_now"]) / price_was

    # Replace NaN with 0
    discount_strength = discount_strength.fillna(0)

    # Clip between 0 and 1
    df["discount_strength_score"] = discount_strength.clip(0, 1)

    return df


# ------------------------------------------------------------
# 2. UNIT PRICE FAIRNESS SCORE
# ------------------------------------------------------------
def score_unit_price_fairness(df: pd.DataFrame) -> pd.DataFrame:
    # Convert unit_price to numeric safely
    df["unit_price"] = pd.to_numeric(df["unit_price"], errors="coerce")

    # Default fairness score
    df["unit_price_fairness_score"] = 0.0

    # Group by category, including NaN as its own group
    grouped = df.groupby(df["category"].fillna("UNKNOWN_CATEGORY"))

    fairness_scores = []

    for category, group in grouped:
        # If all unit prices are missing → fairness = 0
        if group["unit_price"].isna().all():
            fairness_scores.extend([0] * len(group))
            continue

        min_price = group["unit_price"].min()
        max_price = group["unit_price"].max()

        # If all unit prices are identical → fairness = 1
        if max_price == min_price:
            fairness_scores.extend([1] * len(group))
            continue

        fairness = 1 - ((group["unit_price"] - min_price) / (max_price - min_price))
        fairness_scores.extend(fairness.clip(0, 1))

    df["unit_price_fairness_score"] = fairness_scores
    return df


# ------------------------------------------------------------
# 3. HISTORICAL PRICE CONTEXT SCORE
# ------------------------------------------------------------
from ML.true_value_promotion.synthetic_price_history import get_price_history


def _historical_context_for_row(row) -> float:
    """
    Score how rare/genuine a discount is for a specific product, based on
    its own price history. Uses percentile rank: what proportion of past
    prices were higher than the current price.

    Falls back to a neutral 0.5 if no price history is available for the
    product (e.g. new product, or synthetic dataset doesn't cover it).
    """
    history = get_price_history(row.get("name"))

    if not history:
        return 0.5

    current_price = row["price_now"]

    higher_count = sum(1 for past_price in history if past_price > current_price)
    score = higher_count / len(history)

    return round(score, 3)


def score_historical_context(df: pd.DataFrame) -> pd.DataFrame:
    df["historical_context_score"] = df.apply(_historical_context_for_row, axis=1)
    return df

# ------------------------------------------------------------
# 4. CATEGORY RELEVANCE SCORE
# ------------------------------------------------------------
def score_category_relevance(df: pd.DataFrame) -> pd.DataFrame:
    # If category missing → relevance = 0
    df["category_relevance_score"] = df["category"].apply(
        lambda x: 1.0 if isinstance(x, str) and len(x.strip()) > 0 else 0.0
    )
    return df


# ------------------------------------------------------------
# 5. CONFIDENCE SCORE
# ------------------------------------------------------------
def score_confidence(df: pd.DataFrame) -> pd.DataFrame:
    confidence = []

    for _, row in df.iterrows():
        score = 1.0

        if pd.isna(row["size_value"]) or row["size_value"] == 0:
            score -= 0.2

        if pd.isna(row["unit_price"]) or row["unit_price"] == 0:
            score -= 0.2

        if pd.isna(row["price_was"]) or row["price_was"] == 0:
            score -= 0.2

        if not isinstance(row["category"], str) or len(row["category"].strip()) == 0:
            score -= 0.2

        confidence.append(max(score, 0))

    df["confidence_score"] = confidence

    return df


# ------------------------------------------------------------
# 6. FINAL TVP SCORE
# ------------------------------------------------------------
def score_final(df: pd.DataFrame) -> pd.DataFrame:
    df["tvp_score"] = (
        0.40 * df["discount_strength_score"] +
        0.25 * df["unit_price_fairness_score"] +
        0.15 * df["historical_context_score"] +
        0.10 * df["category_relevance_score"] +
        0.10 * df["confidence_score"]
    )

    return df


# ------------------------------------------------------------
# 7. SCORING PIPELINE
# ------------------------------------------------------------
def run_scoring_pipeline(harmonised_df: pd.DataFrame) -> pd.DataFrame:
    df = harmonised_df.copy()

    df = score_discount_strength(df)
    df = score_unit_price_fairness(df)
    df = score_historical_context(df)
    df = score_category_relevance(df)
    df = score_confidence(df)
    df = score_final(df)

    return df
