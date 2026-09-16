#!/usr/bin/env python3
"""
Generate the DiscountMate DA-01 synthetic behavioural user dataset.

Source requirements:
- DA-01 Persona Archetype Definitions (T2 2026)
- DA-01-T7 Behavioural Data Dictionary (T2 2026)

The exported CSV intentionally excludes an archetype label so that its schema
matches the behavioural data dictionary exactly.
"""

from __future__ import annotations

import csv
import random
from collections import Counter
from pathlib import Path

SEED = 20260831
GENERATION_DATE = "20260831"
REPORTING_WINDOW_START = "2026-08-17"
REPORTING_WINDOW_END = "2026-08-30"
TOTAL_USERS = 1500
MISSING_FIRST_VISIT_COUNT = 300  # exactly 20% of 1,500
NOISE_FRACTION = 0.10

OUTPUT_COLUMNS = [
    # Behavioural features in DA-01-T7 dictionary order (avg_percent_scrolled omitted).
    "sessions_count",
    "avg_engagement_time_sec",
    "pageviews_per_session",
    "compare_ratio",
    "specials_ratio",
    "mylists_ratio",
    "category_browse_ratio",
    "product_detail_ratio",
    "unique_pages_visited",
    "browsing_entropy",
    "days_since_first_visit",
    "days_since_last_activity",
    # Supporting dataset fields.
    "user_pseudo_id",
    "reporting_window_start",
    "reporting_window_end",
    "is_included_in_run",
]

RATIO_FEATURES = [
    "compare_ratio",
    "specials_ratio",
    "mylists_ratio",
    "category_browse_ratio",
    "product_detail_ratio",
]

INTEGER_FEATURES = {
    "sessions_count",
    "unique_pages_visited",
    "days_since_first_visit",
    "days_since_last_activity",
}

# Ranges come directly from DA-01 Persona Archetype Definitions.
ARCHETYPES = {
    "Budget-Conscious Shopper": {
        "count": 525,
        "ranges": {
            "sessions_count": (3, 6),
            "avg_engagement_time_sec": (60, 180),
            "pageviews_per_session": (4, 8),
            "compare_ratio": (0.15, 0.35),
            "specials_ratio": (0.15, 0.35),
            "mylists_ratio": (0.00, 0.05),
            "category_browse_ratio": (0.05, 0.15),
            "product_detail_ratio": (0.00, 0.10),
            "unique_pages_visited": (8, 15),
            "browsing_entropy": (0.60, 0.85),
            "days_since_first_visit": (3, 14),
            "days_since_last_activity": (0, 4),
        },
    },
    "Family Planner": {
        "count": 375,
        "ranges": {
            "sessions_count": (4, 8),
            "avg_engagement_time_sec": (90, 240),
            "pageviews_per_session": (5, 10),
            "compare_ratio": (0.05, 0.15),
            "specials_ratio": (0.05, 0.15),
            "mylists_ratio": (0.15, 0.30),
            "category_browse_ratio": (0.10, 0.20),
            "product_detail_ratio": (0.05, 0.15),
            "unique_pages_visited": (10, 20),
            "browsing_entropy": (0.50, 0.75),
            "days_since_first_visit": (5, 14),
            "days_since_last_activity": (0, 3),
        },
    },
    "Health Enthusiast": {
        "count": 225,
        "ranges": {
            "sessions_count": (2, 4),
            "avg_engagement_time_sec": (120, 300),
            "pageviews_per_session": (3, 6),
            "compare_ratio": (0.00, 0.10),
            "specials_ratio": (0.00, 0.05),
            "mylists_ratio": (0.00, 0.05),
            "category_browse_ratio": (0.10, 0.25),
            "product_detail_ratio": (0.15, 0.30),
            "unique_pages_visited": (5, 10),
            "browsing_entropy": (0.30, 0.60),
            "days_since_first_visit": (3, 14),
            "days_since_last_activity": (0, 5),
        },
    },
    "Convenience Seeker": {
        "count": 75,
        "ranges": {
            "sessions_count": (1, 2),
            "avg_engagement_time_sec": (10, 60),
            "pageviews_per_session": (2, 4),
            "compare_ratio": (0.00, 0.05),
            "specials_ratio": (0.00, 0.05),
            "mylists_ratio": (0.00, 0.05),
            "category_browse_ratio": (0.00, 0.10),
            "product_detail_ratio": (0.00, 0.05),
            "unique_pages_visited": (2, 5),
            "browsing_entropy": (0.00, 0.35),
            "days_since_first_visit": (1, 14),
            "days_since_last_activity": (0, 7),
        },
    },
    "Premium Shopper": {
        "count": 75,
        "ranges": {
            "sessions_count": (2, 4),
            "avg_engagement_time_sec": (120, 300),
            "pageviews_per_session": (4, 8),
            "compare_ratio": (0.00, 0.10),
            "specials_ratio": (0.00, 0.05),
            "mylists_ratio": (0.00, 0.10),
            "category_browse_ratio": (0.10, 0.20),
            "product_detail_ratio": (0.15, 0.30),
            "unique_pages_visited": (6, 12),
            "browsing_entropy": (0.40, 0.70),
            "days_since_first_visit": (3, 14),
            "days_since_last_activity": (0, 7),
        },
    },
    "Low-signal residual": {
        "count": 225,
        "ranges": {
            "sessions_count": (1, 1),
            "avg_engagement_time_sec": (5, 40),
            "pageviews_per_session": (2, 3),
            "compare_ratio": (0.00, 0.00),
            "specials_ratio": (0.00, 0.00),
            "mylists_ratio": (0.00, 0.00),
            "category_browse_ratio": (0.00, 0.05),
            "product_detail_ratio": (0.00, 0.05),
            "unique_pages_visited": (2, 3),
            "browsing_entropy": (0.00, 0.20),
            "days_since_first_visit": (1, 14),
            "days_since_last_activity": (0, 10),
        },
    },
}


def sample_noisy(rng: random.Random, low: float, high: float, *, integer: bool = False):
    """Uniform base sample + N(0, 10% of range), clipped to the specified bounds."""
    if low == high:
        value = low
    else:
        base = rng.uniform(low, high)
        noise = rng.gauss(0.0, NOISE_FRACTION * (high - low))
        value = min(high, max(low, base + noise))

    if integer:
        return int(round(value))
    return float(value)


def sample_ratios(rng: random.Random, ranges: dict[str, tuple[float, float]]) -> dict[str, float]:
    """Sample affinity ratios while enforcing the <= 0.95 total-ratio constraint."""
    for _ in range(1000):
        values = {
            feature: round(sample_noisy(rng, *ranges[feature], integer=False), 4)
            for feature in RATIO_FEATURES
        }
        # Enforce the constraint on the actual values that will be exported.
        if sum(values.values()) <= 0.95:
            return values
    raise RuntimeError("Could not satisfy ratio-sum constraint after 1000 attempts.")


def generate_person(rng: random.Random, archetype: str) -> dict:
    ranges = ARCHETYPES[archetype]["ranges"]

    sessions = sample_noisy(rng, *ranges["sessions_count"], integer=True)
    engagement = sample_noisy(rng, *ranges["avg_engagement_time_sec"])
    pageviews = sample_noisy(rng, *ranges["pageviews_per_session"])

    ratios = sample_ratios(rng, ranges)

    unique_pages = sample_noisy(rng, *ranges["unique_pages_visited"], integer=True)
    # Keep distinct pages physically plausible relative to approximate total pageviews.
    approximate_total_pageviews = max(1, int(round(sessions * pageviews)))
    unique_pages = min(unique_pages, approximate_total_pageviews)

    entropy = sample_noisy(rng, *ranges["browsing_entropy"])

    first_visit = sample_noisy(rng, *ranges["days_since_first_visit"], integer=True)
    last_low, last_high = ranges["days_since_last_activity"]
    constrained_last_high = min(last_high, first_visit)
    last_activity = sample_noisy(
        rng,
        last_low,
        constrained_last_high,
        integer=True,
    )

    return {
        "_archetype": archetype,
        "reporting_window_start": REPORTING_WINDOW_START,
        "reporting_window_end": REPORTING_WINDOW_END,
        "is_included_in_run": 1,
        "sessions_count": sessions,
        "avg_engagement_time_sec": round(engagement, 2),
        "pageviews_per_session": round(pageviews, 2),
        "compare_ratio": ratios["compare_ratio"],
        "specials_ratio": ratios["specials_ratio"],
        "mylists_ratio": ratios["mylists_ratio"],
        "category_browse_ratio": ratios["category_browse_ratio"],
        "product_detail_ratio": ratios["product_detail_ratio"],
        "unique_pages_visited": unique_pages,
        "browsing_entropy": round(entropy, 4),
        "days_since_first_visit": first_visit,
        "days_since_last_activity": last_activity,
    }


def validate(records: list[dict]) -> None:
    assert len(records) == TOTAL_USERS
    counts = Counter(r["_archetype"] for r in records)
    assert counts == Counter({k: v["count"] for k, v in ARCHETYPES.items()})

    missing_first = sum(r["days_since_first_visit"] is None for r in records)
    assert missing_first == MISSING_FIRST_VISIT_COUNT

    for row in records:
        assert row["is_included_in_run"] == 1
        assert row["reporting_window_start"] == REPORTING_WINDOW_START
        assert row["reporting_window_end"] == REPORTING_WINDOW_END

        for feature in RATIO_FEATURES:
            assert 0.0 <= row[feature] <= 1.0
        assert sum(row[f] for f in RATIO_FEATURES) <= 0.95 + 1e-9
        assert 0.0 <= row["browsing_entropy"] <= 1.0

        assert row["sessions_count"] >= 0 and isinstance(row["sessions_count"], int)
        assert row["unique_pages_visited"] >= 0 and isinstance(row["unique_pages_visited"], int)
        assert row["days_since_last_activity"] >= 0 and isinstance(row["days_since_last_activity"], int)

        if row["days_since_first_visit"] is not None:
            assert isinstance(row["days_since_first_visit"], int)
            assert row["days_since_first_visit"] >= 0
            assert row["days_since_last_activity"] <= row["days_since_first_visit"]

        # Check all non-missing behavioural values remain inside the supplied archetype bounds.
        ranges = ARCHETYPES[row["_archetype"]]["ranges"]
        for feature, (low, high) in ranges.items():
            if feature == "days_since_first_visit" and row[feature] is None:
                continue
            value = row[feature]
            assert low <= value <= high, (row["_archetype"], feature, value, low, high)


def main() -> None:
    rng = random.Random(SEED)

    records = []
    for archetype, spec in ARCHETYPES.items():
        for _ in range(spec["count"]):
            records.append(generate_person(rng, archetype))

    # Shuffle rows so the exported dataset is not grouped by synthetic archetype.
    rng.shuffle(records)

    # Exactly 20% missing days_since_first_visit, independently across the mixed dataset.
    for idx in rng.sample(range(TOTAL_USERS), MISSING_FIRST_VISIT_COUNT):
        records[idx]["days_since_first_visit"] = None

    # Stable synthetic GA4-like IDs after shuffling.
    for i, row in enumerate(records, start=1):
        row["user_pseudo_id"] = f"syn_{GENERATION_DATE}_{i:06d}"

    validate(records)

    output = Path(__file__).resolve().parent / "Data" / f"synthetic_users_{GENERATION_DATE}.csv"
    with output.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=OUTPUT_COLUMNS)
        writer.writeheader()
        for row in records:
            exported = {col: row[col] for col in OUTPUT_COLUMNS}
            # CSV blank for intentionally missing first_visit values.
            if exported["days_since_first_visit"] is None:
                exported["days_since_first_visit"] = ""
            writer.writerow(exported)

    counts = Counter(r["_archetype"] for r in records)
    print(f"Wrote: {output}")
    print(f"Rows: {len(records)}")
    print(f"Seed: {SEED}")
    print(f"Reporting window: {REPORTING_WINDOW_START} to {REPORTING_WINDOW_END}")
    print(f"Missing days_since_first_visit: {MISSING_FIRST_VISIT_COUNT}")
    print("Synthetic generation counts:")
    for archetype in ARCHETYPES:
        print(f"  {archetype}: {counts[archetype]}")
    print("Validation: PASS")


if __name__ == "__main__":
    main()
