from __future__ import annotations

from typing import TYPE_CHECKING

from pydantic import BaseModel, ConfigDict, Field

if TYPE_CHECKING:
    from pathlib import Path


class MaterializedArtifacts(BaseModel):
    model_config = ConfigDict(frozen=True)

    run_dir: Path = Field(
        description="Output directory containing the materialized run artifacts."
    )
    jsonl_path: Path = Field(description="Path to the materialized JSONL artifact.")
    csv_path: Path = Field(description="Path to the materialized CSV artifact.")
    manifest_path: Path = Field(description="Path to the manifest JSON artifact.")
    manifest: dict[str, object] = Field(
        description="Manifest payload describing the materialized artifacts."
    )
    uploaded_uris: list[str] = Field(
        default_factory=list,
        description="Remote URIs where artifacts were uploaded.",
    )


def _rebuild_materialized_artifacts_model() -> None:
    from pathlib import Path

    MaterializedArtifacts.model_rebuild(_types_namespace={"Path": Path})


_rebuild_materialized_artifacts_model()
