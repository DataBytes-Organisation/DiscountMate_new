from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import pandas as pd


# ============================================================
# DL-04 T11.8
# MODEL MONITORING AND OPERATIONAL DECISION FRAMEWORK
# ============================================================

PSI_WARNING = 0.10
PSI_CRITICAL = 0.25

KS_WARNING = 0.10
KS_CRITICAL = 0.20

MAE_TOLERANCE = 0.05


def load_csv(path: Path) -> pd.DataFrame:
    if not path.exists():
        raise FileNotFoundError(f"File not found: {path}")

    return pd.read_csv(path)


def load_json(path: Path) -> dict:
    if not path.exists():
        raise FileNotFoundError(f"File not found: {path}")

    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def classify_psi(value: float) -> str:
    if value >= PSI_CRITICAL:
        return "critical"
    if value >= PSI_WARNING:
        return "warning"
    return "stable"


def classify_ks(value: float) -> str:
    if value >= KS_CRITICAL:
        return "critical"
    if value >= KS_WARNING:
        return "warning"
    return "stable"


def overall_status(statuses: list[str]) -> str:
    if "critical" in statuses:
        return "critical"

    if "warning" in statuses:
        return "warning"

    return "stable"


def calculate_drift_summary(
    early_latest: pd.DataFrame,
    q1_q4: pd.DataFrame,
) -> tuple[pd.DataFrame, dict]:

    records = []

    comparisons = [
        ("early_20pct_vs_latest_20pct", early_latest),
        ("q1_vs_q4", q1_q4),
    ]

    for comparison_name, frame in comparisons:

        for _, row in frame.iterrows():

            psi = float(row["psi"])
            ks = float(row["ks_statistic"])

            records.append(
                {
                    "comparison": comparison_name,
                    "feature": row["feature"],
                    "psi": round(psi, 6),
                    "psi_status": classify_psi(psi),
                    "ks_statistic": round(ks, 6),
                    "ks_status": classify_ks(ks),
                }
            )

    result = pd.DataFrame(records)

    statuses = []

    for _, row in result.iterrows():
        statuses.extend(
            [
                row["psi_status"],
                row["ks_status"],
            ]
        )

    summary = {
        "overall_drift_status": overall_status(statuses),
        "features_evaluated": int(result["feature"].nunique()),
        "comparisons": int(result["comparison"].nunique()),
        "critical_psi_count": int(
            (result["psi_status"] == "critical").sum()
        ),
        "warning_psi_count": int(
            (result["psi_status"] == "warning").sum()
        ),
        "critical_ks_count": int(
            (result["ks_status"] == "critical").sum()
        ),
        "warning_ks_count": int(
            (result["ks_status"] == "warning").sum()
        ),
    }

    return result, summary


def load_model_performance(
    comparison_path: Path,
) -> pd.DataFrame:

    df = load_csv(comparison_path)

    required = {
        "model",
        "rows",
        "mae",
        "rmse",
        "smape_percent",
        "directional_accuracy",
    }

    missing = required - set(df.columns)

    if missing:
        raise ValueError(
            "Model comparison missing columns: "
            f"{sorted(missing)}"
        )

    return df


def calculate_model_decision(
    performance: pd.DataFrame,
) -> tuple[pd.DataFrame, dict]:

    test = performance.copy()

    baseline_rows = test[
        test["model"] == "last_known_price"
    ]

    if baseline_rows.empty:
        raise ValueError(
            "Persistence baseline not found in comparison."
        )

    baseline = baseline_rows.iloc[0]

    baseline_mae = float(baseline["mae"])

    records = []

    for _, row in test.iterrows():

        model = row["model"]
        mae = float(row["mae"])

        if model == "last_known_price":
            decision = "baseline_reference"
            mae_difference = 0.0
            relative_change = 0.0

        else:
            mae_difference = mae - baseline_mae

            relative_change = (
                mae_difference / baseline_mae
                if baseline_mae > 0
                else np.nan
            )

            if mae <= baseline_mae * (1 - MAE_TOLERANCE):
                decision = "ml_preferred"

            elif mae <= baseline_mae * (1 + MAE_TOLERANCE):
                decision = "statistically_close"

            else:
                decision = "baseline_preferred"

        records.append(
            {
                "model": model,
                "rows": int(row["rows"]),
                "mae": round(mae, 4),
                "rmse": round(float(row["rmse"]), 4),
                "smape_percent": round(
                    float(row["smape_percent"]),
                    2,
                ),
                "directional_accuracy": round(
                    float(row["directional_accuracy"]),
                    4,
                ),
                "mae_difference_vs_baseline": round(
                    mae_difference,
                    4,
                ),
                "relative_mae_change_vs_baseline": round(
                    relative_change,
                    4,
                ),
                "decision": decision,
            }
        )

    result = pd.DataFrame(records)

    ml_models = result[
        result["model"] != "last_known_price"
    ]

    if ml_models.empty:
        selected_model = "last_known_price"
    else:
        best_ml = ml_models.sort_values(
            "mae"
        ).iloc[0]

        if best_ml["mae"] <= baseline_mae:
            selected_model = best_ml["model"]
        else:
            selected_model = "last_known_price"

    summary = {
        "baseline_model": "last_known_price",
        "baseline_mae": round(baseline_mae, 4),
        "selected_operational_model": selected_model,
        "selection_rule": (
            "Select ML only when its test MAE is no worse "
            "than the persistence baseline; otherwise retain "
            "the persistence baseline."
        ),
    }

    return result, summary


def build_monitoring_decision(
    drift_summary: dict,
    model_summary: dict,
) -> dict:

    drift_status = drift_summary[
        "overall_drift_status"
    ]

    selected_model = model_summary[
        "selected_operational_model"
    ]

    if drift_status == "critical":
        monitoring_status = "critical"

        action = (
            "Do not assume the current ML model will generalise "
            "under the observed distribution shift. Retain the "
            "persistence baseline as the aggregate reference, "
            "investigate drift drivers, and trigger retraining "
            "or recalibration evaluation before deploying a new "
            "ML forecasting policy."
        )

    elif drift_status == "warning":
        monitoring_status = "warning"

        action = (
            "Continue monitoring temporal drift and model "
            "performance. Re-evaluate the ML forecast against "
            "the persistence baseline before promotion."
        )

    else:
        monitoring_status = "stable"

        action = (
            "Continue normal monitoring and compare model "
            "performance against the persistence baseline."
        )

    if selected_model == "last_known_price":
        forecast_policy = (
            "Use last-known-price persistence as the current "
            "operational forecast policy."
        )
    else:
        forecast_policy = (
            f"Use {selected_model} as the current operational "
            "forecast policy."
        )

    return {
        "monitoring_status": monitoring_status,
        "drift_status": drift_status,
        "selected_operational_model": selected_model,
        "forecast_policy": forecast_policy,
        "recommended_action": action,
    }


def write_json(path: Path, payload: dict) -> None:

    with open(path, "w", encoding="utf-8") as f:
        json.dump(
            payload,
            f,
            indent=2,
            default=str,
        )


def write_report(
    path: Path,
    drift_summary: dict,
    model_summary: dict,
    decision: dict,
    drift_table: pd.DataFrame,
    model_table: pd.DataFrame,
) -> None:

    lines = []

    lines.append(
        "# DL-04-T11.8 Model Monitoring and Operational Decision Report"
    )
    lines.append("")

    lines.append("## Purpose")
    lines.append("")
    lines.append(
        "T11.8 converts the DL-04 evaluation, reliability and "
        "temporal drift findings into an operational monitoring "
        "decision framework."
    )
    lines.append("")

    lines.append("## Monitoring Status")
    lines.append("")
    lines.append(
        f"- Overall monitoring status: "
        f"**{decision['monitoring_status'].upper()}**"
    )
    lines.append(
        f"- Drift status: "
        f"**{decision['drift_status'].upper()}**"
    )
    lines.append(
        f"- Selected operational model: "
        f"**{decision['selected_operational_model']}**"
    )
    lines.append("")

    lines.append("## Operational Decision")
    lines.append("")
    lines.append(
        f"**Forecast policy:** {decision['forecast_policy']}"
    )
    lines.append("")
    lines.append(
        f"**Recommended action:** {decision['recommended_action']}"
    )
    lines.append("")

    lines.append("## Drift Evidence")
    lines.append("")
    lines.append(
        f"- Features evaluated: "
        f"{drift_summary['features_evaluated']}"
    )
    lines.append(
        f"- Comparisons: "
        f"{drift_summary['comparisons']}"
    )
    lines.append(
        f"- Critical PSI findings: "
        f"{drift_summary['critical_psi_count']}"
    )
    lines.append(
        f"- Warning PSI findings: "
        f"{drift_summary['warning_psi_count']}"
    )
    lines.append(
        f"- Critical KS findings: "
        f"{drift_summary['critical_ks_count']}"
    )
    lines.append(
        f"- Warning KS findings: "
        f"{drift_summary['warning_ks_count']}"
    )
    lines.append("")

    lines.append("### Drift Thresholds")
    lines.append("")
    lines.append(
        "| Metric | Stable | Warning | Critical |"
    )
    lines.append(
        "|---|---:|---:|---:|"
    )
    lines.append(
        f"| PSI | < {PSI_WARNING} | "
        f"{PSI_WARNING}–{PSI_CRITICAL} | "
        f">= {PSI_CRITICAL} |"
    )
    lines.append(
        f"| KS | < {KS_WARNING} | "
        f"{KS_WARNING}–{KS_CRITICAL} | "
        f">= {KS_CRITICAL} |"
    )
    lines.append("")

    lines.append("## Model Performance")
    lines.append("")
    lines.append(
        model_table.to_markdown(index=False)
    )
    lines.append("")

    lines.append("## Drift Results")
    lines.append("")
    lines.append(
        drift_table.to_markdown(index=False)
    )
    lines.append("")

    lines.append("## Interpretation")
    lines.append("")
    lines.append(
        "The monitoring framework does not force the ML model "
        "to be selected simply because it is more sophisticated. "
        "The persistence baseline is retained when it provides "
        "equal or better aggregate test performance."
    )
    lines.append("")
    lines.append(
        "This makes the DL-04 contribution evaluation-driven: "
        "the project explicitly measures whether machine learning "
        "adds value, identifies the regimes where it can help, "
        "and detects distribution changes that may invalidate "
        "previous model assumptions."
    )
    lines.append("")

    lines.append("## Final Recommendation")
    lines.append("")
    lines.append(
        f"**{decision['recommended_action']}**"
    )
    lines.append("")

    path.write_text(
        "\n".join(lines),
        encoding="utf-8",
    )


def main() -> None:

    parser = argparse.ArgumentParser(
        description=(
            "DL-04 T11.8 model monitoring and "
            "operational decision framework."
        )
    )

    parser.add_argument(
        "--drift-early-latest",
        default=(
            "outputs/"
            "dl04_t11_7b_early_latest_feature_drift.csv"
        ),
    )

    parser.add_argument(
        "--drift-q1-q4",
        default=(
            "outputs/"
            "dl04_t11_7b_q1_q4_feature_drift.csv"
        ),
    )

    parser.add_argument(
        "--model-comparison",
        default=(
            "outputs/"
            "dl04_change_aware_comparison.csv"
        ),
    )

    parser.add_argument(
        "--output-dir",
        default="outputs",
    )

    args = parser.parse_args()

    output_dir = Path(args.output_dir)
    output_dir.mkdir(
        parents=True,
        exist_ok=True,
    )

    early_latest_path = Path(
        args.drift_early_latest
    )

    q1_q4_path = Path(
        args.drift_q1_q4
    )

    comparison_path = Path(
        args.model_comparison
    )

    print("=" * 70)
    print(
        "DL-04 T11.8 MODEL MONITORING "
        "AND OPERATIONAL DECISION FRAMEWORK"
    )
    print("=" * 70)

    print()
    print("Drift evidence:")
    print(f"  {early_latest_path}")
    print(f"  {q1_q4_path}")

    print()
    print("Model comparison:")
    print(f"  {comparison_path}")

    print()
    print("Output:")
    print(f"  {output_dir}")

    # ------------------------------------------------------------
    # Load drift evidence
    # ------------------------------------------------------------

    early_latest = load_csv(
        early_latest_path
    )

    q1_q4 = load_csv(
        q1_q4_path
    )

    # ------------------------------------------------------------
    # Calculate drift summary
    # ------------------------------------------------------------

    print()
    print("=" * 70)
    print("DRIFT MONITORING")
    print("=" * 70)

    drift_table, drift_summary = calculate_drift_summary(
        early_latest,
        q1_q4,
    )

    print(
        f"Overall drift status: "
        f"{drift_summary['overall_drift_status']}"
    )

    print(
        f"Critical PSI: "
        f"{drift_summary['critical_psi_count']}"
    )

    print(
        f"Critical KS: "
        f"{drift_summary['critical_ks_count']}"
    )

    # ------------------------------------------------------------
    # Model performance
    # ------------------------------------------------------------

    print()
    print("=" * 70)
    print("MODEL DECISION")
    print("=" * 70)

    performance = load_model_performance(
        comparison_path
    )

    model_table, model_summary = calculate_model_decision(
        performance
    )

    print(
        f"Baseline MAE: "
        f"{model_summary['baseline_mae']:.4f}"
    )

    print(
        f"Selected operational model: "
        f"{model_summary['selected_operational_model']}"
    )

    # ------------------------------------------------------------
    # Final monitoring decision
    # ------------------------------------------------------------

    decision = build_monitoring_decision(
        drift_summary,
        model_summary,
    )

    print()
    print("=" * 70)
    print("FINAL MONITORING DECISION")
    print("=" * 70)

    print(
        f"Monitoring status: "
        f"{decision['monitoring_status']}"
    )

    print(
        f"Drift status: "
        f"{decision['drift_status']}"
    )

    print(
        f"Operational model: "
        f"{decision['selected_operational_model']}"
    )

    print()
    print(
        f"Forecast policy:\n"
        f"{decision['forecast_policy']}"
    )

    print()
    print(
        f"Recommended action:\n"
        f"{decision['recommended_action']}"
    )

    # ------------------------------------------------------------
    # Save outputs
    # ------------------------------------------------------------

    drift_output = (
        output_dir
        / "dl04_t11_8_drift_monitoring.csv"
    )

    model_output = (
        output_dir
        / "dl04_t11_8_model_decision.csv"
    )

    summary_output = (
        output_dir
        / "dl04_t11_8_monitoring_summary.json"
    )

    report_output = (
        output_dir
        / "DL-04-T11.8_Model_Monitoring_Report.md"
    )

    drift_table.to_csv(
        drift_output,
        index=False,
    )

    model_table.to_csv(
        model_output,
        index=False,
    )

    full_summary = {
        "task": "DL-04-T11.8",
        "drift": drift_summary,
        "model": model_summary,
        "decision": decision,
        "thresholds": {
            "psi_warning": PSI_WARNING,
            "psi_critical": PSI_CRITICAL,
            "ks_warning": KS_WARNING,
            "ks_critical": KS_CRITICAL,
            "mae_tolerance": MAE_TOLERANCE,
        },
    }

    write_json(
        summary_output,
        full_summary,
    )

    write_report(
        report_output,
        drift_summary,
        model_summary,
        decision,
        drift_table,
        model_table,
    )

    print()
    print("=" * 70)
    print("T11.8 OUTPUTS")
    print("=" * 70)

    print(f"  {drift_output}")
    print(f"  {model_output}")
    print(f"  {summary_output}")
    print(f"  {report_output}")

    print()
    print(
        "DL-04 T11.8 monitoring framework completed."
    )


if __name__ == "__main__":
    main()