import { createHash } from "node:crypto";
import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";

import Database from "better-sqlite3";

export class BackupDestinationExistsError extends Error {
  constructor(path: string) {
    super(
      `Backup destination already exists: ${path}; pass overwrite: true to replace it`,
    );
    this.name = "BackupDestinationExistsError";
  }
}

export interface IntegrityReport {
  readonly healthy: boolean;
  readonly integrityErrors: readonly string[];
  readonly foreignKeyErrors: readonly unknown[];
  readonly migrationErrors: readonly string[];
}

/** Uses SQLite's online backup API to produce a self-contained, consistent database copy. */
export async function backupDatabase(
  sourcePath: string,
  destinationPath: string,
  options: { readonly overwrite?: boolean } = {},
): Promise<void> {
  if (existsSync(destinationPath)) {
    if (!options.overwrite)
      throw new BackupDestinationExistsError(destinationPath);
    unlinkSync(destinationPath);
  }
  const source = new Database(sourcePath, {
    readonly: true,
    fileMustExist: true,
  });
  try {
    await source.backup(destinationPath);
  } finally {
    source.close();
  }
}

export function checkDatabaseIntegrity(
  databasePath: string,
  migrationsFolder: string,
): IntegrityReport {
  const connection = new Database(databasePath, {
    readonly: true,
    fileMustExist: true,
  });
  try {
    const integrityRows = connection.pragma("integrity_check") as Array<{
      integrity_check: string;
    }>;
    const integrityErrors = integrityRows
      .map((row) => String(row.integrity_check))
      .filter((message) => message !== "ok");
    const foreignKeyErrors = connection.pragma(
      "foreign_key_check",
    ) as unknown[];
    const migrationErrors: string[] = [];
    const journal = JSON.parse(
      readFileSync(join(migrationsFolder, "meta", "_journal.json"), "utf8"),
    ) as { entries: Array<{ tag: string }> };
    const expectedHashes = journal.entries.map(({ tag }) =>
      createHash("sha256")
        .update(readFileSync(join(migrationsFolder, `${tag}.sql`)))
        .digest("hex"),
    );
    const applied = connection
      .prepare("select hash from __drizzle_migrations order by created_at")
      .pluck()
      .all() as string[];
    if (applied.length !== expectedHashes.length) {
      migrationErrors.push(
        `Expected ${expectedHashes.length} applied migrations but found ${applied.length}`,
      );
    }
    for (const [index, hash] of applied.entries()) {
      if (expectedHashes[index] !== hash) {
        migrationErrors.push(
          `Applied migration ${index} does not match committed migration`,
        );
      }
    }
    return {
      foreignKeyErrors,
      healthy:
        integrityErrors.length === 0 &&
        foreignKeyErrors.length === 0 &&
        migrationErrors.length === 0,
      integrityErrors,
      migrationErrors,
    };
  } finally {
    connection.close();
  }
}
