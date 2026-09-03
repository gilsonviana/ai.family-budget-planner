# Scheduling bill reminders

Reminder processing is a finite, idempotent command. Run it once for one
household date; the database claim prevents concurrent or repeated runs from
sending the same bill occurrence to the same recipient twice.

## Local cron

Use absolute paths because cron normally has a small environment and a different
working directory. The example runs at 07:05 in the machine's configured time
zone and supplies the same date as both ends of the CLI's inclusive period
syntax:

```cron
5 7 * * * cd /opt/family-finance && FINANCE_DATABASE_PATH=/var/lib/family-finance/finance.sqlite pnpm --silent finance reminder:process --from "$(date +\%F)" --to "$(date +\%F)" --json >>/var/log/family-finance-reminders.log 2>&1
```

Provide the email settings to the cron daemon through a protected environment
file or secret manager; never put the API key directly in the crontab. Confirm
the cron daemon's time zone, daylight-saving behavior, executable path, and
permissions on the SQLite database before enabling the entry.

## Hosted scheduler

A hosted scheduler can run the same finite command from a checked-out repository
or container. For a Render Cron Job, configure a quoted five-field UTC schedule
such as `"5 10 * * *"` and use this start command:

```sh
pnpm finance reminder:process --from "$(date -u +%F)" --to "$(date -u +%F)" --json
```

Provide `FINANCE_DATABASE_PATH` and email variables through the platform's
secret configuration. Render Cron Jobs evaluate schedules in UTC, allow only one
active run per cron service, and have no persistent disk. Consequently, a local
SQLite file is suitable only on a host with durable storage; do not deploy this
command as a Render Cron Job until the configured database is on storage the job
can access durably. A VM/container host with a mounted persistent volume is the
supported hosted SQLite arrangement.

## Concurrency, recovery, and time zones

- Run one processing command per household calendar date. Convert the
  scheduler's UTC clock to the household time zone before choosing
  `--from`/`--to`; UTC midnight is not necessarily the household's midnight.
- Multiple processes may select the same reminder, but only the process that
  acquires its database claim sends it. Successful records are never reclaimed.
  Failed records remain auditable and may be claimed by a later retry.
- Keep the SQLite database on one durable filesystem and do not share it through
  object-storage synchronization. Take regular backups with the database backup
  workflow.
- Capture the JSON summary and exit code. A nonzero exit means the scheduler
  should flag the run; individual provider failures are recorded in the summary
  and delivery table.
