import pandas as pd


def adapt_aldi_to_tvp(aldi_df: pd.DataFrame) -> pd.DataFrame:
    """
    Convert Aldi Silver Layer pricing records into a TVP-compatible schema.
    """

    # Preserve the Aldi dataframe index so scalar values populate every row
    tvp_df = pd.DataFrame(index=aldi_df.index)

    # Core product fields
    tvp_df["retailer"] = "Aldi"
    tvp_df["product_id"] = aldi_df["product_id"]
    tvp_df["product_name"] = aldi_df["item_name"]

    # Fields not currently supplied by Aldi Silver Layer
    tvp_df["brand"] = pd.NA
    tvp_df["size"] = pd.NA

    # Pricing
    tvp_df["current_price"] = aldi_df["price"]
    tvp_df["original_price"] = pd.NA
    tvp_df["saving_amount"] = pd.NA

    # Unit pricing
    tvp_df["unit_price_text"] = aldi_df["unit_price"]

    # Promotion information
    tvp_df["promo_flag"] = aldi_df["is_on_special"]
    tvp_df["promotion_type"] = aldi_df["special_text"]

    # Category
    tvp_df["category_id"] = aldi_df["category_id"]

    # Metadata
    tvp_df["product_url"] = aldi_df["product_url"]
    tvp_df["scrape_timestamp"] = aldi_df["recorded_at"]

    return tvp_df