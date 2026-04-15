"""
HTTP wrapper for the catalogue scraping pipeline.

Cloud Run Services require a process that listens on $PORT (default 8080).
This server exposes two endpoints and delegates to the pipeline module.

Endpoints:
  GET  /health  — liveness / readiness probe used by Cloud Run health checks
  POST /run     — trigger the full 4-stage pipeline; blocks until complete;
                  returns a JSON summary with status and exit_code

A threading lock prevents concurrent pipeline executions on the same instance.
Cloud Run is configured with --concurrency=1 and --max-instances=1 so only
one request runs at a time, but the lock is a belt-and-suspenders safeguard.

Cloud Run Service timeout is capped at 3600 seconds (60 min).
For a weekly incremental run (new catalogues only), this is typically sufficient.
If a full-archive reprocess is needed, use --limit-catalogues to split the work.
"""

from __future__ import annotations

import json
import logging
import os
import sys
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer

PORT = int(os.environ.get("PORT", 8080))

_pipeline_lock = threading.Lock()

logging.basicConfig(
    stream=sys.stdout,
    level=logging.INFO,
    format="%(message)s",
)
log = logging.getLogger("pipeline_server")


def _run_pipeline() -> dict:
    """Import and run the pipeline inside this process, returns a result dict."""
    import catalogue_scraper_main as main_mod

    args = main_mod.parse_args(["--pipeline-mode", "pipeline"])
    config = main_mod.resolve_config(args)
    exit_code = main_mod.run_pipeline(config)
    return {
        "status": "success" if exit_code == 0 else "failed",
        "exit_code": exit_code,
    }


class _Handler(BaseHTTPRequestHandler):

    def do_GET(self) -> None:
        if self.path == "/health":
            self._respond(200, {"status": "ok"})
        else:
            self._respond(404, {"error": "not found"})

    def do_POST(self) -> None:
        if self.path != "/run":
            self._respond(404, {"error": "not found"})
            return

        if not _pipeline_lock.acquire(blocking=False):
            self._respond(409, {"error": "pipeline already running — try again later"})
            return

        log.info(json.dumps({"event": "pipeline_trigger", "source": "http"}, sort_keys=True))
        try:
            result = _run_pipeline()
        except Exception as exc:
            log.exception("pipeline raised an unexpected exception")
            result = {"status": "error", "error": str(exc), "exit_code": 1}
        finally:
            _pipeline_lock.release()

        http_status = 200 if result.get("exit_code", 1) == 0 else 500
        self._respond(http_status, result)

    def _respond(self, code: int, body: dict) -> None:
        payload = json.dumps(body).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def log_message(self, fmt: str, *args) -> None:
        # Suppress the default per-request access log — pipeline already emits
        # structured JSON logs to stdout which Cloud Logging picks up.
        pass


if __name__ == "__main__":
    log.info("Catalogue scraper HTTP server listening on port %d", PORT)
    server = HTTPServer(("0.0.0.0", PORT), _Handler)
    server.serve_forever()
