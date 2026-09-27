# Historical Context Scoring (DA-03-T5)

Replaces the previous placeholder (`historical_context_score = 0.5` for every
product) with real logic that scores how genuinely rare a discount is for a
specific product, based on its own price history.

## Why this matters
The scoring pipeline previously treated every product's discount the same,
regardless of that product's actual pricing pattern. A product that discounts
every week and a product that has never discounted before could receive the
same score, which doesn't reflect real value to a shopper.

## Data source (temporary)
The real historical price data (Gold Layer) is not yet available this
trimester — confirmed with Data Engineering. Per their guidance, this task
uses a temporary synthetic dataset (`synthetic_price_history.py`) covering a
small set of real Woolworths product names with different pricing patterns:

- Rarely discounts (e.g. milk) — mostly stable, one rare drop
- Frequently discounts (e.g. chocolate) — regular promo cycling
- Never discounts (e.g. bananas) — always the same price

This should be replaced with a real historical price lookup once the Gold
Layer's model implementation is ready (expected next trimester).

## Scoring logic
For each product, the score is the proportion of past prices that were
higher than the current price:

    score = (number of historical prices higher than current price) / (total historical prices)

- Products at a genuinely rare low price → high score (close to 1.0)
- Products at their normal/frequently-seen price → low score (close to 0.0)
- Products with no price history available → neutral fallback score (0.5)

## Test results
| Product | Current price | Result | Interpretation |
|---|---|---|---|
| Woolworths Full Cream Milk 2L | $2.00 | 0.875 | Genuinely rare low price |
| Cadbury Dairy Milk Chocolate Bar 50g | $2.00 | 0.5 | Normal price for this product |
| Woolworths Cavendish Bananas Each | $0.81 | 0.0 | This is its usual price, no discount |
| Unknown Product Not In History | $5.00 | 0.5 | No history available, neutral fallback |

All 5 gold examples in the main validation script (validate_tvp_scoring.py)
continued to pass after this change, confirming integration into the full
scoring pipeline did not break existing behaviour.

## Files
- `synthetic_price_history.py` — temporary mock price history dataset
- `scoring.py` — updated `score_historical_context()` function
- `test_historical_context.py` — focused tests for the scoring logic itself
