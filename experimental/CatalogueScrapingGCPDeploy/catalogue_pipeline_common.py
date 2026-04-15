from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional


def utc_now_iso() -> str:
    return datetime.utcnow().replace(microsecond=0).isoformat() + "Z"


@dataclass
class FailureDetail:
    stage_name: str
    catalogue_id: Optional[str]
    error_type: str
    message: str
    traceback_summary: str
    local_path: str = ""
    gcs_path: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class CatalogueStageOutcome:
    stage_name: str
    catalogue_id: str
    status: str
    rows_produced: int = 0
    files_produced: int = 0
    elapsed_seconds: float = 0.0
    local_path: str = ""
    gcs_path: str = ""
    details: Dict[str, Any] = field(default_factory=dict)
    failure: Optional[FailureDetail] = None

    def to_dict(self) -> Dict[str, Any]:
        payload = asdict(self)
        if self.failure is not None:
            payload["failure"] = self.failure.to_dict()
        return payload


@dataclass
class StageResult:
    stage_name: str
    started_at: str
    ended_at: str
    attempted_catalogues: List[str] = field(default_factory=list)
    succeeded_catalogues: List[str] = field(default_factory=list)
    skipped_catalogues: List[str] = field(default_factory=list)
    failed_catalogues: List[str] = field(default_factory=list)
    rows_produced: int = 0
    files_produced: int = 0
    elapsed_seconds: float = 0.0
    failure_details: List[FailureDetail] = field(default_factory=list)
    catalogue_results: List[CatalogueStageOutcome] = field(default_factory=list)
    log_file: str = ""

    def add_catalogue_result(self, outcome: CatalogueStageOutcome) -> None:
        self.attempted_catalogues.append(outcome.catalogue_id)
        if outcome.status == "success":
            self.succeeded_catalogues.append(outcome.catalogue_id)
        elif outcome.status == "skipped":
            self.skipped_catalogues.append(outcome.catalogue_id)
        else:
            self.failed_catalogues.append(outcome.catalogue_id)
        self.rows_produced += outcome.rows_produced
        self.files_produced += outcome.files_produced
        self.catalogue_results.append(outcome)
        if outcome.failure is not None:
            self.failure_details.append(outcome.failure)

    def to_dict(self) -> Dict[str, Any]:
        payload = asdict(self)
        payload["failure_details"] = [item.to_dict() for item in self.failure_details]
        payload["catalogue_results"] = [item.to_dict() for item in self.catalogue_results]
        return payload


@dataclass
class CatalogueWorkItem:
    store: str
    year: str
    slug: str
    local_path: Path
    gcs_prefix: str
    metadata: Dict[str, Any] = field(default_factory=dict)
    source: str = "existing"

    @property
    def catalogue_id(self) -> str:
        return f"{self.store}/{self.year}/{self.slug}"

    def to_dict(self) -> Dict[str, Any]:
        payload = asdict(self)
        payload["local_path"] = str(self.local_path)
        payload["catalogue_id"] = self.catalogue_id
        return payload


@dataclass
class IncrementalDecision:
    catalogue_id: str
    status: str
    reason: str
    starting_stage: Optional[int]
    local_path: str
    gcs_prefix: str
    source: str
    remote_exists: bool
    has_pages: bool
    has_detections: bool
    has_zone_detections: bool
    has_ocr_results: bool
    synced_from_gcs: bool = False

    def to_row(self) -> Dict[str, Any]:
        return asdict(self)


def make_stage_result(stage_name: str, log_file: Optional[Path] = None) -> StageResult:
    started_at = utc_now_iso()
    return StageResult(
        stage_name=stage_name,
        started_at=started_at,
        ended_at=started_at,
        log_file=str(log_file) if log_file else "",
    )


def finish_stage_result(result: StageResult) -> StageResult:
    result.ended_at = utc_now_iso()
    started = datetime.fromisoformat(result.started_at.replace("Z", "+00:00"))
    ended = datetime.fromisoformat(result.ended_at.replace("Z", "+00:00"))
    result.elapsed_seconds = max((ended - started).total_seconds(), 0.0)
    return result
