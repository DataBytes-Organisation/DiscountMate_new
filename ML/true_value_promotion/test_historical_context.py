"""
DA-03-T5: Focused test for the historical context scoring logic.

Checks that products with a genuine rare discount score high, products
that discount frequently score lower, products at their normal price score
low, and products with no history fall back to the neutral 0.5 default.
"""

import pandas as pd

from ML.true_value_promotion.scoring import _historical_context_for_row

test_cases = [
    {
        "name": "Woolworths Full Cream Milk 2L",
        "price_now": 2.00,
        "expected": "high (rare discount)",
    },
    {
        "name": "Cadbury Dairy Milk Chocolate Bar 50g",
        "price_now": 2.00,
        "expected": "medium/low (frequent discount, normal for this product)",
    },
    {
        "name": "Woolworths Cavendish Bananas Each",
        "price_now": 0.81,
        "expected": "low (this is the normal price, no discount)",
    },
    {
        "name": "Unknown Product Not In History",
        "price_now": 5.00,
        "expected": "0.5 (fallback, no history available)",
    },
]

print("=== Historical Context Score Tests ===\n")

for case in test_cases:
    score = _historical_context_for_row(pd.Series(case))
    print(f"{case['name']}")
    print(f"  price_now: {case['price_now']}")
    print(f"  expected: {case['expected']}")
    print(f"  actual score: {score}\n")
