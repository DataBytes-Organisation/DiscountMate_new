"""
run_ocr_batched.py
==================
Wrapper that runs Catalogue_OCR_Processing.py in memory-safe batches.

Each batch is run as a fresh subprocess so that all PaddleOCR / YOLO
native C++ memory is fully reclaimed by the OS when it exits.  This
prevents the OOM native crash that occurs after ~8-9 catalogues when
running the OCR script directly.

Usage:
    .venv\Scripts\python.exe run_ocr_batched.py

Adjust BATCH_SIZE and MIN_YEAR below to match your needs.
MIN_YEAR must match the  min_year  setting inside Catalogue_OCR_Processing.py.
"""

import subprocess
import shutil
import sys
import time

import pandas as pd
from pathlib import Path

# ── Configuration ───────────────────────────────────────────────────────────
BATCH_SIZE = 5     # catalogues per subprocess (keeps peak memory low)
MIN_YEAR   = 2024  # must match min_year in Catalogue_OCR_Processing.py
# ────────────────────────────────────────────────────────────────────────────

SCRIPT_DIR   = Path(__file__).resolve().parent
PYTHON       = SCRIPT_DIR / ".venv" / "Scripts" / "python.exe"
OCR_SCRIPT   = SCRIPT_DIR / "Catalogue_OCR_Processing.py"
TRACKING_CSV = SCRIPT_DIR / "catalogue_data" / "catalogue_tracking.csv"
BACKUP_CSV   = SCRIPT_DIR / "catalogue_data" / "catalogue_tracking.csv.batch_backup"


# ── Helpers ─────────────────────────────────────────────────────────────────

def read_unprocessed(df: pd.DataFrame) -> pd.DataFrame:
    """Return unprocessed rows using the same filters as Catalogue_OCR_Processing.py."""
    downloaded = df[df["downloaded"] == True].copy()
    downloaded["_yr"] = (
        pd.to_numeric(downloaded["year"], errors="coerce").fillna(0).astype(int)
    )
    downloaded = downloaded[downloaded["_yr"] >= MIN_YEAR]
    unprocessed = downloaded[
        (downloaded["ocr_processed"] != "Y") | downloaded["ocr_processed"].isna() | (downloaded["ocr_processed"] != "Temp_Y")
    ]
    return unprocessed


def hide_non_batch(df: pd.DataFrame, batch_slugs: list) -> list:
    """
    Temporarily mark every unprocessed catalogue that is NOT in batch_slugs
    as 'Y' so the OCR subprocess only sees batch_slugs.

    Returns the list of slugs that were hidden (so we can restore them later).
    """
    is_downloaded  = df["downloaded"] == True
    year_int       = pd.to_numeric(df["year"], errors="coerce").fillna(0).astype(int)
    is_in_year     = year_int >= MIN_YEAR
    is_unprocessed = (df["ocr_processed"] != "Y") | df["ocr_processed"].isna() | (df["ocr_processed"] != "Temp_Y")
    is_not_in_batch = ~df["slug"].isin(batch_slugs)

    hide_mask  = is_downloaded & is_in_year & is_unprocessed & is_not_in_batch
    hide_slugs = df.loc[hide_mask, "slug"].tolist()
    df.loc[hide_mask, "ocr_processed"] = "Temp_Y"  # temporarily hidden
    return hide_slugs


def restore_hidden(hide_slugs: list):
    """Set the temporarily hidden slugs back to unprocessed ('')."""
    if not hide_slugs:
        return
    df = pd.read_csv(TRACKING_CSV)
    df.loc[df["slug"].isin(hide_slugs), "ocr_processed"] = ""
    df.to_csv(TRACKING_CSV, index=False)
    print(f"  Restored {len(hide_slugs)} catalogues to unprocessed state.")


# ── Main ────────────────────────────────────────────────────────────────────

def main():
    # Validate paths
    for label, path in [
        ("Python venv",  PYTHON),
        ("OCR script",   OCR_SCRIPT),
        ("Tracking CSV", TRACKING_CSV),
    ]:
        if not path.exists():
            sys.exit(f"ERROR: {label} not found at {path}")

    wall_start   = time.perf_counter()
    batch_num    = 0
    catalogues_done   = 0

    print("=" * 65)
    print("BATCHED OCR RUNNER")
    print(f"  Batch size : {BATCH_SIZE} catalogues per subprocess")
    print(f"  Min year   : {MIN_YEAR}")
    print(f"  OCR script : {OCR_SCRIPT.name}")
    print("=" * 65)

    while True:
        df = pd.read_csv(TRACKING_CSV)
        unprocessed = read_unprocessed(df)

        if unprocessed.empty:
            print("\nAll catalogues have been processed! Exiting.")
            break

        total_remaining = len(unprocessed)
        batch_slugs = list(unprocessed["slug"].iloc[:BATCH_SIZE])
        batch_num += 1

        print(f"\n{'─' * 65}")
        print(f"BATCH {batch_num}  ({len(batch_slugs)} catalogues | {total_remaining} remaining)")
        for s in batch_slugs:
            print(f"  • {s}")
        print(f"{'─' * 65}")

        # ── Patch CSV: hide everything outside this batch ────────────────
        df_modified = df.copy()
        hide_slugs  = hide_non_batch(df_modified, batch_slugs)
        shutil.copy(TRACKING_CSV, BACKUP_CSV)           # safety backup
        df_modified.to_csv(TRACKING_CSV, index=False)
        print(f"  CSV patched ({len(hide_slugs)} catalogues hidden). Running subprocess...\n")

        # ── Run OCR subprocess ───────────────────────────────────────────
        batch_start = time.perf_counter()
        hide_slugs_copy = list(hide_slugs)  # keep a copy in case of crash

        try:
            result = subprocess.run(
                [str(PYTHON), str(OCR_SCRIPT)],
                cwd=str(SCRIPT_DIR),
            )
            exit_code = result.returncode

        except KeyboardInterrupt:
            print("\n\nKeyboard interrupt — restoring tracking CSV...")
            restore_hidden(hide_slugs_copy)
            sys.exit(0)

        except Exception as exc:
            print(f"\nSubprocess launch error: {exc}")
            exit_code = -1

        batch_elapsed = time.perf_counter() - batch_start

        # ── Restore hidden slugs ─────────────────────────────────────────
        print(f"\n  Subprocess finished in {batch_elapsed / 60:.1f} min "
              f"(exit code {exit_code}). Restoring CSV...")
        restore_hidden(hide_slugs_copy)

        # Count how many of the batch were marked Y (i.e., processed)
        df_after    = pd.read_csv(TRACKING_CSV)
        batch_done  = df_after.loc[df_after["slug"].isin(batch_slugs), "ocr_processed"]
        n_processed = (batch_done == "Y").sum()
        catalogues_done += n_processed
        print(f"  Batch result: {n_processed}/{len(batch_slugs)} catalogues processed.")

        # Overall progress / ETA
        wall_elapsed = time.perf_counter() - wall_start
        if catalogues_done > 0:
            rate_min = wall_elapsed / 60 / catalogues_done   # min per catalogue
            eta_min  = rate_min * (total_remaining - n_processed)
            print(f"  Overall: {catalogues_done} done | "
                  f"{wall_elapsed/60:.0f} min elapsed | "
                  f"ETA ≈ {eta_min/60:.1f} hrs remaining")

        # Non-zero exit (crash / error) — ask user whether to continue
        if exit_code not in (0, 1):
            print(f"\n  WARNING: subprocess exited with code {exit_code}.")
            print("  Press Enter to continue next batch, or Ctrl-C to abort.")
            try:
                input()
            except KeyboardInterrupt:
                sys.exit(0)

    total_elapsed = time.perf_counter() - wall_start
    print(f"\n{'=' * 65}")
    print(f"COMPLETE — {catalogues_done} catalogues processed "
          f"in {total_elapsed/60:.0f} minutes.")
    print("=" * 65)


if __name__ == "__main__":
    main()
