import Database from "better-sqlite3";
import {
  drizzle,
  type BetterSQLite3Database,
} from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

import { financeSchema } from "./schema.js";

export type FinanceDatabase = BetterSQLite3Database<typeof financeSchema>;

export interface InitializedDatabase {
  readonly connection: Database.Database;
  readonly database: FinanceDatabase;
  close(): void;
}

export class DatabaseInitializationError extends Error {
  override readonly cause: unknown;

  constructor(databasePath: string, cause: unknown) {
    super(
      `Could not initialize or upgrade finance database at ${JSON.stringify(databasePath)}`,
    );
    this.name = "DatabaseInitializationError";
    this.cause = cause;
  }
}

/** Opens a database, enables relational integrity, and applies every committed migration atomically. */
export function initializeDatabase(
  databasePath: string,
  migrationsFolder: string,
): InitializedDatabase {
  let connection: Database.Database | undefined;
  try {
    connection = new Database(databasePath);
    connection.pragma("foreign_keys = ON");
    const database = drizzle(connection, { schema: financeSchema });
    migrate(database, { migrationsFolder });
    return {
      connection,
      database,
      close: () => connection?.close(),
    };
  } catch (cause) {
    connection?.close();
    throw new DatabaseInitializationError(databasePath, cause);
  }
}
