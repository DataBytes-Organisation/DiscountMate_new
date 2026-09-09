from __future__ import annotations


def validate_positive_offer_count(retailer_name: str, count: int) -> None:
    """Reject a product load that would publish no usable shelf-price offers."""
    if count <= 0:
        raise RuntimeError(
            f"{retailer_name} load produced zero positive offers; Silver sync was stopped."
        )
