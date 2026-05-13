================================================================================
  CATALOGUE OCR PIPELINE — HANDOVER REPORT
  Project: E:\Catalogue_Scraping_2025
  Date:    April 2026
================================================================================

This report covers two scripts:
  1. Catalogue_OCR_Processing.py   — the core OCR engine
  2. run_ocr_batched.py            — the memory-safe batch runner (wrapper)

Both scripts must be run using the project's virtual environment:
  .venv\Scripts\python.exe

DO NOT modify Catalogue_OCR_Processing.py without understanding the full
pipeline. All operational control should be done through run_ocr_batched.py
or by editing the two configuration variables at lines 664–674 of the OCR
script directly (process number - set to any number if wishing to process less
all, otherwise leave as "all" to process full backlog, in weekly runs leave as
'all' assuming 4 catalogues to process weekly). Year has been set to 2024 to 
reduce the total backlog, for two years approximate 3-4 day continuous run time.


================================================================================
  PART 1 — Catalogue_OCR_Processing.py
================================================================================

────────────────────────────────────────────────────────────────────────────────
  NON-TECHNICAL SUMMARY
────────────────────────────────────────────────────────────────────────────────

What does this script do?
  This script reads every supermarket catalogue that has been downloaded to
  disk, and extracts product information from each page — things like product
  names, prices, and promo savings — into a single spreadsheet
  (Catalogue_OCR_Database.csv).

  It does this in three steps for every page of every catalogue:
    1. It scans the page image and finds rectangles ("tiles") that look like
       individual product advertisements.
    2. For each product tile, it scans inside it to find smaller sub-regions:
       the product name area, the price area, the "SAVE $X" area, and the
       unit price area.
    3. It reads the text out of each sub-region using an AI text-reading
       system called PaddleOCR.

  The results are written out row-by-row to the CSV output file. After each
  catalogue completes, the tracking spreadsheet (catalogue_tracking.csv) is
  updated so that catalogue is marked as done, and will be skipped if you
  re-run the script.

  The script is designed to be resumable — if it crashes or is stopped, you
  can restart it and it will pick up from where it left off.

Known limitation:
  PaddleOCR (the text-reading system) uses a native C++ library underneath
  Python. This library slowly leaks memory that Python cannot reclaim. After
  approximately 8–10 catalogues, the system runs out of memory and the script
  crashes silently (no error message is shown). This is why run_ocr_batched.py
  exists — see Part 2.


────────────────────────────────────────────────────────────────────────────────
  TECHNICAL SUMMARY
────────────────────────────────────────────────────────────────────────────────

File:       Catalogue_OCR_Processing.py
Total lines: ~830
Language:   Python 3.10
Key dependencies:
  - ultralytics 8.3.240     (YOLO object detection)
  - paddlepaddle 2.6.2      (PaddleOCR backend)
  - paddleocr 2.9.1         (text recognition)
  - opencv-python 4.11.0    (image loading and manipulation)
  - torch 2.7.1+cu118       (PyTorch — YOLO runs on CPU at present;
                              cuda.is_available() returns False on this machine)
  - pandas, numpy

Entry point:
  if __name__ == "__main__": block at line ~790, calls main()

──────────────────────────────────────
  SECTION 1 — Configuration (lines 32-75)
──────────────────────────────────────
  Defines all path constants and model hyperparameters.

  Key paths:
    CATALOGUE_DATA_DIR   = catalogue_data/
    CATALOGUES_IMAGE_DIR = catalogues/              (subfolders: store/year/slug/)
    WEIGHTS_DIR          = weights_yolo/
    TRACKING_CSV         = catalogue_data/catalogue_tracking.csv
    OCR_OUTPUT_CSV       = catalogue_data/Catalogue_OCR_Database.csv

  Key model settings:
    MODEL_1_WEIGHTS = weights_yolo/YOLO_Model_1_Full_Crop.pt
    MODEL_2_WEIGHTS = weights_yolo/YOLO_Model_2_sub_crop.pt
    MODEL_1_IMG_SIZE = 1280   (full page inference resolution)
    MODEL_2_IMG_SIZE = 640    (tile sub-crop inference resolution)
    CONF_THRESHOLD   = 0.25   (minimum detection confidence)
    IOU_THRESHOLD_M1 = 0.45
    IOU_THRESHOLD_M2 = 0.7
    GC_EVERY_N_PAGES = 2      (Python Garbage Collection forced every 2 pages)
    YOLO_DEVICE      = "cuda" if torch.cuda.is_available() else "cpu"
                       — resolves to "cpu" on this machine

  CLASS_MAPPING (line 65–71):
    Maps YOLO class names to CSV column names:
      description_block  → Name
      price_main         → Price_Now
      promo_text_block   → Save_amount
      unit_price_block   → UnitPrice
      product_image_block → (skipped — no OCR performed)

  OUTPUT_COLUMNS (line 43–49):
    The 23 columns written to Catalogue_OCR_Database.csv:
      store, Retailer, title, slug, year, state,
      catalogue_on_sale_date, scraped_date, page_count, catalogue_id,
      page_number, tile_number, tile_confidence, tiles_on_page,
      Name, Price_Now, Price_Raw, Price_Spatial, Price_Black,
      Save_amount, PriceWas, UnitPrice, ocr_processed_date

──────────────────────────────────────
  SECTION 2 — Logging (lines 78–104)
──────────────────────────────────────
  Function: setup_logging()
    Creates a timestamped log file in catalogue_data/logs/ each run:
      ocr_pipeline_log_YYYYMMDD_HHMMSS.txt
    Logs to both file and stdout simultaneously.
    Called at module level — logging starts before main() is called.

──────────────────────────────────────
  SECTION 3 — Lazy Model Loading (lines 108–144)
──────────────────────────────────────
  Three global singletons: _model1, _model2, _paddle_ocr

  Function: get_model1()
    Loads YOLO_Model_1_Full_Crop.pt on first call only.
    Moves model to YOLO_DEVICE (cpu).
    Returns cached instance on subsequent calls.

  Function: get_model2()
    Loads YOLO_Model_2_sub_crop.pt on first call only.
    Same caching pattern as get_model1().

  Function: get_paddle_ocr()
    Instantiates PaddleOCR(use_angle_cls=False, lang='en', show_log=False).
    Once loaded, the PaddleOCR instance is reused for the entire run.
    IMPORTANT: This is the source of the memory leak — PaddleOCR's native
    C++ allocations cannot be freed while the Python process is alive.

──────────────────────────────────────
  SECTION 4 — Utility Functions (lines 146–187)
──────────────────────────────────────
  Function: extract_retailer(catalogue_name)
    Matches the catalogue slug/name against KNOWN_RETAILERS list.
    Returns the retailer name (e.g. "Woolworths") or "Unknown".

  Function: extract_page_number(filename)
    Parses page number from filename using regex: page_001.jpg → 1

  Function: _extract_black_text(crop_bgr, dark_thresh=80)
    Converts a BGR image to a binary mask isolating dark (near-black) pixels.
    Used as a second OCR pass for price regions where dark text is more
    reliably extracted than the full-colour image.
    Returns a grayscale image (white background, black text).

  Function: extract_numeric_price(text)
    Converts a raw price string like "$3.49" or "349" to a Python float.
    Returns None if no valid number found.

──────────────────────────────────────
  SECTION 5 — PaddleOCR Wrapper (lines 191–216)
──────────────────────────────────────
  Function: _paddle_ocr_crop(crop_bgr)
    The lowest-level OCR call. Accepts a numpy image array.
    Calls get_paddle_ocr().ocr(crop_bgr, cls=False).
    Returns a list of detection dicts, each with:
      text, conf, bbox, cx (x-centre), cy (y-centre), h (height)
    Sorted top-to-bottom, left-to-right.
    If PaddleOCR returns no results or raises an exception, returns [].

──────────────────────────────────────
  SECTION 6 — Price Extraction (lines 220–324)
──────────────────────────────────────
  Function: _extract_price_from_detections(detections)
    Takes the list of OCR detections for a price region.
    Attempts three strategies in order to find a numeric price:
      1. Decimal match  — regex finds "3.49" in concatenated text
      2. Space-separated — "3 49" interpreted as "$3.49"
      3. Digits-only fallback — "349" → "$3.49" based on digit count rules
    Also attempts spatial layout detection:
      Large-font digits = dollar amount; small superscript digits = cents.
    Returns (raw_price, spatial_price) — both may be None.

  Function: _paddle_extract_price(crop_bgr)
    Runs TWO PaddleOCR calls on a price region:
      Call 1: raw colour image → gets Price_Raw and Price_Spatial
      Call 2: black-text extracted image → gets Price_Black
    Selects best price: Price_Raw preferred, then Price_Spatial, then Price_Black.
    Returns dict: {Price_Raw, Price_Spatial, Price_Black, Price_Now}

──────────────────────────────────────
  SECTION 7 — Text / Promo / Unit Extraction (lines 328–401)
──────────────────────────────────────
  Function: _paddle_extract_text(crop_bgr)
    Single PaddleOCR call. Joins all detected text with spaces.
    Strips leading/trailing punctuation. Used for product Name field.

  Function: _parse_promo_save_amount(raw_text)
    Attempts to extract a dollar saving from promo text like "SAVE $3.00"
    or "$3 OFF". Returns float or None.
    Falls back to extracting the smallest dollar amount in the text.

  Function: _paddle_extract_promo(crop_bgr)
    Single PaddleOCR call on a promo_text_block region.
    Returns formatted saving amount (e.g. "3.00") or raw text if no
    parseable amount found.

  Function: _paddle_extract_unit(crop_bgr)
    Single PaddleOCR call on a unit_price_block region.
    Returns text stripped of non-price characters (keeps digits, $, /, letters).

──────────────────────────────────────
  SECTION 8 — Core OCR Dispatcher (lines 407–423)
──────────────────────────────────────
  Function: perform_ocr_production(crop_img, box_class)
    Routes a sub-region crop to the correct extraction function based on
    YOLO class name:
      price_main         → _paddle_extract_price()
      description_block  → _paddle_extract_text()
      promo_text_block   → _paddle_extract_promo()
      unit_price_block   → _paddle_extract_unit()
      product_image_block → {} (skipped)

──────────────────────────────────────
  SECTION 9 — Tile Processing (lines 427–5483)
──────────────────────────────────────
  Function: process_single_tile(tile_bbox, page_img)
    Given a bounding box from Model 1 and the full page image:
      1. Crops the tile from the page.
      2. Runs Model 2 on the tile crop to detect sub-regions.
      3. For each detected sub-region class, takes only the highest-confidence
         detection per class (deduplication).
      4. Crops each sub-region and calls perform_ocr_production().
      5. Calculates PriceWas = Price_Now + Save_amount (if both present).
    Returns a dict of all extracted fields for this tile.
    deletes intermediate numpy arrays explicitly to assist GC.

──────────────────────────────────────
  SECTION 10 — Page Processing (lines 491–558)
──────────────────────────────────────
  Function: process_single_page(page_image_path, catalogue_meta)
    1. Loads page image with cv2.imread().
    2. Runs Model 1 to detect all product tiles on the page.
    3. Iterates over each tile bounding box, calls process_single_tile().
    4. Assembles full product rows (merging tile OCR results with catalogue
       metadata such as store, slug, year, state, page_count, etc.).
    5. Deletes page image from memory, calls gc.collect().
    Returns list of product row dicts for this page.

    Catalogue metadata fields attached to each product row:
      store, Retailer, title, slug, year, state,
      catalogue_on_sale_date, scraped_date, page_count, catalogue_id

──────────────────────────────────────
  SECTION 11 — Catalogue Processing (lines 561–621)
──────────────────────────────────────
  Function: process_single_catalogue(catalogue_row)
    1. Constructs the path: catalogues/{store}/{year}/{slug}/
    2. Finds all page images (page_*.jpg first, then any image file).
    3. Iterates pages in order, calling process_single_page() for each.
    4. Calls append_to_ocr_database() after each page (not buffered).
    5. Forces gc.collect() every GC_EVERY_N_PAGES pages.
    6. Catches per-page exceptions and logs them — page errors do NOT
       abort the whole catalogue.
    Returns total product count for this catalogue.

──────────────────────────────────────
  SECTION 12 — Database Helpers (lines 613–659)
──────────────────────────────────────
  Function: load_ocr_database()
    Reads entire Catalogue_OCR_Database.csv into a DataFrame.
    Not used during the main pipeline loop (append-only is used instead).

  Function: save_ocr_database(df)
    Writes entire DataFrame to CSV. Not used during main pipeline loop.

  Function: append_to_ocr_database(new_rows)
    Appends a list of product row dicts to Catalogue_OCR_Database.csv.
    Opens file in append mode — never loads the full CSV into memory.
    Writes header only if the file is new or empty.
    Encoding: utf-8-sig on first write (for Excel compatibility),
              utf-8 on subsequent appends.

  Function: load_tracking_csv()
    Reads catalogue_tracking.csv.
    Adds 'ocr_processed' column with empty string default if missing.
    Exits the process (sys.exit) if file not found.

  Function: save_tracking_csv(df)
    Writes the tracking DataFrame back to CSV without index column.

──────────────────────────────────────
  SECTION 13 — Main Function (lines 659–802)
──────────────────────────────────────
  Function: main()

  Two user-configurable variables at the top of main():

    process_n = "all"    (line ~664)
      Set to an integer (e.g. 5) to process only that many catalogues.
      Useful for testing.

    min_year = 2024      (line ~674)
      Only processes catalogues from this year onwards.
      NOTE: This value MUST match the MIN_YEAR constant in run_ocr_batched.py.

  Processing flow:
    1. Validates that both YOLO weight files exist.
    2. Loads tracking CSV, filters to downloaded=True rows.
    3. Applies year filter.
    4. Filters to rows where ocr_processed != 'Y'.
    5. Prints summary counts.
    6. Loads all 3 models (Model 1, Model 2, PaddleOCR) before the main loop.
    7. Iterates over unprocessed catalogues:
         a. Calls process_single_catalogue()
         b. Marks slug as 'Y' in tracking CSV and saves immediately after each
            catalogue completes (so progress survives a crash).
         c. Prints elapsed time and ETA to console.
         d. Calls gc.collect() after each catalogue.
    8. Prints final summary.

  if __name__ == "__main__" block (lines ~790–830):
    Prints startup diagnostics (YOLO device, file existence checks).
    Calls main() inside a try/except that catches SystemExit and all other
    exceptions, printing a FATAL ERROR traceback if something goes wrong.


================================================================================
  PART 2 — run_ocr_batched.py
================================================================================

────────────────────────────────────────────────────────────────────────────────
  NON-TECHNICAL SUMMARY
────────────────────────────────────────────────────────────────────────────────

What does this script do?
  This script is a wrapper that solves the memory crash problem in
  Catalogue_OCR_Processing.py. Instead of running the OCR script once for
  all 1,839 catalogues (which causes an out-of-memory crash after ~8–9), this
  wrapper runs small groups ("batches") of catalogues one group at a time.

  After each group finishes, all of the AI model memory is completely freed
  by the operating system before the next group begins. This allows the full
  set of ~1,839 catalogues to be processed without any memory crashes.

  You only need to start this one script and leave it running. It will keep
  going until every catalogue has been processed, printing progress and a
  time estimate as it goes.

How it controls what the OCR script processes:
  The wrapper works by temporarily editing the tracking spreadsheet before
  each batch. It marks every catalogue outside the current batch as "already
  done" so the OCR script skips them, and then puts them back to "not done"
  after the batch finishes. A safety backup of the spreadsheet is made before
  each edit.

If it crashes or is stopped:
  The restore step runs even if the subprocess crashes. If the wrapper
  itself is killed abruptly (e.g. power loss), run this recovery command:
    .venv\Scripts\python.exe -c "
    import pandas as pd
    df = pd.read_csv('catalogue_data/catalogue_tracking.csv.batch_backup')
    df.to_csv('catalogue_data/catalogue_tracking.csv', index=False)
    print('Restored from backup')
    "


────────────────────────────────────────────────────────────────────────────────
  TECHNICAL SUMMARY
────────────────────────────────────────────────────────────────────────────────

File:       run_ocr_batched.py
Total lines: ~200
Language:   Python 3.10

Key dependencies (standard library + pandas only — no AI libraries needed):
  - subprocess, shutil, sys, time  (standard library)
  - pandas
  - pathlib

──────────────────────────────────────
  SECTION 1 — Configuration (lines 26–40)
──────────────────────────────────────
  Two user-adjustable constants:

    BATCH_SIZE = 5
      Number of catalogues to process per subprocess invocation.
      Lower = more frequent memory resets, slightly more overhead per batch.
      Higher = less overhead but more memory used before reset.
      Recommended range: 3–10. Currently set to 5.

    MIN_YEAR = 2024
      MUST match the min_year variable inside Catalogue_OCR_Processing.py
      (currently line ~674 of that file). If these two values differ, the
      wrapper will incorrectly calculate which catalogues remain unprocessed
      and may produce wrong batch assignments.

  Path constants:
    PYTHON       = .venv/Scripts/python.exe
    OCR_SCRIPT   = Catalogue_OCR_Processing.py
    TRACKING_CSV = catalogue_data/catalogue_tracking.csv
    BACKUP_CSV   = catalogue_data/catalogue_tracking.csv.batch_backup

──────────────────────────────────────
  SECTION 2 — Helper Functions (lines 38–99)
──────────────────────────────────────
  Function: read_unprocessed(df)
    Mirrors the exact filtering logic of Catalogue_OCR_Processing.py main():
      - downloaded == True
      - year >= MIN_YEAR
      - ocr_processed != 'Y' (or is NaN/empty) or 'Temp_Y'
    Returns a filtered DataFrame of catalogues still needing OCR.
    Used by the main loop to decide what the next batch should be, and
    to determine when all work is done.

  Function: hide_non_batch(df, batch_slugs)
    Accepts the full tracking DataFrame and the list of slugs in the
    current batch. Temporarily sets ocr_processed = 'Temp_Y' for all
    unprocessed catalogues NOT in batch_slugs. This makes the OCR script
    "see" only the batch_slugs catalogues.
    Modifies df in-place and returns a list of slugs that were hidden
    (needed to restore them afterward).
    Does NOT write to disk — the caller writes the modified df.

  Function: restore_hidden(hide_slugs)
    Re-reads the tracking CSV from disk and sets ocr_processed = '' for
    all slugs in hide_slugs list. Writes the restored CSV back to disk.
    Called after every subprocess exits (whether successfully or not).
    Safe to call with an empty list (no-op).

──────────────────────────────────────
  SECTION 3 — Main Loop (lines 84–186)
──────────────────────────────────────
  Function: main()

  Startup validation (lines 85–103):
    Checks that .venv/Scripts/python.exe, Catalogue_OCR_Processing.py,
    and catalogue_data/catalogue_tracking.csv all exist before starting.
    Exits with a clear error message if any are missing.

  Main while-loop (lines 105–186):
    Runs indefinitely until read_unprocessed() returns an empty DataFrame.

    Each iteration:
      1. LOAD CSV fresh from disk to get current state.
      2. DETERMINE BATCH: take first BATCH_SIZE slugs from unprocessed list.
      3. PRINT batch summary: batch number, catalogue slugs, total remaining.
      4. PATCH CSV:
           - Call hide_non_batch() to mark all non-batch rows as 'Y'.
           - Copy original CSV to BACKUP_CSV (safety backup).
           - Write patched CSV to disk.
      5. RUN SUBPROCESS:
           subprocess.run([python.exe, Catalogue_OCR_Processing.py])
           This blocks until the OCR subprocess exits (success or crash).
           Handles KeyboardInterrupt by restoring CSV before exiting.
      6. RESTORE CSV:
           Call restore_hidden() to unmark hidden slugs.
           This runs regardless of whether the subprocess crashed.
      7. COUNT RESULTS:
           Re-read CSV and count how many batch slugs are now marked 'Y'.
      8. PRINT PROGRESS: catalogues done, elapsed time, ETA in hours.
      9. ANOMALY CHECK:
           If subprocess exit code is not 0 or 1, print a warning and
           ask the user to press Enter before continuing (prevents a
           crash-loop from running forever unattended).

  End of loop:
    Prints final completion summary with total catalogues processed
    and total elapsed time in minutes.

──────────────────────────────────────
  SECTION 4 — Entry Point (lines 189–191)
──────────────────────────────────────
  Standard if __name__ == "__main__": guard calls main().
  No startup diagnostics needed (all validation is in main()).


================================================================================
  HOW TO RUN
================================================================================

Normal operation (process all remaining catalogues):
  cd E:\Catalogue_Scraping_2025
  .\.venv\Scripts\python.exe .\run_ocr_batched.py

To change batch size (e.g. to 3 if memory is tighter):
  Edit run_ocr_batched.py line 27: BATCH_SIZE = 3

To change the year filter (e.g. include 2023):
  1. Edit run_ocr_batched.py  line 28: MIN_YEAR = 2023
  2. Edit Catalogue_OCR_Processing.py  line ~674: min_year = 2023
  Both values MUST match.

To run the OCR script directly (NOT recommended — will OOM crash):
  .\.venv\Scripts\python.exe .\Catalogue_OCR_Processing.py


================================================================================
  FILE AND FOLDER MAP
================================================================================

E:\Catalogue_Scraping_2025\
  Catalogue_OCR_Processing.py        Core OCR pipeline — DO NOT MODIFY lightly
  run_ocr_batched.py                 Batch wrapper — edit BATCH_SIZE / MIN_YEAR here
  weights_yolo\
    YOLO_Model_1_Full_Crop.pt        YOLO model for detecting product tiles on pages
    YOLO_Model_2_sub_crop.pt         YOLO model for detecting sub-regions in tiles
  catalogues\
    woolworths\2025\{slug}\          Page images for each catalogue (page_001.jpg etc.)
    coles\2025\{slug}\
    aldi\2025\{slug}\
    iga\2025\{slug}\
  catalogue_data\
    catalogue_tracking.csv           Master list of all catalogues + processing status
    catalogue_tracking.csv.batch_backup  Safety backup written before each batch patch
    Catalogue_OCR_Database.csv       Output — one row per detected product tile
    logs\
      ocr_pipeline_log_YYYYMMDD_HHMMSS.txt  One log file per OCR run


================================================================================
  KEY DATA COLUMNS — catalogue_tracking.csv
================================================================================

  slug          Unique identifier / folder name for each catalogue
                e.g. "weekly-woolworths-catalogue-december-3-9-2025-nsw"
  store         Retailer folder name (woolworths, coles, aldi, iga)
  year          Year as integer (2024, 2025, ...)
  downloaded    True/False — whether page images exist on disk
  ocr_processed 'Y' = processed, '' or NaN = not yet processed


================================================================================
  KEY DATA COLUMNS — Catalogue_OCR_Database.csv
================================================================================

  store, Retailer        Store identifier and display name
  title                  Full catalogue title as scraped
  slug                   Catalogue identifier (links back to tracking CSV)
  year, state            Calendar year and Australian state
  catalogue_on_sale_date Sale period start date
  page_number            Page within the catalogue (1-based)
  tile_number            Product tile number on that page (1-based)
  tile_confidence        YOLO confidence score for tile detection (0.0–1.0)
  tiles_on_page          Total tiles detected on this page
  Name                   Product name extracted by PaddleOCR
  Price_Now              Best extracted price (preferred result)
  Price_Raw              Price from regex on raw colour image
  Price_Spatial          Price from spatial big-dollar + superscript-cents layout
  Price_Black            Price from black-text-filtered image pass
  Save_amount            Promotional saving (e.g. "3.00" means "SAVE $3.00")
  PriceWas               Calculated: Price_Now + Save_amount
  UnitPrice              Unit price text (e.g. "$1.20 per 100g")
  ocr_processed_date     Timestamp when this row was created


================================================================================
  KNOWN ISSUES AND NOTES
================================================================================

1. MEMORY LEAK (resolved by run_ocr_batched.py)
   PaddleOCR 2.9.1 with paddlepaddle 2.6.2 leaks native C++ memory
   proportional to the number of OCR calls made. After ~8–9 medium-sized
   catalogues (~50 pages each at ~30 tiles per page × 3 PaddleOCR calls),
   the OS kills the process with no Python error output. The batch wrapper
   sidesteps this by restarting Python (and thus re-initialising all native
   libraries) every 5 catalogues.

2. NO GPU DETECTED
   torch.cuda.is_available() returns False on this machine despite installing
   the CUDA 11.8 build of PyTorch (torch 2.7.1+cu118). YOLO inference runs
   on CPU. This increases processing time significantly (~4–5 min per
   catalogue on CPU vs. ~30 sec on a mid-range GPU). If CUDA is later made
   available, no code changes are needed — YOLO_DEVICE will auto-detect.

3. YEAR FILTER SYNC
   MIN_YEAR in run_ocr_batched.py and min_year in Catalogue_OCR_Processing.py
   must always be set to the same value. If they differ, the batch wrapper
   will incorrectly judge which catalogues remain unprocessed.

4. CSV ENCODING
   Catalogue_OCR_Database.csv uses utf-8-sig encoding on the first write
   (BOM prefix for Excel compatibility) and plain utf-8 on subsequent
   appends. Do not re-open and re-save this file in Excel without confirming
   encoding is preserved.

5. APPEND-ONLY OUTPUT
   The OCR output CSV is never fully loaded into memory — rows are appended
   page-by-page. This means you can view partial results at any time, but
   also means there is no automatic deduplication. If a catalogue is
   accidentally processed twice (e.g. tracking CSV is manually edited),
   duplicate rows will appear in the output.

================================================================================
  END OF REPORT
================================================================================
