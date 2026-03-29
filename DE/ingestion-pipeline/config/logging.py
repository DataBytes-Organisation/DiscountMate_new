from __future__ import annotations

import logging
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from collections.abc import MutableMapping
    from pathlib import Path
    from typing import Any


class ContextLogger(logging.LoggerAdapter):
    def __init__(
        self, logger: logging.Logger, source: str, runner: str, run_id: str
    ) -> None:
        super().__init__(logger, {"source": source, "runner": runner, "run_id": run_id})
        self.source = source
        self.runner = runner
        self.run_id = run_id

    def process(
        self,
        msg: Any,  # noqa: ANN401
        kwargs: MutableMapping[str, Any],  # noqa: ANN401
    ) -> tuple[Any, MutableMapping[str, Any]]:
        extra = kwargs.setdefault("extra", {})
        extra.setdefault("source", self.source)
        extra.setdefault("runner", self.runner)
        extra.setdefault("run_id", self.run_id)
        return msg, kwargs


class SafeExtraFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        for key in ("source", "runner", "run_id"):
            if not hasattr(record, key):
                setattr(record, key, "-")
        return super().format(record)


LOG_FORMAT = (
    "%(asctime)s %(levelname)s %(name)s [%(source)s:%(runner)s:%(run_id)s] %(message)s"
)


def configure_logging(level: str = "INFO", log_file_path: Path | None = None) -> None:
    formatter = SafeExtraFormatter(LOG_FORMAT)
    handlers: list[logging.Handler] = []

    stream_handler = logging.StreamHandler()
    stream_handler.setFormatter(formatter)
    handlers.append(stream_handler)

    if log_file_path is not None:
        log_file_path.parent.mkdir(parents=True, exist_ok=True)
        file_handler = logging.FileHandler(log_file_path, encoding="utf-8")
        file_handler.setFormatter(formatter)
        handlers.append(file_handler)

    root_logger = logging.getLogger()
    root_logger.handlers.clear()
    root_logger.setLevel(level.upper())
    for handler in handlers:
        root_logger.addHandler(handler)


def get_log_file_path(output_dir: Path, source: str, runner: str, run_id: str) -> Path:
    return output_dir / source / runner / run_id / f"{source}_run_{run_id}.log"


def build_logger(name: str, source: str, runner: str, run_id: str) -> ContextLogger:
    return ContextLogger(logging.getLogger(name), source, runner, run_id)
