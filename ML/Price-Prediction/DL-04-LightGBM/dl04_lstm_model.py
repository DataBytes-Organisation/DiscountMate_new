"""
DL-04 LSTM Price Forecasting Model

Purpose:
    Train and evaluate an LSTM-based next-price forecasting model
    using the existing DL-04 chronological training dataset.

Progression:
    Persistence -> LightGBM -> LSTM -> LSTM + Attention

Target:
    target_next_price

Evaluation:
    MAE
    RMSE
    Directional Accuracy
"""

from pathlib import Path

import json
import random

import numpy as np
import pandas as pd
import tensorflow as tf
from sklearn.metrics import mean_absolute_error, mean_squared_error
from sklearn.preprocessing import StandardScaler
from tensorflow.keras import Sequential
from tensorflow.keras.callbacks import EarlyStopping
from tensorflow.keras.layers import Dense, Dropout, LSTM


# ---------------------------------------------------------------------
# Reproducibility
# ---------------------------------------------------------------------

SEED = 42

random.seed(SEED)
np.random.seed(SEED)
tf.random.set_seed(SEED)


# ---------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------

ROOT = Path(__file__).resolve().parent

DATA_PATH = (
    ROOT
    / "data"
    / "processed"
    / "dl04_next_price_training_dataset.csv"
)

OUTPUT_DIR = ROOT / "outputs"

OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


# ---------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------

SEQUENCE_LENGTH = 3

EPOCHS = 100
BATCH_SIZE = 64


# ---------------------------------------------------------------------
# Features
# ---------------------------------------------------------------------

FEATURE_COLUMNS = [
    "price",
    "unit_price",
    "discount_amount",
    "discount_percent",
    "is_on_special",
    "unit_price_missing",
    "has_special_text",
    "recorded_month",
    "recorded_day_of_week",
    "recorded_day_of_month",
    "previous_price",
    "previous_unit_price",
    "previous_is_on_special",
    "days_since_previous_observation",
    "previous_price_change",
    "previous_price_change_pct",
    "observation_number",
]


# ---------------------------------------------------------------------
# Load dataset
# ---------------------------------------------------------------------


def load_dataset() -> pd.DataFrame:
    """Load and prepare the DL-04 training dataset."""

    print("=" * 70)
    print("DL-04 LSTM PRICE FORECASTING")
    print("=" * 70)

    print(f"\nLoading dataset:\n{DATA_PATH}")

    df = pd.read_csv(DATA_PATH)

    print(f"Dataset shape: {df.shape}")

    df["recorded_at"] = pd.to_datetime(
        df["recorded_at"],
        errors="coerce",
        utc=True,
    )

    df["target_next_recorded_at"] = pd.to_datetime(
        df["target_next_recorded_at"],
        errors="coerce",
        utc=True,
    )

    df = df.sort_values(
        ["product_id", "recorded_at"]
    ).reset_index(drop=True)

    return df


# ---------------------------------------------------------------------
# Feature preparation
# ---------------------------------------------------------------------


def prepare_features(df: pd.DataFrame) -> pd.DataFrame:
    """Prepare numeric model features."""

    data = df.copy()

    for column in FEATURE_COLUMNS:
        if column not in data.columns:
            raise ValueError(
                f"Required feature column missing: {column}"
            )

        data[column] = pd.to_numeric(
            data[column],
            errors="coerce",
        )

    data[FEATURE_COLUMNS] = data[FEATURE_COLUMNS].replace(
        [np.inf, -np.inf],
        np.nan,
    )

    # Fill missing numeric values using training-compatible
    # neutral values. Scaling is performed later.
    data[FEATURE_COLUMNS] = data[FEATURE_COLUMNS].fillna(0.0)

    data["target_next_price"] = pd.to_numeric(
        data["target_next_price"],
        errors="coerce",
    )

    data = data.dropna(
        subset=["target_next_price"]
    ).copy()

    return data


# ---------------------------------------------------------------------
# Create sequences
# ---------------------------------------------------------------------


def create_sequences(
    df: pd.DataFrame,
    scaler: StandardScaler,
    sequence_length: int,
):
    """
    Create product-level sequential samples from the full chronological
    history.

    The sequence uses the previous `sequence_length` observations from
    the same product. The target is target_next_price for the current
    observation.

    The original split assigned to the target observation is retained so
    that train, validation and test samples can be separated after
    sequence generation.
    """

    X = []
    y = []
    current_prices = []
    splits = []

    for product_id, group in df.groupby(
        "product_id",
        sort=False,
    ):
        group = group.sort_values("recorded_at").copy()

        if len(group) <= sequence_length:
            continue

        values = scaler.transform(
            group[FEATURE_COLUMNS]
        )

        targets = group["target_next_price"].to_numpy(
            dtype=np.float32
        )

        prices = group["price"].to_numpy(
            dtype=np.float32
        )

        group_splits = group["split"].to_numpy()

        for i in range(
            sequence_length,
            len(group),
        ):
            X.append(
                values[
                    i - sequence_length : i
                ]
            )

            y.append(targets[i])

            current_prices.append(prices[i])

            splits.append(group_splits[i])

    if not X:
        return (
            np.empty(
                (
                    0,
                    sequence_length,
                    len(FEATURE_COLUMNS),
                ),
                dtype=np.float32,
            ),
            np.empty(
                (0,),
                dtype=np.float32,
            ),
            np.empty(
                (0,),
                dtype=np.float32,
            ),
            np.empty(
                (0,),
                dtype=object,
            ),
        )

    return (
        np.asarray(X, dtype=np.float32),
        np.asarray(y, dtype=np.float32),
        np.asarray(current_prices, dtype=np.float32),
        np.asarray(splits),
    )

# ---------------------------------------------------------------------
# Build LSTM
# ---------------------------------------------------------------------


def build_model(
    n_features: int,
    sequence_length: int,
) -> tf.keras.Model:
    """Build the LSTM regression model."""

    model = Sequential(
        [
            LSTM(
                64,
                input_shape=(
                    sequence_length,
                    n_features,
                ),
                return_sequences=False,
            ),
            Dropout(0.2),
            Dense(32, activation="relu"),
            Dense(1),
        ]
    )

    model.compile(
        optimizer=tf.keras.optimizers.Adam(
            learning_rate=0.001
        ),
        loss="mse",
        metrics=["mae"],
    )

    return model


# ---------------------------------------------------------------------
# Evaluation
# ---------------------------------------------------------------------


def directional_accuracy(
    actual: np.ndarray,
    predicted: np.ndarray,
    current_price: np.ndarray,
) -> float:
    """Calculate directional accuracy."""

    actual_direction = np.sign(
        actual - current_price
    )

    predicted_direction = np.sign(
        predicted - current_price
    )

    return float(
        np.mean(
            actual_direction
            == predicted_direction
        )
    )


def evaluate_model(
    y_true: np.ndarray,
    y_pred: np.ndarray,
    current_prices: np.ndarray,
) -> dict:
    """Calculate DL-04 evaluation metrics."""

    mae = mean_absolute_error(
        y_true,
        y_pred,
    )

    rmse = np.sqrt(
        mean_squared_error(
            y_true,
            y_pred,
        )
    )

    direction = directional_accuracy(
        y_true,
        y_pred,
        current_prices,
    )

    return {
        "mae": float(mae),
        "rmse": float(rmse),
        "directional_accuracy": float(direction),
        "directional_accuracy_percent": float(
            direction * 100
        ),
        "n_samples": int(len(y_true)),
    }


# ---------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------


def main():
    # -------------------------------------------------------------
    # Load
    # -------------------------------------------------------------

    df = load_dataset()

    df = prepare_features(df)

    print(
        f"\nPrepared dataset shape: {df.shape}"
    )

    print("\nExisting split distribution:")

    print(
        df["split"]
        .value_counts()
        .sort_index()
    )

    # -------------------------------------------------------------
    # Chronological split
    # -------------------------------------------------------------

    train_df = df[
        df["split"] == "train"
    ].copy()

    validation_df = df[
        df["split"] == "validation"
    ].copy()

    test_df = df[
        df["split"] == "test"
    ].copy()

    print("\nSplit sizes:")

    print(f"Train:      {len(train_df):,}")
    print(f"Validation: {len(validation_df):,}")
    print(f"Test:       {len(test_df):,}")

    # -------------------------------------------------------------
    # Fit scaler ONLY on training data
    # -------------------------------------------------------------

    scaler = StandardScaler()

    scaler.fit(
        train_df[FEATURE_COLUMNS]
    )

    # -------------------------------------------------------------
    # Create sequences from the full chronological history
    # -------------------------------------------------------------

    print(
        f"\nCreating sequences "
        f"(length={SEQUENCE_LENGTH}) from full product history..."
    )

    X_all, y_all, p_all, split_all = create_sequences(
        df,
        scaler,
        SEQUENCE_LENGTH,
    )

    print("\nAll sequence shapes:")
    print(f"X_all: {X_all.shape}")
    print(f"y_all: {y_all.shape}")

    print("\nSequence split distribution:")
    print(
        pd.Series(split_all)
        .value_counts()
        .sort_index()
    )

    # -------------------------------------------------------------
    # Restore chronological train / validation / test separation
    # -------------------------------------------------------------

    train_mask = split_all == "train"
    validation_mask = split_all == "validation"
    test_mask = split_all == "test"

    X_train = X_all[train_mask]
    y_train = y_all[train_mask]
    p_train = p_all[train_mask]

    X_validation = X_all[validation_mask]
    y_validation = y_all[validation_mask]
    p_validation = p_all[validation_mask]

    X_test = X_all[test_mask]
    y_test = y_all[test_mask]
    p_test = p_all[test_mask]

    print("\nSequence shapes:")
    print(f"X_train:      {X_train.shape}")
    print(f"y_train:      {y_train.shape}")

    print(f"X_validation: {X_validation.shape}")
    print(f"y_validation: {y_validation.shape}")

    print(f"X_test:       {X_test.shape}")
    print(f"y_test:       {y_test.shape}")

    # -------------------------------------------------------------
    # Build model
    # -------------------------------------------------------------

    model = build_model(
        n_features=len(FEATURE_COLUMNS),
        sequence_length=SEQUENCE_LENGTH,
    )

    print("\nModel architecture:")

    model.summary()

    # -------------------------------------------------------------
    # Training
    # -------------------------------------------------------------

    early_stopping = EarlyStopping(
        monitor="val_loss",
        patience=10,
        restore_best_weights=True,
        verbose=1,
    )

    print("\nTraining LSTM...")

    history = model.fit(
        X_train,
        y_train,
        validation_data=(
            X_validation,
            y_validation,
        ),
        epochs=EPOCHS,
        batch_size=BATCH_SIZE,
        callbacks=[early_stopping],
        verbose=1,
    )

    # -------------------------------------------------------------
    # Predictions
    # -------------------------------------------------------------

    print("\nGenerating test predictions...")

    predictions = model.predict(
        X_test,
        batch_size=BATCH_SIZE,
        verbose=0,
    ).reshape(-1)

    # -------------------------------------------------------------
    # Evaluation
    # -------------------------------------------------------------

    metrics = evaluate_model(
        y_test,
        predictions,
        p_test,
    )

    print("\n" + "=" * 70)
    print("LSTM TEST RESULTS")
    print("=" * 70)

    print(
        f"MAE:                  {metrics['mae']:.4f}"
    )

    print(
        f"RMSE:                 {metrics['rmse']:.4f}"
    )

    print(
        f"Directional Accuracy: "
        f"{metrics['directional_accuracy_percent']:.2f}%"
    )

    print(
        f"Test Samples:         {metrics['n_samples']:,}"
    )

    # -------------------------------------------------------------
    # Save model
    # -------------------------------------------------------------

    model_path = (
        OUTPUT_DIR
        / "dl04_lstm_model.keras"
    )

    model.save(model_path)

    print(
        f"\nSaved model: {model_path}"
    )

    # -------------------------------------------------------------
    # Save metrics
    # -------------------------------------------------------------

    metrics_path = (
        OUTPUT_DIR
        / "dl04_lstm_results.json"
    )

    with open(
        metrics_path,
        "w",
        encoding="utf-8",
    ) as f:
        json.dump(
            metrics,
            f,
            indent=2,
        )

    print(
        f"Saved metrics: {metrics_path}"
    )

    # -------------------------------------------------------------
    # Save predictions
    # -------------------------------------------------------------

    predictions_df = pd.DataFrame(
        {
            "actual_next_price": y_test,
            "predicted_next_price": predictions,
            "current_price": p_test,
            "actual_change": y_test - p_test,
            "predicted_change": predictions - p_test,
        }
    )

    predictions_path = (
        OUTPUT_DIR
        / "dl04_lstm_predictions.csv"
    )

    predictions_df.to_csv(
        predictions_path,
        index=False,
    )

    print(
        f"Saved predictions: {predictions_path}"
    )

    # -------------------------------------------------------------
    # Save training history
    # -------------------------------------------------------------

    history_df = pd.DataFrame(
        history.history
    )

    history_path = (
        OUTPUT_DIR
        / "dl04_lstm_training_history.csv"
    )

    history_df.to_csv(
        history_path,
        index=False,
    )

    print(
        f"Saved training history: {history_path}"
    )

    print("\nLSTM training and evaluation complete.")


if __name__ == "__main__":
    main()