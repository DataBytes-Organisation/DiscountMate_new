from pathlib import Path

import pandas as pd
import matplotlib.pyplot as plt

DATA_PATH = Path("data/final_test_predictions.csv")
OUTPUT_DIR = Path("artifacts")
OUTPUT_DIR.mkdir(exist_ok=True)

df = pd.read_csv(DATA_PATH)

actual = df["discount_percentage"]
predicted = df["predicted_discount_percentage"]
error = df["absolute_error"]

# ------------------------------------------------------------
# 1. Actual vs Predicted
# ------------------------------------------------------------
plt.figure(figsize=(8, 6))

plt.scatter(
    actual,
    predicted,
    alpha=0.25,
    s=12,
)

minimum = min(actual.min(), predicted.min())
maximum = max(actual.max(), predicted.max())

plt.plot(
    [minimum, maximum],
    [minimum, maximum],
    linestyle="--",
)

plt.xlabel("Actual Discount Percentage")
plt.ylabel("Predicted Discount Percentage")
plt.title("CatBoost: Actual vs Predicted Discount Depth")
plt.tight_layout()

plt.savefig(
    OUTPUT_DIR / "actual_vs_predicted.png",
    dpi=200,
)

plt.close()

# ------------------------------------------------------------
# 2. Absolute Error Distribution
# ------------------------------------------------------------
plt.figure(figsize=(8, 6))

plt.hist(
    error,
    bins=40,
)

plt.xlabel("Absolute Error (Percentage Points)")
plt.ylabel("Number of Predictions")
plt.title("CatBoost Test Absolute Error Distribution")
plt.tight_layout()

plt.savefig(
    OUTPUT_DIR / "absolute_error_distribution.png",
    dpi=200,
)

plt.close()

# ------------------------------------------------------------
# 3. Actual and predicted distribution
# ------------------------------------------------------------
plt.figure(figsize=(8, 6))

plt.hist(
    actual,
    bins=30,
    alpha=0.6,
    label="Actual",
)

plt.hist(
    predicted,
    bins=30,
    alpha=0.6,
    label="Predicted",
)

plt.xlabel("Discount Percentage")
plt.ylabel("Number of Observations")
plt.title("Actual vs Predicted Discount Distribution")
plt.legend()
plt.tight_layout()

plt.savefig(
    OUTPUT_DIR / "actual_predicted_distribution.png",
    dpi=200,
)

plt.close()

print("=" * 70)
print("FINAL EVALUATION PLOTS CREATED")
print("=" * 70)

print("artifacts/actual_vs_predicted.png")
print("artifacts/absolute_error_distribution.png")
print("artifacts/actual_predicted_distribution.png")
