from __future__ import annotations

import csv
import json
from pathlib import Path

from storage.models import MaterializedArtifacts


def _fieldnames(records: list[dict[str, object]]) -> list[str]:
    ordered: list[str] = []
    seen: set[str] = set()
    for record in records:
        for key in record:
            if key not in seen:
                seen.add(key)
                ordered.append(key)
    return ordered


class LocalStorage:
    def __init__(self, output_root: Path) -> None:
        self.output_root = output_root

    def materialize(
        self,
        source: str,
        runner: str,
        run_id: str,
        records: list[dict[str, object]],
        metadata: dict[str, object],
    ) -> MaterializedArtifacts:
        run_dir = self.output_root / source / runner / run_id
        run_dir.mkdir(parents=True, exist_ok=True)

        jsonl_path = run_dir / f"{source}_products_{run_id}.jsonl"
        csv_path = run_dir / f"{source}_products_{run_id}.csv"
        manifest_path = run_dir / f"{source}_manifest_{run_id}.json"

        with jsonl_path.open("w", encoding="utf-8") as handle:
            for record in records:
                handle.write(json.dumps(record, ensure_ascii=False))
                handle.write("\n")

        fieldnames = _fieldnames(records)
        with csv_path.open("w", encoding="utf-8", newline="") as handle:
            writer = csv.DictWriter(
                handle, fieldnames=fieldnames, extrasaction="ignore"
            )
            writer.writeheader()
            for record in records:
                writer.writerow(record)

        manifest = {
            "source": source,
            "runner": runner,
            "run_id": run_id,
            "record_count": len(records),
            "files": {
                "jsonl": str(jsonl_path.relative_to(self.output_root)),
                "csv": str(csv_path.relative_to(self.output_root)),
                "manifest": str(manifest_path.relative_to(self.output_root)),
            },
            **metadata,
        }

        with manifest_path.open("w", encoding="utf-8") as handle:
            json.dump(manifest, handle, ensure_ascii=False, indent=2)
            handle.write("\n")

        return MaterializedArtifacts(
            run_dir=run_dir,
            jsonl_path=jsonl_path,
            csv_path=csv_path,
            manifest_path=manifest_path,
            manifest=manifest,
        )
