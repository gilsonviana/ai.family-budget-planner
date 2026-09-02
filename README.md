# Family Finance Planner

A headless family budget planner for expected income, planned expenses,
analytics, bill reminders, and provider-neutral AI insights.

## Workspace layout

- `apps/cli`: command-line interface
- `apps/mcp`: Model Context Protocol server
- `packages/domain`: financial domain model and deterministic calculations
- `packages/application`: use cases and inward-facing ports
- `packages/infrastructure`: persistence and external provider adapters
- `packages/config`: runtime configuration
- `packages/shared`: cross-cutting primitives with no adapter dependencies

Install all workspace packages with `pnpm install` and build them with
`pnpm build` once the TypeScript toolchain is configured.
