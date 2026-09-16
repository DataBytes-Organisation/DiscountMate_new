# TVP Scoring Validation (DA-03-T11)

Lightweight validation script for the True Value Promotion scoring pipeline.

## What it does
Runs 5 hand-picked "gold" example products through the real scoring pipeline
(scoring.py, final_scoring.py) and checks the resulting deal_label matches
what's expected, given each product's known characteristics.

## Gold examples
- gold_1: genuine strong discount, full data -> Strong Deal
- gold_2: no discount at all -> Invalid Deal
- gold_3: missing category/unit price data -> Weak Deal (tests confidence penalty)
- gold_4: misleading promotion flag -> Misleading Deal
- gold_5: fake promotion flag -> Fake Deal

## How to run
python -m ML.true_value_promotion.validate_tvp_scoring

## Results
5/5 gold examples passed.

## Known limitations found
- historical_context_score is currently a hardcoded placeholder (0.5 for
  every product), so even products with no discount receive a non-zero
  score (~0.525). This is a pipeline limitation, not a validation script bug.
