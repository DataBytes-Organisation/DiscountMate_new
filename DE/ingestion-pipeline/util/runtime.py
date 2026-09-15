from __future__ import annotations

import time
from typing import TYPE_CHECKING, Any

from pydantic import BaseModel, ConfigDict, Field

from .common import emit_scrape_block, emit_scrape_run_failed, emit_scrape_summary

if TYPE_CHECKING:
    from opentelemetry.trace import Tracer

    from config.logging import ContextLogger
    from config.settings import Settings


class RunResult(BaseModel):
    records: list[dict[str, Any]] = Field(
        description="Normalized records produced by a scraper run."
    )
    metadata: dict[str, Any] = Field(
        default_factory=dict,
        description="Supplementary metadata emitted alongside scraper records.",
    )


class RunStats(BaseModel):
    """Mutable per-run statistics collected as a scraper executes.

    Not frozen: this is the one piece of RunContext meant to be updated
    in place as the run progresses, so scrapers don't need their own
    local counters or extra exception-handling layers just to track them.
    """

    model_config = ConfigDict(frozen=False)

    start_time: float = Field(default_factory=time.monotonic)
    http_200: int = 0
    http_403: int = 0
    http_429: int = 0
    http_5xx: int = 0
    retries: int = 0
    block_detected: bool = False

    def record_status(self, status: str, source: str) -> None:
        """Update counts from a scraper's request-status string and emit
        a scrape_block event immediately if this status indicates a block.
        """
        if status in ("SUCCESS", "SUCCESS_SCRAPERAPI"):
            self.http_200 += 1
        elif status == "RATE_LIMITED_429":
            self.http_429 += 1
        elif status in ("BLOCKED_403", "SCRAPERAPI_CREDITS_EXHAUSTED"):
            self.http_403 += 1
            self.block_detected = True
            reason = (
                "http_403_blocked"
                if status == "BLOCKED_403"
                else "scraperapi_credits_exhausted"
            )
            emit_scrape_block(source, reason)
        elif status.startswith("HTTP_5") or status.startswith("SCRAPERAPI_HTTP_5"):
            self.http_5xx += 1

    def http_counts(self) -> dict[str, int]:
        return {
            "http_200": self.http_200,
            "http_403": self.http_403,
            "http_429": self.http_429,
            "http_5xx": self.http_5xx,
        }

    def duration_s(self) -> float:
        return time.monotonic() - self.start_time

    def emit_success(self, source: str, run_id: str, rows_scraped: int) -> None:
        emit_scrape_summary(
            source=source,
            run_id=run_id,
            status="success",
            rows_scraped=rows_scraped,
            duration_s=self.duration_s(),
            http_counts=self.http_counts(),
            retries=self.retries,
            block_detected=self.block_detected,
        )

    def emit_failure(self, source: str, run_id: str, rows_scraped: int) -> None:
        emit_scrape_run_failed(source)
        emit_scrape_summary(
            source=source,
            run_id=run_id,
            status="failed",
            rows_scraped=rows_scraped,
            duration_s=self.duration_s(),
            http_counts=self.http_counts(),
            retries=self.retries,
            block_detected=self.block_detected,
        )


class RunContext(BaseModel):
    model_config = ConfigDict(frozen=True, arbitrary_types_allowed=True)

    source: str = Field(description="Scraper source identifier, for example 'coles'.")
    runner: str = Field(description="Runner identifier within the scraper source.")
    run_id: str = Field(
        description="Unique run identifier for the current scraper execution."
    )
    settings: Settings = Field(description="Loaded application settings.")
    logger: ContextLogger = Field(
        description="Context-aware logger for the active run."
    )
    tracer: Tracer = Field(description="OpenTelemetry tracer for the active run.")
    stats: RunStats = Field(
        default_factory=RunStats,
        description="Mutable per-run monitoring statistics (see RunStats).",
    )


def _rebuild_run_context_model() -> None:
    from opentelemetry.trace import Tracer

    from config.logging import ContextLogger
    from config.settings import Settings

    RunContext.model_rebuild(
        _types_namespace={
            "Settings": Settings,
            "ContextLogger": ContextLogger,
            "Tracer": Tracer,
        }
    )


_rebuild_run_context_model()