# DE-04-T1: Research and Plan for Data Pipeline Monitoring Options

**Status:** Complete
**Owners:** Izzy, Sophie

## Problem Statement

Pipeline failures (scrapers or ETL jobs) currently go unnoticed unless manually checked.
This creates risk of stale or missing data reaching downstream systems (Silver/Gold layers,
App Dev, Data Analytics, ML). The most critical and easily-missed failure mode is a job that
**exits successfully but produces zero or near-zero usable rows** — a crashed scraper logs
nothing, and a soft-blocked scraper returns HTTP 200 with no real data, so naive
success/failure checks miss both cases entirely.

This document evaluates monitoring/alerting options for the Bronze-layer scraping pipeline
and recommends an approach for DE-04-T2 to implement.

## Options Considered

### Option 1: GCP-native (Cloud Logging + Cloud Monitoring)

**Description:** Emit structured JSON logs from Python scrapers, convert to Cloud Logging
log-based metrics, and alert via Cloud Monitoring alert policies routed to Slack.

**Pros:**

- Zero additional infrastructure — Cloud Run is automatically integrated with Cloud
  Monitoring with no setup required; built-in metrics (`completed_task_attempt_count`,
  `completed_execution_count`) are available immediately.
- No new paid tooling; fits within existing GCP project and budget.
- Structured JSON written to stdout/stderr is automatically parsed into `jsonPayload`
  fields by Cloud Logging — no logging API integration needed in scraper code.
- Terraform-manageable end to end (`google_logging_metric`,
  `google_monitoring_alert_policy`, `google_monitoring_notification_channel`), matching
  DE's existing IaC pattern for all other GCP resources.
- Native Slack notification channel support via the Google Cloud Monitoring Slack app.

**Cons:**

- Alert policy configuration (especially "missing data as breach" for the zero-rows case)
  has non-obvious pitfalls — e.g. the `evaluationMissingData` setting is silently ignored
  if the retest window (`duration`) is left at zero.
- Log-based metrics have ingestion latency; rolling windows need to be ≥10 minutes to
  reliably capture multiple matching log entries.
- Native Slack formatting is described by Google as "subject to change" if richer message
  formatting is needed later (mitigated by staying on the native channel for now, upgrading
  to a webhook/Pub/Sub relay only if needed).

**Estimated effort:** 1–2 students, 1–2 weeks. No new tooling to procure or learn beyond
what the team already uses (Terraform, GCP).

### Option 2: Prometheus + Grafana

**Description:** Self-hosted or managed Prometheus for metrics collection, Grafana for
dashboards and alerting.

**Pros:**

- Rich dashboarding and query flexibility (PromQL).
- Well-suited to long-running services with continuous metric scraping.
- Industry-standard for teams already running Kubernetes/GKE.

**Cons:**

- Overhead mismatch: our scrapers are short-lived batch jobs (Cloud Run Jobs), not
  long-running services — Prometheus's pull-based scraping model doesn't map cleanly
  onto job-based execution.
- Requires standing up and maintaining additional infrastructure (Prometheus server,
  Grafana instance, possibly Alertmanager) — meaningful additional operational surface
  for a capstone team to own and hand off.
- Duplicates capability GCP already provides natively for Cloud Run workloads, at higher
  setup and maintenance cost.
- Previously deprioritised in project stack decisions for this reason (see project tooling
  notes).

**Estimated effort:** Higher — infrastructure setup alone likely exceeds the time budget
for T2, before any scraper-specific detection logic is built.

### Option 3: Third-party APM / monitoring SaaS (e.g. Datadog, New Relic)

**Description:** Commercial application performance monitoring platform with built-in
alerting, dashboards, and integrations.

**Pros:**

- Mature alerting UX, broad integration ecosystem.
- Less manual configuration for common failure patterns.

**Cons:**

- Introduces a paid dependency outside the current GCP-only budget and tooling
  footprint.
- Adds a third-party credential/access-management burden for a student team with
  limited ongoing maintenance capacity.
- No clear advantage over GCP-native for this scope, since Cloud Run integration with
  Cloud Monitoring is already free and automatic.

**Estimated effort:** Not pursued further given cost and scope mismatch.

## Recommendation

**GCP-native stack (Cloud Logging + Cloud Monitoring + Terraform + Slack).**

This is the only option requiring no new infrastructure or paid tooling, integrates
automatically with the Cloud Run Jobs the scrapers already run on, and is fully
Terraform-manageable — consistent with how the rest of DE's GCP resources
(Cloud Storage, PostgreSQL) are already managed.

Critically, this approach is the only one evaluated that can be configured to catch the
highest-priority failure mode: **a scraper that exits successfully but writes zero rows**,
by treating missing metric data as a policy violation rather than relying on exit codes
alone.

## Scope Boundary

This document covers **option selection only**. Full technical design — log schema,
specific log-based metrics, alert policy definitions, Terraform resources, and a
day-by-day implementation plan — is covered separately for DE-04-T2 (see
`DE/DE-04-T2-implementation-plan.md`).

## Next Steps

Proceed to DE-04-T2 implementation using the GCP-native approach. Reference the
existing implementation plan for the detailed log contract, metric definitions, and the
three-alert-policy design (job failure, zero/near-zero rows, HTTP error-rate spike).
