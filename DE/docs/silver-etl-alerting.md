# Silver ETL alerting

## Purpose

The Silver ETL pipelines transform retailer Bronze files into PostgreSQL tables
in the `silver` schema. Each product workflow emits one structured JSON outcome
event so Google Cloud Logging and Cloud Monitoring can detect technical and
logical failures.

The initial notification recipient is `supportdiscountmate@gmail.com`. Google
Cloud Monitoring sends email directly; it does not need the Gmail password, an
app password, SMTP configuration, or Gmail API access.

## Deployment boundary

This repository change defines the application events and the monitoring
resources. It does not deploy the four Silver Cloud Run Jobs. The notification
channel and policies appear in GCP only after an authorised operator applies the
production Terraform configuration.

The Silver jobs and alerts use `australia-southeast2`. This is intentionally
separate from the existing default production region so unrelated resources are
not moved or replaced.

## Monitored workflows

| Model | Expected Cloud Run Job | Region |
|---|---|---|
| `products_aldi` | `discount-mate-etl-products-aldi` | `australia-southeast2` |
| `products_coles` | `discount-mate-etl-products-coles` | `australia-southeast2` |
| `products_iga` | `discount-mate-etl-products-iga` | `australia-southeast2` |
| `products_woolworths` | `discount-mate-etl-products-woolworths` | `australia-southeast2` |

These names are the contract for the separate Silver Cloud Run deployment
task. Alert policies can be provisioned before the jobs, but end-to-end testing
requires the deployed names to match this table exactly.

## Outcome events

Product workflows write one of the following events:

| Event and status | Meaning | Exit behavior |
|---|---|---|
| `etl_run_finished` / `succeeded` | Bronze input was processed and produced normalized rows. | Existing success exit |
| `etl_run_finished` / `empty_input` | No Bronze files or raw rows were available. | Existing success exit |
| `etl_run_finished` / `empty_output` | Bronze rows were loaded but normalization produced no rows. | Existing success exit |
| `etl_run_failed` / `failed` | The ETL raised an exception. | Original exception is re-raised |

`empty_input` and `empty_output` are monitoring failures, but this alerting
change intentionally does not change the ETL exit code for those outcomes.

The JSON payload includes the model, requested and processed dates, input and
output row counts, timestamps, duration, severity, and the exception type. To
avoid copying credentials or connection details into the structured event, its
failure message is always `Silver ETL execution failed; see Cloud Logging
traceback`. Python's separately captured traceback remains available for
diagnosis.

## Alert policies

The standalone `silver_monitoring` Terraform module manages its own email
notification channel and two policies for each Silver Cloud Run Job in
`australia-southeast2`:

1. **Execution failure:** Watches
   `run.googleapis.com/job/completed_execution_count` where the execution result
   is `failed`. This covers unhandled exceptions, non-zero exits, timeouts, and
   platform termination.
2. **No data:** Matches `etl_run_finished` log entries whose status is
   `empty_input` or `empty_output`. Notifications are limited to one per
   job/status incident within five minutes. Because the status is extracted so
   it appears in email, different statuses can create separate incidents.

A successful positive-row event does not match either policy. The failure event
is not used by the no-data policy, which avoids duplicate email notifications
when Cloud Run already reports the execution failure.

## Gmail maintenance

In `supportdiscountmate@gmail.com`, create a filter for messages from
`alerting-noreply@google.com` and apply a label named `Silver ETL Alerts`.

After the first Terraform apply, open **Monitoring → Alerting → Edit
notification channels** in the GCP console. If the new email channel is marked
unverified, send its verification code and complete verification from the
project Gmail account before relying on alerts.

At least two continuing project members should control account recovery and
multi-factor authentication. Do not commit passwords, recovery codes, session
tokens, or app passwords to GitHub or Terraform.

To change the recipient, update this production Terraform value and apply the
reviewed plan:

```hcl
monitoring_alert_email = "supportdiscountmate@gmail.com"
```

Changing this value updates the notification channel. It does not require any
Python changes.

## Local verification

Run the complete Silver Python checks:

```bash
cd DE/etl-pipeline
uv sync --frozen --dev
uv run python -m unittest discover -s tests -v
uv run ruff check .
uv run ruff format --check .
```

From the repository root, validate Terraform without connecting to or changing
the production backend:

```bash
tofu fmt -check -recursive discount-mate-infra
cd discount-mate-infra/environments/prod
tofu init -backend=false
tofu validate
```

These commands do not create a notification channel or alert policy. Opening or
merging a PR also does not create GCP resources; an authorised operator must run
`tofu apply`.

The `Silver ETL Alerting Checks` GitHub Actions workflow runs the same Python
and Terraform checks for relevant pull requests. It validates code and
configuration only and never runs `tofu plan` against production or
`tofu apply`.

## Terraform plan and apply

The operator needs permission to manage Cloud Monitoring notification channels
and policies. Direct log alerts also require Logging notification-rule
permissions; the standard **Monitoring Editor** and **Logs Configuration
Writer** roles provide the relevant access.

In the ignored production `env.auto.tfvars`, confirm:

```hcl
monitoring_alert_email = "supportdiscountmate@gmail.com"
silver_etl_region       = "australia-southeast2"
```

Then initialize the existing production backend and save a reviewable plan:

```bash
cd discount-mate-infra/environments/prod
tofu init -reconfigure -backend-config=backend.hcl
tofu plan -var-file=env.auto.tfvars -out=silver-alerting.tfplan
```

The local plan file can contain sensitive infrastructure data. Do not commit or
attach it to the PR. Record only a sanitized summary showing that the plan adds:

- one email notification channel;
- four execution-failure policies;
- four no-data policies; and
- region filters for `australia-southeast2`.

Do not continue if the plan replaces or destroys unrelated resources. After the
team approves that exact plan, the authorised operator applies it with:

```bash
tofu apply silver-alerting.tfplan
```

Do not create equivalent channels or policies manually in GCP. Manual resources
aren't tracked in Terraform and can cause duplicates or configuration drift.

## Investigating an alert

1. Open the Logs Explorer link included in the alert email.
2. Confirm the Cloud Run Job name and execution timestamp.
3. For an execution failure, inspect the Python traceback and platform logs.
4. For `empty_input`, check the expected Bronze object path and run date.
5. For `empty_output`, compare the Bronze columns with the retailer transform
   and inspect the normalization filters.
6. Rerun the job only after correcting or understanding the cause.

Common technical causes include invalid GCS or PostgreSQL configuration,
unavailable DuckDB extensions, schema or constraint errors, insufficient Cloud
Run memory, and task timeout.

## Testing and handover

After Terraform is applied and the Silver jobs are deployed, execute the
relevant job with its normal deployment command, for example:

```bash
gcloud run jobs execute discount-mate-etl-products-aldi \
  --region australia-southeast2 \
  --wait
```

Record the Cloud Monitoring incident ID or a screenshot for each test without
exposing credentials or sensitive logs. Execution-failure metrics are sampled
every minute and can take up to two additional minutes to appear, so allow about
three to five minutes for the email.

Use this Logs Explorer query to confirm the structured event before waiting for
an email, replacing the job name when testing another retailer:

```text
resource.type="cloud_run_job"
resource.labels.job_name="discount-mate-etl-products-aldi"
resource.labels.location="australia-southeast2"
jsonPayload.pipeline="silver"
```

For a no-data test, confirm that the matching entry contains
`event="etl_run_finished"` and either `status="empty_input"` or
`status="empty_output"`. For a technical failure, confirm that Cloud Run marks
the overall execution as failed. Then check **Monitoring → Alerting → Incidents**
and the `supportdiscountmate@gmail.com` inbox.

| Test | Expected result |
|---|---|
| Normal positive-row run | Success event; no email |
| Date with no Bronze input | `empty_input`; one email |
| Input whose transform produces zero rows | `empty_output`; one email |
| Invalid PostgreSQL credentials | Failed execution; one email |
| Unhandled DuckDB error | Failed execution; one email |
| Forced Cloud Run timeout | Failed execution; one email |
| Repeated no-data events with the same job/status within five minutes | One rate-limited email |
| Silver execution failure while Bronze monitoring is enabled | Silver email only; no Bronze-labelled email |

To temporarily stop all Silver notifications, set both policy resources'
Terraform `enabled` values to `false`, review the plan, and apply it. Restore
them to `true` through the same workflow.

To stop monitoring one retailer permanently, remove its entry from
`local.silver_etl_jobs`, verify that the plan destroys only that retailer's two
policies, and apply. Do not delete or edit Terraform-managed policies manually
in the Google Cloud console because that creates configuration drift.

## Bronze monitoring integration

The Silver alerting module is independent of Bronze monitoring PR #307 and can
be reviewed and provisioned without waiting for that PR to merge.

After PR #307 merges, inspect its Bronze Cloud Run metric and log filters. They
must list only the four `discount-mate-ingestion-*` job names. If those filters
match every Cloud Run Job in the project, do not apply both monitoring systems
until the Bronze filters are narrowed. A Silver execution must not open a
Bronze-labelled incident. This does not require changing the standalone Silver
module.

## Deferred monitoring

The first version does not cover missed schedules, partially missing dates, data
freshness watermarks, volume baselines, rejection percentages, Cloud SQL health,
or dashboards. A multi-date run with some input and positive output is treated
as successful even when another requested date is skipped. Add these checks only
after production Silver runs provide stable baselines.
