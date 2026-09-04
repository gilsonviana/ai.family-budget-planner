# Family Finance Planner

A headless planner for expected family income, planned expenses, forecasts, bill
reminders, and AI-assisted explanations. Financial arithmetic is always
performed by deterministic application services; an LLM may explain calculated
facts but never supplies totals.

There is intentionally no web UI, transaction ledger, bank synchronization, or
merchant categorization. The supported adapters are the `finance` CLI and the
`finance-mcp` stdio server.

## Requirements

- Node.js 22 or newer (the repository pins Node 22.17.1)
- pnpm 11.5.3 for source installations
- A local, durable path for the SQLite database

## Install from source

```sh
git clone https://github.com/gilsonviana/ai.family-budget-planner.git
cd ai.family-budget-planner
corepack enable
pnpm install --frozen-lockfile
pnpm build
```

Set the database location before running commands:

```sh
export FINANCE_DATABASE_PATH="$PWD/data/finance.sqlite"
```

The parent directory must exist and be writable. If the variable is omitted, the
application uses `./finance.db` relative to its working directory.

## Create a first family and plan

Core write commands accept one JSON object through `--data`. IDs are stable,
caller-chosen identifiers; amounts are decimal strings so floating-point
rounding never changes stored money.

```sh
pnpm finance family:create --json --data '{"id":"viana-family","name":"Viana Family","settings":{"currency":"BRL","locale":"pt-BR","timeZone":"America/Sao_Paulo","weekStartsOn":1}}'
pnpm finance member:add --json --data '{"familyId":"viana-family","id":"gilson","name":"Gilson"}'
pnpm finance income:create --json --data '{"id":"salary","familyId":"viana-family","memberId":"gilson","source":"Salary","amount":{"value":"8000.00","currency":"BRL"},"recurrence":{"frequency":"monthly","startDate":"2026-01-05"}}'
pnpm finance expense:category-create --json --data '{"id":"housing","familyId":"viana-family","name":"Housing"}'
pnpm finance expense:create --json --data '{"id":"rent","familyId":"viana-family","categoryId":"housing","name":"Rent","amount":{"value":"2500.00","currency":"BRL"},"recurrence":{"frequency":"monthly","startDate":"2026-01-10"}}'
pnpm finance budget:summary --from 2026-09-01 --to 2026-09-30 --json
```

Dates are local calendar dates in `YYYY-MM-DD` format. `--from` and `--to` are
inclusive. Recurrences support `oneTime`, `weekly`, `monthly`, `quarterly`, and
`yearly`.

## CLI operations

- Families and members: `family:create`, `family:get`, `family:update`,
  `member:add`, `member:list`, `member:edit`, `member:remove`
- Income: `income:create`, `income:get`, `income:list`, `income:update`,
  `income:deactivate`
- Expenses: `expense:category-create`, `expense:category-deactivate`,
  `expense:create`, `expense:get`, `expense:list`, `expense:update`,
  `expense:deactivate`
- Analytics and operations: `budget:summary`, `analytics:breakdown`,
  `budget:compare`, `budget:forecast`, `bill:list`, `reminder:process`

Use `--json` for stable machine-readable output. Validation errors exit with 2,
missing records with 3, unexpected system failures with 1, and success with 0.

## MCP server

Run the stdio server with `pnpm finance:mcp`. Its tools cover family/member
planning, income/expense/bill queries, summaries, breakdowns, comparisons,
forecasts, and AI period summaries. MCP callers never submit provider
credentials; operators inject them into the server environment.

## Configuration and operations

See the [operator guide](docs/operator-guide.md) for environment variables,
provider secrets, database backup and migration, and troubleshooting. See
[reminder scheduling](docs/reminder-scheduling.md) for cron and hosted scheduler
examples. Maintainers should follow the [release guide](docs/releasing.md).

## Development

```sh
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm --filter @family-finance/cli smoke:pack
pnpm --filter @family-finance/mcp smoke:pack
```

The monorepo separates domain rules, application use cases, infrastructure, and
adapters. Automated architecture checks prevent vendor, database, CLI, or MCP
dependencies from leaking into inward layers.
