"""
DL-04 Model Governance

Purpose:
    Provide a reproducible model-selection and governance decision
    for the DL-04 next-price forecasting pipeline.

Governance checks:
    1. Compare candidate models against the persistence baseline.
    2. Identify whether any candidate improves test MAE.
    3. Summarise PSI and KS drift results.
    4. Combine predictive performance and drift into a final
       governance decision.
    5. Save an auditable governance decision CSV.

Models:
    - last_known_price
    - lightgbm_regression
    - change_aware_lightgbm

Decision principle:
    The persistence baseline is preferred unless a candidate model
    demonstrates lower test MAE than the baseline.

    A critical drift finding does not automatically invalidate the
    baseline. Instead, it triggers a review-required status so that
    model deployment is not treated as fully approved without
    investigating temporal/data drift.
"""

from pathlib import Path

import pandas as pd


# ---------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------

ROOT = Path(__file__).resolve().parent

OUTPUT_DIR = ROOT / "outputs"

MODEL_RESULTS_PATH = (
    OUTPUT_DIR / "dl04_model_comparison.csv"
)

DRIFT_RESULTS_PATH = (
    OUTPUT_DIR / "dl04_t11_8_drift_monitoring.csv"
)

OUTPUT_PATH = (
    OUTPUT_DIR / "dl04_model_governance_decision.csv"
)


# ---------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------

BASELINE_MODEL = "last_known_price"

CANDIDATE_MODELS = [
    "lightgbm_regression",
    "change_aware_lightgbm",
]

PSI_CRITICAL_THRESHOLD = 0.25
PSI_WARNING_THRESHOLD = 0.10

KS_CRITICAL_THRESHOLD = 0.20
KS_WARNING_THRESHOLD = 0.10


# ---------------------------------------------------------------------
# Loading
# ---------------------------------------------------------------------


def load_model_results() -> pd.DataFrame:
    """Load model comparison results."""

    if not MODEL_RESULTS_PATH.exists():
        raise FileNotFoundError(
            f"Model results file not found:\n"
            f"{MODEL_RESULTS_PATH}"
        )

    df = pd.read_csv(MODEL_RESULTS_PATH)

    required_columns = {
        "split",
        "model",
        "rows",
        "mae",
        "rmse",
        "smape_percent",
        "directional_accuracy",
    }

    missing = required_columns - set(df.columns)

    if missing:
        raise ValueError(
            "Model results are missing required columns: "
            f"{sorted(missing)}"
        )

    return df


def load_drift_results() -> pd.DataFrame:
    """Load feature and prediction drift results."""

    if not DRIFT_RESULTS_PATH.exists():
        raise FileNotFoundError(
            f"Drift results file not found:\n"
            f"{DRIFT_RESULTS_PATH}"
        )

    df = pd.read_csv(DRIFT_RESULTS_PATH)

    required_columns = {
        "comparison",
        "feature",
        "psi",
        "psi_status",
        "ks_statistic",
        "ks_status",
    }

    missing = required_columns - set(df.columns)

    if missing:
        raise ValueError(
            "Drift results are missing required columns: "
            f"{sorted(missing)}"
        )

    return df


# ---------------------------------------------------------------------
# Model governance
# ---------------------------------------------------------------------


def prepare_test_model_comparison(
    model_results: pd.DataFrame,
) -> pd.DataFrame:
    """
    Prepare test-set model comparison.

    Calculates each model's MAE difference and relative MAE change
    against the persistence baseline.
    """

    test_results = model_results[
        model_results["split"].str.lower() == "test"
    ].copy()

    if test_results.empty:
        raise ValueError(
            "No test-set model results were found."
        )

    baseline_rows = test_results[
        test_results["model"] == BASELINE_MODEL
    ]

    if baseline_rows.empty:
        raise ValueError(
            f"Baseline model '{BASELINE_MODEL}' "
            "was not found in test results."
        )

    baseline_mae = float(
        baseline_rows.iloc[0]["mae"]
    )

    test_results["baseline_mae"] = baseline_mae

    test_results[
        "mae_difference_vs_baseline"
    ] = (
        test_results["mae"] - baseline_mae
    )

    test_results[
        "relative_mae_change_vs_baseline"
    ] = (
        test_results["mae"] - baseline_mae
    ) / baseline_mae

    return test_results


def determine_best_model(
    comparison: pd.DataFrame,
) -> tuple[str, str]:
    """
    Determine the preferred predictive model.

    The persistence baseline remains the reference unless at least
    one candidate has strictly lower test MAE.
    """

    baseline = comparison[
        comparison["model"] == BASELINE_MODEL
    ]

    if baseline.empty:
        raise ValueError(
            "Baseline model is missing from comparison."
        )

    baseline_mae = float(
        baseline.iloc[0]["mae"]
    )

    candidates = comparison[
        comparison["model"].isin(CANDIDATE_MODELS)
    ].copy()

    if candidates.empty:
        return (
            BASELINE_MODEL,
            "No candidate models were available; "
            "the persistence baseline remains the reference.",
        )

    best_candidate = candidates.loc[
        candidates["mae"].idxmin()
    ]

    candidate_mae = float(
        best_candidate["mae"]
    )

    candidate_name = str(
        best_candidate["model"]
    )

    if candidate_mae < baseline_mae:
        improvement = (
            (baseline_mae - candidate_mae)
            / baseline_mae
            * 100
        )

        return (
            candidate_name,
            (
                f"{candidate_name} improves test MAE over "
                f"the persistence baseline by "
                f"{improvement:.2f}%."
            ),
        )

    return (
        BASELINE_MODEL,
        (
            "No candidate model improves test MAE over "
            "the persistence baseline."
        ),
    )


# ---------------------------------------------------------------------
# Drift governance
# ---------------------------------------------------------------------


def summarise_drift(
    drift_results: pd.DataFrame,
) -> dict:
    """Summarise PSI and KS drift severity."""

    psi_critical = int(
        (
            drift_results["psi_status"]
            .astype(str)
            .str.lower()
            == "critical"
        ).sum()
    )

    psi_warning = int(
        (
            drift_results["psi_status"]
            .astype(str)
            .str.lower()
            == "warning"
        ).sum()
    )

    ks_critical = int(
        (
            drift_results["ks_status"]
            .astype(str)
            .str.lower()
            == "critical"
        ).sum()
    )

    ks_warning = int(
        (
            drift_results["ks_status"]
            .astype(str)
            .str.lower()
            == "warning"
        ).sum()
    )

    if psi_critical > 0 or ks_critical > 0:
        drift_status = "critical"
    elif psi_warning > 0 or ks_warning > 0:
        drift_status = "warning"
    else:
        drift_status = "stable"

    return {
        "drift_status": drift_status,
        "psi_critical_count": psi_critical,
        "ks_critical_count": ks_critical,
        "psi_warning_count": psi_warning,
        "ks_warning_count": ks_warning,
    }


# ---------------------------------------------------------------------
# Governance decision
# ---------------------------------------------------------------------


def determine_governance_status(
    selected_model: str,
    drift_summary: dict,
) -> str:
    """
    Determine final governance status.

    Performance determines the selected predictive model.

    Drift determines whether the model can be treated as stable
    or requires review.
    """

    drift_status = drift_summary["drift_status"]

    if drift_status == "critical":
        return "review_required"

    if drift_status == "warning":
        return "monitor_required"

    if selected_model == BASELINE_MODEL:
        return "baseline_approved"

    return "candidate_approved"


# ---------------------------------------------------------------------
# Save
# ---------------------------------------------------------------------


def save_governance_decision(
    selected_model: str,
    decision_reason: str,
    drift_summary: dict,
    governance_status: str,
) -> pd.DataFrame:
    """Create and save the governance decision."""

    decision = pd.DataFrame(
        [
            {
                "selected_model": selected_model,
                "decision_reason": decision_reason,
                "drift_status": drift_summary[
                    "drift_status"
                ],
                "psi_critical_count": drift_summary[
                    "psi_critical_count"
                ],
                "ks_critical_count": drift_summary[
                    "ks_critical_count"
                ],
                "psi_warning_count": drift_summary[
                    "psi_warning_count"
                ],
                "ks_warning_count": drift_summary[
                    "ks_warning_count"
                ],
                "governance_status": governance_status,
            }
        ]
    )

    decision.to_csv(
        OUTPUT_PATH,
        index=False,
    )

    return decision


# ---------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------


def main() -> None:
    """Run DL-04 model governance."""

    print("=" * 70)
    print("DL-04 MODEL GOVERNANCE")
    print("=" * 70)

    # -------------------------------------------------------------
    # Load
    # -------------------------------------------------------------

    model_results = load_model_results()

    drift_results = load_drift_results()

    print(
        f"\nLoaded model results: "
        f"{len(model_results)} rows"
    )

    print(
        f"Loaded drift results: "
        f"{len(drift_results)} rows"
    )

    # -------------------------------------------------------------
    # Model comparison
    # -------------------------------------------------------------

    comparison = prepare_test_model_comparison(
        model_results
    )

    print("\nTest-set model comparison:")

    display_columns = [
        "model",
        "rows",
        "mae",
        "rmse",
        "smape_percent",
        "directional_accuracy",
        "mae_difference_vs_baseline",
        "relative_mae_change_vs_baseline",
    ]

    print(
        comparison[display_columns]
        .to_string(index=False)
    )

    # -------------------------------------------------------------
    # Model decision
    # -------------------------------------------------------------

    selected_model, decision_reason = (
        determine_best_model(comparison)
    )

    print("\nPredictive model decision:")
    print(
        f"  Selected model: {selected_model}"
    )
    print(
        f"  Reason: {decision_reason}"
    )

    # -------------------------------------------------------------
    # Drift
    # -------------------------------------------------------------

    drift_summary = summarise_drift(
        drift_results
    )

    print("\nDrift summary:")

    for key, value in drift_summary.items():
        print(
            f"  {key}: {value}"
        )

    # -------------------------------------------------------------
    # Final governance status
    # -------------------------------------------------------------

    governance_status = (
        determine_governance_status(
            selected_model,
            drift_summary,
        )
    )

    print("\nFinal governance decision:")

    print(
        f"  selected_model: {selected_model}"
    )

    print(
        f"  decision_reason: {decision_reason}"
    )

    print(
        f"  drift_status: "
        f"{drift_summary['drift_status']}"
    )

    print(
        f"  governance_status: "
        f"{governance_status}"
    )

    # -------------------------------------------------------------
    # Save
    # -------------------------------------------------------------

    decision = save_governance_decision(
        selected_model=selected_model,
        decision_reason=decision_reason,
        drift_summary=drift_summary,
        governance_status=governance_status,
    )

    print("\nSaved governance decision:")

    print(OUTPUT_PATH)

    print("\nGovernance decision:")
    print(
        decision.to_string(index=False)
    )

    print("\nDL-04 model governance complete.")


if __name__ == "__main__":
    main()