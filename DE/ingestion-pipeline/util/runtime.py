from __future__ import annotations

from typing import TYPE_CHECKING, Any

from pydantic import BaseModel, ConfigDict, Field

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
