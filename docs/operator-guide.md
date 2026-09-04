# Operator guide

## Configuration reference

Configuration is loaded from environment variables at process startup.
Deterministic features need only a database path; provider credentials are
optional until their corresponding feature is invoked.

| Variable                 | Required  | Default        | Purpose                                                         |
| ------------------------ | --------- | -------------- | --------------------------------------------------------------- |
| `FINANCE_DATABASE_PATH`  | No        | `./finance.db` | SQLite database file                                            |
| `FINANCE_LOG_LEVEL`      | No        | `info`         | `trace`, `debug`, `info`, `warn`, `error`, `fatal`, or `silent` |
| `FINANCE_LLM_PROVIDER`   | For AI    | —              | Currently `openai`                                              |
| `FINANCE_LLM_MODEL`      | For AI    | —              | Deployment-approved model identifier                            |
| `FINANCE_LLM_API_KEY`    | For AI    | —              | Provider API credential                                         |
| `FINANCE_EMAIL_PROVIDER` | For email | —              | Currently `resend`                                              |
| `FINANCE_EMAIL_FROM`     | For email | —              | Verified sender address                                         |
| `FINANCE_EMAIL_API_KEY`  | For email | —              | Provider API credential                                         |

When a provider name is set, all of that provider's required variables must be
set. Startup validation reports missing variable names without printing secret
values.

## Secret handling

- Store API keys in the deployment platform's secret manager or a protected
  environment file readable only by the service account.
- Never put keys in command arguments, checked-in `.env` files, crontabs,
  database records, issue descriptions, logs, or MCP tool arguments.
- Give deployments separate least-privilege credentials. Rotate a key
  immediately if it appears in output or source control.
- MCP clients do not—and cannot through the published schemas—supply an LLM API
  key. The server receives credentials from its environment.
- Backups contain family financial plans. Encrypt backup storage and restrict it
  to the same audience as the live database.

```sh
export FINANCE_LLM_PROVIDER=openai
export FINANCE_LLM_MODEL='<approved-model>'
export FINANCE_LLM_API_KEY='<read-from-secret-manager>'
export FINANCE_EMAIL_PROVIDER=resend
export FINANCE_EMAIL_FROM='Budget Reminders <reminders@example.com>'
export FINANCE_EMAIL_API_KEY='<read-from-secret-manager>'
```

## SQLite placement and migration

Keep the database on one durable local filesystem. Do not place an actively
written SQLite database in an object-sync folder or attach the same file to
multiple hosts. The application enables foreign keys and applies committed
migrations when it opens the database.

Before an upgrade:

1. Stop CLI jobs and the MCP process so no writer remains.
2. Create and verify a backup.
3. Install the new artifact.
4. Start it once; startup applies pending migrations atomically.
5. Run an integrity check and a representative read operation.

If migration startup fails, do not delete the database or edit the migration
journal. Preserve the failed file and logs, restore the pre-upgrade backup to a
new path, and investigate the reported migration before retrying.

## Backup and restore

SQLite's online backup command produces a consistent portable copy:

```sh
mkdir -p /var/backups/family-finance
sqlite3 "$FINANCE_DATABASE_PATH" ".backup '/var/backups/family-finance/finance-$(date +%F).sqlite'"
sqlite3 "/var/backups/family-finance/finance-$(date +%F).sqlite" "PRAGMA integrity_check; PRAGMA foreign_key_check;"
```

Do not target an existing file. Keep multiple dated copies and periodically test
restoration on another machine. To restore, stop all writers, preserve the live
file under a new incident-specific name, copy the verified backup to a new path,
point `FINANCE_DATABASE_PATH` at it, and verify family reads and integrity
before resuming reminders.

The infrastructure package also exposes `backupDatabase` (which refuses to
overwrite unless explicitly requested) and `checkDatabaseIntegrity` for
programmatic operator tooling.

## Reminder operations

Run reminder processing once per household calendar date and capture its JSON
summary and exit code. Delivery claims make repeated runs idempotent; failures
remain auditable. See [reminder scheduling](reminder-scheduling.md) for cron,
hosted scheduling, recovery, concurrency, and time-zone guidance.

## Troubleshooting

### Configuration fails at startup

Correct the named variable and restart. Do not print the whole environment. An
AI or email provider name without its other required settings is intentionally
rejected.

### Records appear missing

Confirm the stable ID and `FINANCE_DATABASE_PATH`. A changed working directory
can select a different default `./finance.db` and resemble data loss.

### Database cannot open or migrate

Check that the parent directory exists, permissions and free space are adequate,
and only supported versions have used the file. Preserve it before repair. Run
`PRAGMA integrity_check` and `PRAGMA foreign_key_check` against a copy.

### Provider fails

Verify the provider name, secret version, model permission, verified sender,
network egress, and provider status. Provider errors are sanitized; never add
raw credentials to logs.

### MCP client cannot connect

Launch `finance-mcp` over stdio. Protocol traffic uses stdout, so inspect stderr
for startup errors. Confirm Node 22+, an absolute database path, and packaged
migrations.

### Reminder was not sent

Check household time zone, processing date, recurrence, lead days, recipients,
provider configuration, and persisted delivery status. Never delete successful
delivery claims; that can cause duplicate email.
