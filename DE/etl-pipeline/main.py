from __future__ import annotations

from common.cli import parse_args
from config import load_runtime_config, load_settings
from features.products.run import run as run_products


def main() -> int:
    args = parse_args()
    settings = load_settings()
    runtime_config = load_runtime_config(args.config)

    if args.runner != "products":
        raise ValueError("Phase 1 supports only runner='products'.")

    if args.source not in runtime_config.sources:
        raise ValueError(f"Unsupported source '{args.source}'.")

    summary = run_products(
        source=args.source,
        runner=args.runner,
        run_date=args.date,
        runtime_config=runtime_config,
        settings=settings,
    )

    print("Pipeline completed successfully")
    print(f"source={args.source}")
    print(f"runner={args.runner}")
    print(f"date={args.date}")
    print(f"input_file={summary['input_file']}")
    for key, value in summary["counts"].items():
        print(f"{key}_rows={value}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
