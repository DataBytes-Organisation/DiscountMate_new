import pandas as pd

from ML.true_value_promotion.scoring import run_scoring_pipeline
from ML.true_value_promotion.final_scoring import (
    compute_final_tvp_score,
    add_deal_label,
)


def build_gold_examples():
    return pd.DataFrame([
        {
            "product_id": "gold_1",
            "retailer": "coles",
            "name": "Woolworths Full Cream Milk 2L",
            "category": "Dairy & Refrigerated",
            "price_was": 5.00,
            "price_now": 2.50,
            "unit_price": 1.25,
            "size_value": 2,
            "promotion_strong": True,
            "promotion_weak": False,
            "promotion_misleading": False,
            "promotion_fake": False,
        },
        {
            "product_id": "gold_2",
            "retailer": "coles",
            "name": "Regular Priced Bread",
            "category": "Bakery",
            "price_was": 4.00,
            "price_now": 4.00,
            "unit_price": 4.00,
            "size_value": 1,
            "promotion_strong": False,
            "promotion_weak": False,
            "promotion_misleading": False,
            "promotion_fake": False,
        },
        {
            "product_id": "gold_3",
            "retailer": "iga",
            "name": "Unknown Snack Item",
            "category": None,
            "price_was": 3.00,
            "price_now": 2.00,
            "unit_price": None,
            "size_value": None,
            "promotion_strong": False,
            "promotion_weak": True,
            "promotion_misleading": False,
            "promotion_fake": False,
        },
        {
            "product_id": "gold_4",
            "retailer": "woolworths",
            "name": "Cadbury Chocolate Block",
            "category": "Snacks & Confectionery",
            "price_was": 6.00,
            "price_now": 3.00,
            "unit_price": 2.00,
            "size_value": 1,
            "promotion_strong": False,
            "promotion_weak": False,
            "promotion_misleading": True,
            "promotion_fake": False,
        },
        {
            "product_id": "gold_5",
            "retailer": "coles",
            "name": "Inflated Then Discounted Item",
            "category": "Pantry",
            "price_was": 10.00,
            "price_now": 4.00,
            "unit_price": 4.00,
            "size_value": 1,
            "promotion_strong": False,
            "promotion_weak": False,
            "promotion_misleading": False,
            "promotion_fake": True,
        },
    ])


EXPECTED_LABELS = {
    "gold_1": "Strong Deal",
    "gold_2": "Invalid Deal",
    "gold_3": "Weak Deal",
    "gold_4": "Misleading Deal",
    "gold_5": "Fake Deal",
}


def run_validation():
    gold_df = build_gold_examples()

    scored_df = run_scoring_pipeline(gold_df)
    final_df = compute_final_tvp_score(scored_df)
    labelled_df = add_deal_label(final_df)

    print("=== DA-03-T11 Validation Results ===\n")

    mismatches = 0

    for _, row in labelled_df.iterrows():
        product_id = row["product_id"]
        expected = EXPECTED_LABELS.get(product_id)
        actual = row["deal_label"]
        status = "PASS" if actual == expected else "FAIL"

        if status == "FAIL":
            mismatches += 1

        print(
            f"{status} | {product_id:8s} | expected: {expected:16s} "
            f"| actual: {actual:16s} | tvp_score: {row['tvp_score']:.3f} "
            f"| final_tvp_score: {row['final_tvp_score']:.3f} "
            f"| confidence: {row['confidence_score']:.2f}"
        )

    print(f"\n{len(EXPECTED_LABELS) - mismatches}/{len(EXPECTED_LABELS)} gold examples passed.")

    if mismatches:
        print(f"{mismatches} mismatch(es) found -- see FAIL rows above.")
    else:
        print("All gold examples matched expected labels.")

    return labelled_df


if __name__ == "__main__":
    run_validation()
