from __future__ import annotations

from typing import Dict, Iterable

import numpy as np


def get_price_prediction_ml(
    *,
    product_id: str,
    days_ahead: int,
    current_price: float,
    price_history: Iterable[float],
) -> Dict:
    numeric_history = [float(value) for value in price_history]
    baseline_values = numeric_history or [float(current_price)]

    current_price = float(current_price)
    moving_average = float(np.mean(baseline_values))
    bounded_days = max(1, min(int(days_ahead), 30))

    price_delta = moving_average - current_price
    predicted_price = round(max(current_price + (price_delta * bounded_days / 30), 0), 2)
    confidence = round(max(0.35, min(0.85, 0.55 + (len(numeric_history) * 0.03))), 2)

    trend = "stable"
    if predicted_price > current_price + 0.05:
        trend = "up"
    elif predicted_price < current_price - 0.05:
        trend = "down"

    return {
        "product_id": product_id,
        "days_ahead": bounded_days,
        "current_price": round(current_price, 2),
        "predicted_price": predicted_price,
        "predicted_change": round(predicted_price - current_price, 2),
        "trend": trend,
        "confidence": confidence,
        "model_info": {
            "model_type": "moving_average_mvp",
            "status": "deployable_mvp",
        },
    }
