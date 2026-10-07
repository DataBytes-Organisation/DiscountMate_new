import pandas as pd
import numpy as np

# ------------------------------------------------------------
# 1. VALID PROMOTIONS
# ------------------------------------------------------------
def detect_valid_promotions(df: pd.DataFrame) -> pd.DataFrame:
    valid = []

    for _, row in df.iterrows():
        is_valid = True

        # Must have a real discount
        if pd.isna(row["price_was"]) or pd.isna(row["price_now"]):
            is_valid = False
        elif row["price_now"] >= row["price_was"]:
            is_valid = False

        # Must have a promotion type
        if not isinstance(row["promotiontype"], str) or len(row["promotiontype"].strip()) == 0:
            is_valid = False

        # Must have non-zero discount strength
        if row["discount_strength_score"] <= 0:
            is_valid = False

        # Must have reasonable confidence
        if row["confidence_score"] < 0.5:
            is_valid = False

        valid.append(bool(is_valid))

    df["promotion_valid"] = valid
    return df


# ------------------------------------------------------------
# 2. FAKE PROMOTIONS
# ------------------------------------------------------------
def detect_fake_promotions(df: pd.DataFrame) -> pd.DataFrame:
    fake = []

    for _, row in df.iterrows():
        is_fake = False

        # Promotion type exists but price didn't change
        if isinstance(row["promotiontype"], str) and len(row["promotiontype"].strip()) > 0:
            if pd.notna(row["price_was"]) and pd.notna(row["price_now"]):
                if row["price_now"] >= row["price_was"]:
                    is_fake = True

        fake.append(bool(is_fake))

    df["promotion_fake"] = fake
    return df


# ------------------------------------------------------------
# 3. WEAK PROMOTIONS
# ------------------------------------------------------------
def detect_weak_promotions(df: pd.DataFrame) -> pd.DataFrame:
    weak = []

    for _, row in df.iterrows():
        is_weak = False

        if row["discount_strength_score"] <= 0.20:
            is_weak = True

        if row["confidence_score"] < 0.40:
            is_weak = True

        weak.append(bool(is_weak))

    df["promotion_weak"] = weak
    return df



# ------------------------------------------------------------
# 4. STRONG PROMOTIONS
# ------------------------------------------------------------
def detect_strong_promotions(df: pd.DataFrame) -> pd.DataFrame:
    strong = []

    for _, row in df.iterrows():
        is_strong = False

        if row["discount_strength_score"] >= 0.20 and row["confidence_score"] >= 0.60:
            is_strong = True

        strong.append(bool(is_strong))

    df["promotion_strong"] = strong
    return df

# ------------------------------------------------------------
# 5. MISLEADING PROMOTIONS
# ------------------------------------------------------------
def detect_misleading_promotions(df: pd.DataFrame) -> pd.DataFrame:
    misleading = []

    for _, row in df.iterrows():
        is_misleading = False

        # Strong discount but unfair unit price
        if row["discount_strength_score"] > 0.20:
            if row["unit_price_fairness_score"] < 0.30:
                is_misleading = True

        misleading.append(bool(is_misleading))

    df["promotion_misleading"] = misleading
    return df


# ------------------------------------------------------------
# 6. LABEL PROMOTIONS
# ------------------------------------------------------------
def label_promotions(df: pd.DataFrame) -> pd.DataFrame:
    labels = []

    for _, row in df.iterrows():
        if row["promotion_fake"]:
            labels.append("fake")
        elif not row["promotion_valid"]:
            labels.append("invalid")
        elif row["promotion_misleading"]:
            labels.append("misleading")
        elif row["promotion_strong"]:
            labels.append("strong")
        elif row["promotion_weak"]:
            labels.append("weak")
        else:
            labels.append("unknown")

    df["promotion_label"] = labels
    return df


# ------------------------------------------------------------
# 7. PROMOTION PIPELINE
# ------------------------------------------------------------
def run_promotion_pipeline(scored_df: pd.DataFrame) -> pd.DataFrame:
    df = scored_df.copy()

    df = detect_valid_promotions(df)
    df = detect_fake_promotions(df)
    df = detect_weak_promotions(df)
    df = detect_strong_promotions(df)
    df = detect_misleading_promotions(df)
    df = label_promotions(df)

    return df
