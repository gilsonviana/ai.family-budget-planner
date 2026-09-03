import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";

import { initializeDatabase } from "./database.js";
import {
  BackupDestinationExistsError,
  backupDatabase,
  checkDatabaseIntegrity,
} from "./maintenance.js";

const directories: string[] = [];
const migrations = resolve(import.meta.dirname, "../../drizzle");
function directory(): string {
  const result = mkdtempSync(join(tmpdir(), "finance-maintenance-"));
  directories.push(result);
  return result;
}
afterEach(() =>
  directories.splice(0).forEach((path) => rmSync(path, { recursive: true })),
);

describe("SQLite maintenance", () => {
  it("creates a portable backup and refuses implicit overwrite", async () => {
    const folder = directory();
    const source = join(folder, "source.sqlite");
    const destination = join(folder, "backup.sqlite");
    const initialized = initializeDatabase(source, migrations);
    initialized.connection.exec(
      "insert into households values ('f','Family','USD','en-US','UTC',0)",
    );
    initialized.close();

    await backupDatabase(source, destination);
    const backup = new Database(destination, { readonly: true });
    expect(backup.prepare("select name from households").pluck().get()).toBe(
      "Family",
    );
    backup.close();
    await expect(backupDatabase(source, destination)).rejects.toBeInstanceOf(
      BackupDestinationExistsError,
    );
    await backupDatabase(source, destination, { overwrite: true });
  });

  it("reports integrity and migration mismatches", () => {
    const folder = directory();
    const databasePath = join(folder, "finance.sqlite");
    const initialized = initializeDatabase(databasePath, migrations);
    initialized.connection.exec(
      "update __drizzle_migrations set hash = 'changed'",
    );
    initialized.close();

    const report = checkDatabaseIntegrity(databasePath, migrations);
    expect(report.healthy).toBe(false);
    expect(report.migrationErrors).toContain(
      "Applied migration 0 does not match committed migration",
    );
    expect(report.migrationErrors).toHaveLength(2);
  });
});
