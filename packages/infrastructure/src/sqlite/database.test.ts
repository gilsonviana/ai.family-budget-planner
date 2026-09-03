import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";

import { DatabaseInitializationError, initializeDatabase } from "./database.js";

const temporaryDirectories: string[] = [];
const migrationsFolder = resolve(import.meta.dirname, "../../drizzle");

function temporaryDatabase(): { directory: string; path: string } {
  const directory = mkdtempSync(join(tmpdir(), "family-finance-"));
  temporaryDirectories.push(directory);
  return { directory, path: join(directory, "finance.sqlite") };
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

describe("initializeDatabase", () => {
  it("initializes a new database from committed migrations", () => {
    const location = temporaryDatabase();
    const initialized = initializeDatabase(location.path, migrationsFolder);

    const tables = initialized.connection
      .prepare(
        "select name from sqlite_master where type = 'table' order by name",
      )
      .all()
      .map((row) => (row as { name: string }).name);

    expect(tables).toContain("households");
    expect(tables).toContain("income_plans");
    expect(
      initialized.connection.pragma("foreign_keys", { simple: true }),
    ).toBe(1);
    initialized.close();
  });

  it("reports migration failures without deleting existing data", () => {
    const location = temporaryDatabase();
    const original = new Database(location.path);
    original.exec(
      "create table existing_data (value text not null); insert into existing_data values ('safe')",
    );
    original.close();

    expect(() =>
      initializeDatabase(location.path, join(location.directory, "missing")),
    ).toThrow(DatabaseInitializationError);

    const reopened = new Database(location.path);
    expect(
      reopened.prepare("select value from existing_data").pluck().get(),
    ).toBe("safe");
    reopened.close();
  });
});
