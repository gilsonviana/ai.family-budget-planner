# CLI release contract

The production `finance` executable persists every operation to the SQLite file
selected by `FINANCE_DATABASE_PATH`. Core commands take one JSON object through
`--data`; analytical commands take `--family-id`, `--from`, and `--to`.

| Operation                 | Required input                                     | Persisted/result contract                                                                |
| ------------------------- | -------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `family:create`           | `id`, `name`, `settings`                           | Creates a family with its currency, locale, time zone, and week start.                   |
| `member:add`              | `familyId`, `id`, `name`                           | Creates a family-scoped member.                                                          |
| `income:create`           | IDs, source, `{value,currency}` amount, recurrence | Creates an active income plan using exact decimal money.                                 |
| `expense:category-create` | `familyId`, `id`, `name`                           | Creates an active family-scoped category.                                                |
| `expense:create`          | IDs, name, `{value,currency}` amount, recurrence   | Creates an active expense plan in the selected category.                                 |
| `budget:summary`          | `--family-id`, `--from`, `--to`                    | Returns exact expected income, expenses, and projected balance for the inclusive period. |
| `insight`                 | `--family-id`, `--from`, `--to`                    | Uses configured LLM credentials to explain calculated summary and analytical facts.      |

Every successful `--json` response has the shape
`{"data": <operation result>, "version": 1}` and exits with 0. Reusing an ID for
an ID-creating command returns
`{"error":{"code":"CONFLICT","message":"<entity> already exists: <id>"},"version":1}`
and exits with 4. Validation, not-found, and system errors exit with 2, 3,
and 1.

Dates use `YYYY-MM-DD`. Recurrences accept `oneTime`, `weekly`, `monthly`,
`quarterly`, and `yearly`, with optional `endDate` and `monthOverflow`.

The committed [clean-database acceptance output](evidence/cli-readme-e2e.jsonl)
contains one JSON response per README command.
