# discount-mate-de

Unified scraper entrypoint for ALDI, Coles, IGA, Woolworths, and an example template source.

## Usage

Load env in `.env`, then run:

```bash
uv run main.py --source aldi --runner products
uv run main.py --source coles --runner products
uv run main.py --source iga --runner products
uv run main.py --source ww --runner products
uv run main.py --source example --runner products
```

## Output Convention

Each run writes to:

```text
.output/<source>/<runner>/<run_id>/
```

Artifacts per run:

- `<source>_products_<run_id>.jsonl`
- `<source>_products_<run_id>.csv`
- `<source>_manifest_<run_id>.json`
- `<source>_run_<run_id>.log`

When `APP_DESTINATIONS` includes `gcs`, the same artifacts are uploaded using the same relative path under `GCS_PREFIX`.

## Structure

- `main.py`: CLI entrypoint and source/runner dispatch
- `config/`: env-backed settings, logging, and telemetry setup
- `storage/`: shared file serialization and destination uploads
- `scraper/<source>/*_scraper.py`: source-specific fetch and transform logic with a single `run()` entrypoint
- `util/`: shared runtime models and common helpers
- `scraper/example/`: template for new sources/runners
