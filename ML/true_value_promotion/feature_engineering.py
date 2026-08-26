import pandas as pd


def add_aldi_historical_pricing(aldi_df: pd.DataFrame) -> pd.DataFrame:
    """
    Derive measurable Aldi discounts using the previous observed price
    for the same product.

    The previous price is used as an experimental proxy for original_price
    because Aldi Silver Layer data does not currently provide an explicit
    original/reference price.
    """

    df = aldi_df.copy()

    df["scrape_timestamp"] = pd.to_datetime(df["scrape_timestamp"])

    # Sort observations chronologically for each product
    df = df.sort_values(["product_id", "scrape_timestamp"])

    # Previous observed price
    df["previous_price"] = (
        df.groupby("product_id")["current_price"].shift(1)
    )

    # Use previous observed price as proxy for original price
    df["original_price"] = df["previous_price"]

    # Calculate measurable saving
    df["saving_amount"] = (
        df["original_price"] - df["current_price"]
    )

    # Only price reductions represent measurable savings
    df.loc[df["saving_amount"] <= 0, "saving_amount"] = 0

    # Calculate discount percentage
    df["discount_percent"] = 0.0

    valid_discount = (
        df["original_price"].notna()
        & (df["original_price"] > 0)
        & (df["saving_amount"] > 0)
    )

    df.loc[valid_discount, "discount_percent"] = (
        df.loc[valid_discount, "saving_amount"]
        / df.loc[valid_discount, "original_price"]
        * 100
    )

    df["discount_percent"] = df["discount_percent"].round(2)

    # Flag records for which a measurable historical discount exists
    df["has_measurable_saving"] = (
        df["saving_amount"] > 0
    )

    return df
def add_base_tvp_score(df: pd.DataFrame) -> pd.DataFrame:
    """
    Calculate the base True Value Promotion score using the
    scoring formula inherited from Sharon Roy's V1 TVP model.
    """

    result = df.copy()

    # Cap dollar saving at $20 as defined in V1
    result["saving_amount_capped"] = (
        result["saving_amount"].clip(upper=20)
    )

    # V1 base promotion score
    result["base_score"] = (
        (result["saving_amount_capped"] * 0.2)
        + (result["discount_percent"] * 0.8)
    )

    result["base_score"] = result["base_score"].round(2)

    return result