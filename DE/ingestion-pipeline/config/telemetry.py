from __future__ import annotations

from typing import TYPE_CHECKING

from opentelemetry import trace as otel_trace
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import (
    BatchSpanProcessor,
    ConsoleSpanExporter,
    SimpleSpanProcessor,
)

if TYPE_CHECKING:
    import logging

    from opentelemetry.trace import Tracer

    from .settings import TelemetrySettings


def _parse_otlp_headers(raw_headers: str) -> dict[str, str] | None:
    if not raw_headers:
        return None

    headers: dict[str, str] = {}
    for header in raw_headers.split(","):
        item = header.strip()
        if not item:
            continue
        key, separator, value = item.partition("=")
        if not separator:
            raise ValueError(
                "OTEL_EXPORTER_OTLP_HEADERS must be comma-separated key=value pairs"
            )
        headers[key.strip()] = value.strip()
    return headers or None


def configure_telemetry(
    settings: TelemetrySettings, logger: logging.LoggerAdapter
) -> None:
    if not settings.enabled:
        logger.info("OpenTelemetry disabled via env")
        return

    resource = Resource.create({"service.name": settings.service_name})
    provider = TracerProvider(resource=resource)

    if (
        settings.otlp_endpoint
        and OTLPSpanExporter is not None
        and BatchSpanProcessor is not None
    ):
        exporter = OTLPSpanExporter(
            endpoint=settings.otlp_endpoint,
            headers=_parse_otlp_headers(settings.otlp_headers),
        )
        provider.add_span_processor(BatchSpanProcessor(exporter))
        logger.info("OpenTelemetry OTLP exporter configured")
    else:
        provider.add_span_processor(SimpleSpanProcessor(ConsoleSpanExporter()))
        logger.info("OpenTelemetry console exporter configured by default")

    otel_trace.set_tracer_provider(provider)


def get_tracer(name: str) -> Tracer:
    return otel_trace.get_tracer(name)
