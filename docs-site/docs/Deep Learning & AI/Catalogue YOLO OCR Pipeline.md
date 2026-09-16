---
title: "Catalogue YOLO + OCR Promotional Extraction Pipeline"
sidebar_label: "Catalogue YOLO + OCR Pipeline"
sidebar_position: 3
---

# Catalogue YOLO + OCR Promotional Extraction Pipeline

:::caution

While the full OCR extraction pipeline was successful, there was still difficulties in getting the multi-zone pricing extraction correct across all retailers and formats. On a supervised manual audit, approximately 30-40% of price records were incorrect either with incorrect decimal place format or incorrect order of digits. As such it is recommended that the stored 500,000 records be used only as an yes/no on sale Boolean event data source. 
Due to the large memory footprint, the catalogues themselves are not stored in any central location and the pipeline is designed for temp storage and immediate extraction and deletion. However, should any student wish to download the catalogues to their local work station they would just run the `catalogue_scraper_main.py` and select the stores or years they wish to download. 

```
cd Catalogue_scraping_2025
"catalogue_scraper_main.py"
```
![catalogue scraper](img\running_catalogue_scraper.png "catalogue scraper")

:::





This document describes the **catalogue OCR pipeline** — a two-stage YOLOv8 + PaddleOCR system that converts weekly supermarket catalogue PDFs into structured promotional records. To date this pipeline has processed over **3,000 catalogues** spanning ~5 years of Australian retailer data and extracted more than **500,000 promotional product records**, all of which now live in the discountmate GCP bucket at:

```
gs://discount-mate-data/OCR Historic Data Extraction/Catalogue_OCR_database.csv
```

The pipeline is broken into three stages each covered in detail below:

1. **YOLO training** — two custom-trained models, one for whole-page tile detection and one for sub-region detection within each cropped tile.
2. **OCR engine selection** — the benchmarking of Tesseract and PaddleOCR, including the spatial / zoned price parser experiments.
3. **The production pipeline** — how Catalogue_Scraping_2025/Catalogue_OCR_Processing.py ties YOLO + PaddleOCR + the catalogue tracking CSV together, and how it works in conjunction with the upstream scraper Catalogue_Scraping_2025/catalogue_scraper_main.py.

All earlier exploratory notebooks and Tesseract / hybrid experiments still live in the `experimental/` folder for reference.

---

## YOLO Training

The OCR pipeline depends on two custom YOLOv8 models that were trained locally on a GPU after annotation in **Roboflow**. Roboflow was used purely as the annotation platform. The labelled dataset was exported and training was performed on a local CUDA device using the `ultralytics` Python package. 

Roboflow projects are public be default. You can access the both annotation sets here:

- [Roboflow Model 1 Set](https://universe.roboflow.com/steven-cnmfv/discountmate-t3-2025)
- [Roboflow Model 2 Set](https://universe.roboflow.com/deakincapstonediscountmatecomputervision/model-2-post-crop-ocv-ocr)

![Roboflow Examples](img\roboflowsets.png "Roboflow Examples")

### Model 1 — Page → Tile detection

**Purpose.** Given a full catalogue page image, draw a bounding box around every individual product tile on that page. A "tile" is the visual block that contains one product's image, description, price, and any promotional copy. This is a **single-class** detector — every box has the label `product_tile`.

**Training data.** Approximately **300 catalogue pages** were annotated across multiple retailers (Coles, Woolworths, IGA, ALDI) to expose the model to the wide variety of grid layouts, multi-column inserts and edge cases that appear in real catalogues. One class label was applied per box.

**Training configuration.** A YOLOv8 nano base model was fine-tuned on the local 4 GB GPU at full page resolution:

```python
BASE_MODEL = "yolov8n.pt"
model = YOLO(BASE_MODEL)

base_model_results = model.train(
    data=str(DATA_YAML),
    imgsz=1280,          # page layouts are tall — default 640 loses tiles
    epochs=120,
    batch=2,             # CUDA OOM with batch=4 on a 4 GB GPU
    patience=20,         # early stop on val improvements
    device=0,            # GPU
    cache=False,         # important for low VRAM
    workers=2,
    project="model1_runs_dm",
    name="model1_page_to_tile",
    verbose=True,
)
```

The final weights are stored at `Catalogue_Scraping_2025/weights_yolo/YOLO_Model_1_Full_Crop.pt`. A separate Roboflow-hosted page detector, downloaded directly from roboflow, was also evaluated, but the locally-trained Model 1 produced cleaner tile crops on the catalogues and is the one used in the final production run.

![YOLO Model 1 Examples](img\yolomodel1_example.png "YOLO Examples")

### Model 2 — Tile → Sub-region detection

**Purpose.** Given a single cropped product tile produced by Model 1, locate up to five visual sub-regions:

| Class label | Meaning |
| --- | --- |
| `product_image_block` | The product image (skipped in OCR — passed straight through) |
| `description_block` | Product name / description text |
| `price_main` | The main "now" price (superscript style over multi zone ($super) X(main)·CC(super)) |
| `promo_text_block` | "Save $X" / "$X off" / Everyday special |
| `unit_price_block` | Per-kg / per-litre / per-100 g unit price text |

**Training data.** Around **300 cropped tiles**  were annotated in Roboflow with up to 4-5 labels per tile depending on what was visible.

**Training configuration.** The same nano backbone was used, but at the smaller 640 px input size appropriate for individual tile crops:

```python
BASE_MODEL = "yolov8n.pt"
model = YOLO(BASE_MODEL)

results = model.train(
    data=str(DATA_YAML),
    imgsz=640,
    epochs=120,
    batch=2,
    patience=20,
    device=0,
    cache=False,
    workers=2,
    project="runs_dm",
    name="model2_tiles_regions",
    verbose=True,
)
```

**Variant selection.** Four variants of Model 2 were trained as part of the experiment — combinations of YOLOv8n / YOLOv8s, with and without aggressive image augmentation, at slightly different epoch counts. mAP and per-class precision were broadly similar across the four runs, with **Model B** being selected as the production weights. There was a minor incompatibility in the image-augmentation pipeline of two of the alternate variants that caused issues when configuring them into the paddleOCR benchmark tests, which made Model B the simpler integration choice on otherwise comparable accuracy. The final weights live at `Catalogue_Scraping_2025/weights_yolo/YOLO_Model_2_sub_crop.pt`.

The sub region boxes were done in such a way so as to allow the OCR extraction to be directly associated to that region. Running global extraction over the entire tile could have unit price values being inserted into the actual price attribute. See some examples below. 

![YOLO Model 2 Examples](img\yolo2examples.png "YOLO 2 Examples")

### General training notes

- Both models were trained with CUDA on a local 4 GB GPU; this is why `batch=2` and `cache=False` were used throughout — anything more aggressive crashed with OOM.
- The Roboflow `data.yaml` export is the single source of truth for class mappings and train/val/test splits; the runtime pipeline reads class names back from the `.pt` weights via `model.names`, so renaming classes in Roboflow would require re-training, not just a config edit.
- Both `.pt` weight files are checked into the repo so the downstream OCR pipeline runs without re-downloading anything.

---

## OCR Engine Selection — Experimentation and Testing

Once Model 2 had given us labelled sub-region crops per tile, the next problem was extracting accurate text — particularly **prices**, which are almost always rendered with a stylised superscript layout:

```
big "2", small "$" superscript top-left, small "75" superscript top-right. 
See above screenshots for examples
```


All of the experiments described below  can be seen in the experimental/OCR Benchmarking Folder.

### Tesseract baseline

The first OCR model tried was **Tesseract** via `pytesseract`. The initial approach was as follows: convert the crop to grayscale, apply Otsu thresholding (converts image into binary black and white), run `image_to_string` with `--psm 6`. This worked acceptably for description text but failed badly on prices — Tesseract consistently had missing or incorrect outputs such `"275"`, `"2"` instead of `"2.75"`.

### Exhaustive Tesseract — multi-binary × multi-PSM

The next iteration tried to brute-force the problem by sweeping every plausible preprocessing × Tesseract configuration combination per crop:

- **Binary candidates** generated per crop: Otsu, Otsu-inverted, adaptive Gaussian, adaptive-inverted, CLAHE-enhanced Otsu, CLAHE-inverted, plus a custom "black text only" extraction that strips coloured circle backgrounds in HSV space.
- **PSM modes**: 3 (auto), 4 (column), 6 (block), 7 (single line), each with a `tessedit_char_whitelist` tuned per field (digits + `.$cC` for prices, full alphanumeric for descriptions).

This produced 30–40+ Tesseract calls per price crop and modestly improved description / promo accuracy, but price extraction was still unreliable — the underlying problem was that Tesseract simply could not handle the superscript multi-zone spatial layout no matter how the input was pre-processed.

### Zoned / connected-component price parser

To work around Tesseract's spatial blindness, a **custom price parser** was used that bypassed Tesseract's text-line logic entirely:

1. Threshold the crop into a binary image.
2. Run `cv2.connectedComponentsWithStats` to find every distinct blob.
3. Filter out noise (area below threshold), the circle border itself (blobs spanning >90% of the crop), and the dollar sign (leftmost blob, narrower than the digits).
4. Bucket the remaining blobs into "big" (≥55% of max height = dollars) and "small" (cents superscript).
5. OCR each blob individually with `--psm 10` (single-character mode), one digit at a time, with a digits-only whitelist.
6. Spatially filter small blobs to those positioned **top-right of the big digits** to discard the `ea` / `each` label which lives below the price.
7. Assemble `f"{dollar_digits}.{cents_digits}"` and validate the result is a plausible price.

This was a noticeable step up — the zoned parser correctly handled the superscript layout that defeated stock Tesseract, and is still kept as a fallback path in the production code. 

### PaddleOCR 

The final OCR method attempt looked at using **PaddleOCR**. PaddleOCR supports 80 languages and is built on CRNN(CNN + RNN) architecture. [Medium: PaddleOCR](https://medium.com/@danushidk507/paddleocr-439a8d92fb1a)

Four OCR techniques were attempted:

1. **Direct decimal** — if PaddleOCR returns `"$2.75"` or `"2.75"` as one detection, use it.
2. **Spatial superscript reconstruction** — group detections by height; tallest are dollar digits, shortest aligned top-right of the tallest blob are cents; assemble `dollars.cents`.
3. **Space-separated digits** — `"2 75"` → `"2.75"`.
4. **Pure digits with length heuristic** — `"275"` → `"2.75"`, `"100"` → `"1.00"`, etc.

Each strategy was tried against three image variants of every crop: the raw BGR image, a "dark text only" mask (HSV `v < 50`), and a more aggressive dark-text mask (`v < 60` or low-saturation `v < 100`). The highest-scoring result across all variant × strategy combinations is kept.

PaddleOCR became the **primary OCR engine** in production. Tesseract and the zoned parser remained available as fallbacks in some experiments but were eventually removed in the final pipeline due to the inference time required to process several OCR methods on 100s of thousands of crops. PaddleOCR appeared to perform ideally in benchmarking, however in some cases it still misses decimal points or confuses the order of the numbers.

**OCR Benchmarking Examples**
![OCR Benchmarking](img\paddlebenchmarking.png "OCR Examples")

### Known limitation —  price recognition

PaddleOCR significantly improved overall accuracy, however it does still result in errors.

Additional work in the image pre-processing or OCR fine tuning may be required to improve the accuracy of the price recognition. All other OCR extracted field appear to be correct the majority of time. 

- Fine-tune PaddleOCR's recognition head on a small, labelled dataset of cropped price regions (to do this manually crop several `price_main`crops). See here for more details [Finetuning PaddleOCR](https://anushsom.medium.com/finetuning-paddleocrs-recognition-model-for-dummies-by-a-dummy-89ac7d7edcf6)



### Practical implications — pricing analysis vs price prediction

Given the price accuracy on certain retailers and crops is imperfect, the OCR-derived `Price_Now` column should **not** be treated as ground truth for absolute price-prediction modelling. However, the dataset still has very high value when positioned from the following perspective:

- **Boolean "was on sale" signal.** The mere *presence* of a product in a given week's catalogue means the retailer flagged it as a promotion that week. With ~5 years of historic data this gives a rich event stream for time-series yes/no on sale classification and prediction.
- **Sale-frequency / cadence analysis.** Counting how often a product (or category) appears in catalogues over time enables modelling of *when* an item will next go on sale, independent of *what* the discounted price will be which is a much more achievable target than absolute-price regression on noisy OCR numeric price_now output.

Some data processing work is required to convert the current row-per-promotion CSV into the implied **boolean weekly matrix**. The OCR rows give the `1`s (on sale events) naturally via a products presence; the `0`s have to be back-filled by assuming any product not present in a given week's catalogue was not on sale that week. Because catalogue OCR descriptions are free-text and there are **no barcodes** in the source data, joining these rows to the live product catalogue will need a fuzzy / semantic match or most cleanly a sentence-transformer embedding of the `Name` column compared against the live MongoDB / Postgres product names.

Importantly, since the recent scraper rebuild we now also have a **clean ongoing data feed** of more than 10 weeks of catalogues from 2026 onwards. Going forward this scraped feed is the default data source for model training, and the historic OCR dataset is best viewed as a **backup data stream** that complements the current web scrape when needed.

---

## 3. The Production Pipeline

The production pipeline is two cooperating scripts: an upstream **scraper** that downloads catalogue images and maintains a tracking CSV, and a downstream **OCR processor** that walks unprocessed catalogues and writes structured rows to the OCR database. A **batch processor** was later implemented to prevent out of memory errors.  Neither of these scripts is currently scheduled / automated — both are run manually. Given that web scraping is now the correct method, there was no additional work implementing automation for OCR processing going forward. The overall schematic below identifies at which points additional consideration for automation and storage is required.

### Upstream — catalogue_scraper_main.py

This is the script that puts the page images on disk in the first place. It was developed as a separate piece of work last semester and is the upstream dependency of the OCR pipeline. At a high level it:

- Hits the publicly-listed catalogue feeds for the configured Australian retailers (Coles, Woolworths, IGA, ALDI, Foodland, Drakes, etc.) and discovers what catalogues are currently advertised.
- Parses the catalogue **slug / title** into a structured `catalogue_on_sale_date` (handled by `CatalogueDateParser`) so each catalogue carries a real date, not just a filename.
- Downloads every page of each catalogue as a JPEG into a versioned folder tree under `Catalogue_Scraping_2025/catalogues/<store>/<year>/<slug>/page_*.jpg`.
- Maintains `Catalogue_Scraping_2025/catalogue_data/catalogue_tracking.csv` as the **state machine** of what has been seen, downloaded, and (later) OCR-processed. Helper classes inside the script include `BackupManager` (full backup before a refresh), `CatalogueDatabase` (the tracking CSV), `CatalogueMetadataTracker` (per-catalogue metadata enrichment), and `CatalogueDownloader` (the actual HTTP fetch + retry layer).
- Supports an **update mode** that only downloads catalogues not already in the tracking CSV, and a **custom mode** that writes into a dated sub-folder for ad-hoc snapshots.

The OCR pipeline never talks to the retailer websites directly — it consumes only what this scraper has already landed on disk plus the tracking CSV's metadata columns. However, a small modification could allow for each page to be downloaded and then the OCR module could be triggered, storing the price and then subsequently removing the page from temp storage. Alternatively as the below schematic shows the catalogues could be downloaded processed and then deleted in full.

### Downstream — Catalogue_Scraping_2025/Catalogue_OCR_Processing.py

This is the **main production OCR script**. It is deliberately memory-cautious and resumable — it can be killed and restarted without losing progress because state is tracked in the tracking CSV.

**Output schema** (one row per detected product tile):

```
store, Retailer, title, slug, year, state,
catalogue_on_sale_date, scraped_date, page_count, catalogue_id,
page_number, tile_number, tile_confidence, tiles_on_page,
Name, Price_Now, Price_Raw, Price_Spatial, Price_Black,
Save_amount, PriceWas, UnitPrice, ocr_processed_date
```

**Configuration settings at the top of `main()`:**

- `process_n` — number of catalogues to process this run (`"all"` for unlimited; integer for testing).
- `min_year` — skip catalogues older than this. Useful for re-running only the recent batch without re-scoring 5 years of history.

#### Batched runner — (Catalogue_Scraping_2025/run_ocr_batched.py)

Even with the aggressive in-process memory hygiene described above, PaddleOCR and YOLO accumulate **native C++ allocations** that the Python garbage collector cannot reclaim. In practice this caused a hard OOM crash after roughly 8–9 catalogues when `Catalogue_OCR_Processing.py` was invoked directly as a long-running process. The fix is the small wrapper script `(Catalogue_Scraping_2025/run_ocr_batched.py)`, which is the **recommended way to run a full backfill** on a memory-constrained machine.

How it works:

- It reads `catalogue_tracking.csv` and selects the next `BATCH_SIZE` (default 5) unprocessed catalogues that match the same `MIN_YEAR` filter as the OCR script.
- It then **temporarily** marks every other unprocessed catalogue with the sentinel `ocr_processed = "Temp_Y"` so the OCR subprocess only sees the current batch's slugs.
- It launches `Catalogue_OCR_Processing.py` as a **fresh subprocess** (`subprocess.run`) so that when the subprocess exits, the OS reclaims **all** of PaddleOCR's and YOLO's native memory — not just the Python objects.
- When the subprocess returns, the wrapper restores any `Temp_Y` rows back to unprocessed (`""`) and loops to the next batch.
- The loop exits cleanly once no unprocessed rows remain.

Because each batch runs in its own process, peak memory is bounded by the size of one batch rather than by the entire backlog, and a crash in any single batch only loses the work for that batch — the tracking CSV is updated incrementally so the next run picks up where the previous one left off. `BATCH_SIZE` and `MIN_YEAR` at the top of the wrapper must match the `min_year` setting inside `Catalogue_OCR_Processing.py`.

**High-level flow Schematic:**

![OCR Pipeline](img\ocr_pipeline.png "OCR Pipeline")

### 3.3 Output dataset

After roughly 3,000 catalogues had been processed end-to-end, the resulting `Catalogue_OCR_Database.csv` (~500,000 product rows) was uploaded to:

```
gs://discount-mate-data/OCR Historic Data Extraction/Catalogue_OCR_database.csv
```

![OCR GCP](img\ocr_gcp.png "OCR GCP")

### 3.4 Status, automation gaps, and recommended next steps

Both the scraper (`catalogue_scraper_main.py`) and the OCR pipeline (`Catalogue_OCR_Processing.py` + `run_ocr_batched.py`) are currently **run manually**. There is no scheduled job, no Cloud Function, no container that runs on a cron. Discuss with academic mentor and team leaders before continuing on with this feature. It is my opinion that web scraping should be the default method of data scraping for this project considering that even if OCR was precise, the catalogues generally only contain 200-300 products on special in any given week, while recent full web scrapes indicate that on any given week there can be upward of 4,000 products on special. 

#### Further work and considerations

1. Schedule Cloud Run automations for the catalogue download and downstream batched OCR processor to extract ongoing weekly catalogue data. **Do this only if existing web scraping methods become compromised**
2.  Fine-tune PaddleOCR to improve pricing based recognition. 
3. Build the back-filled on special table. Use  a sentence-transformer-based fuzzy join between catalogue `Name` strings and current live product products in our GCP collection. This may assist in 'on sale event' prediction modelling.
4. **Cloud-side storage.** Move the OCR output from a flat CSV on GCS to a queryable Postgres table within GCP.

---


