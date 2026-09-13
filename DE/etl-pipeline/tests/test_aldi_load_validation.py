import pytest

from features.products.aldi import job as aldi_job


def test_aldi_job_rejects_a_zero_positive_offer_load():
    validator = getattr(aldi_job, "_validate_positive_offer_count", None)
    assert validator is not None

    with pytest.raises(RuntimeError, match="ALDI.*zero positive offers"):
        validator(0)

    validator(1)

