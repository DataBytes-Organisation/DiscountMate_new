from __future__ import annotations

from util import RunContext, RunResult, utc_timestamp


def run(context: RunContext) -> RunResult:
    with context.tracer.start_as_current_span("example.products"):
        context.logger.info("Running example scraper template")
        return RunResult(
            records=[
                {
                    "source": "example",
                    "name": "Template Product",
                    "price": 0,
                    "scraped_at": utc_timestamp(),
                    "notes": "Replace this runner with source-specific fetch and extraction logic.",
                }
            ],
            metadata={"record_count": 1, "template": True},
        )
