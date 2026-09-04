export const jsonOutputVersion = 1;
export type CliErrorCode =
  "CONFLICT" | "NOT_FOUND" | "SYSTEM_ERROR" | "VALIDATION_ERROR";

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === "object") {
    if ("toJSON" in value && typeof value.toJSON === "function")
      return canonical(value.toJSON());
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, canonical(item)]),
    );
  }
  if (typeof value === "bigint") return value.toString();
  return value;
}

/** Versioned, canonical JSON envelope used as the CLI compatibility boundary. */
export function jsonSuccess(data: unknown): string {
  return JSON.stringify(canonical({ data, version: jsonOutputVersion }));
}
/** Versioned JSON envelope formatted for direct reading in a terminal. */
export function prettySuccess(data: unknown): string {
  return JSON.stringify(
    canonical({ data, version: jsonOutputVersion }),
    null,
    2,
  );
}
export function jsonError(code: CliErrorCode, message: string): string {
  return JSON.stringify(
    canonical({ error: { code, message }, version: jsonOutputVersion }),
  );
}
