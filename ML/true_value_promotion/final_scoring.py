import pandas as pd

def compute_final_tvp_score(df: pd.DataFrame) -> pd.DataFrame:
    final_scores = []

    for _, row in df.iterrows():
        score = row["tvp_score"]

        # Promotion adjustments
        if row.get("promotion_strong", False):
            score += 0.15

        if row.get("promotion_weak", False):
            score += 0.05

        if row.get("promotion_misleading", False):
            score -= 0.10

        if row.get("promotion_fake", False):
            score -= 0.20

        # Invalid promotions → no change

        final_scores.append(score)

    df["final_tvp_score"] = final_scores
    return df


def rank_deals(df: pd.DataFrame) -> pd.DataFrame:
    df = df.sort_values("final_tvp_score", ascending=False)
    df["rank"] = df["final_tvp_score"].rank(method="dense", ascending=False)
    return df

def add_deal_label(df):
    labels = []

    for _, row in df.iterrows():
        if row.get("promotion_strong", False):
            labels.append("Strong Deal")
        elif row.get("promotion_weak", False):
            labels.append("Weak Deal")
        elif row.get("promotion_misleading", False):
            labels.append("Misleading Deal")
        elif row.get("promotion_fake", False):
            labels.append("Fake Deal")
        else:
            labels.append("Invalid Deal")

    df["deal_label"] = labels
    return df
