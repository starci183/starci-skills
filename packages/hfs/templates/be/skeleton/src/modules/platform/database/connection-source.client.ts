import { DataSource } from "typeorm";
import type { DatabaseConnectionOptions } from "./database.options";
import type { ConnectionSource } from "./database.port";

/**
 * Opens the data source of one connection, uninitialized: its own migration ledger table (`<connection>_migrations`), the
 * schema changed only by migrations.
 */
export const openConnectionSource = (
  connection: DatabaseConnectionOptions,
): ConnectionSource =>
  new DataSource({
    type: "postgres",
    url: connection.url.reveal(),
    entities: [...connection.entities],
    migrations: [...connection.migrations],
    migrationsTableName: `${connection.name}_migrations`,
    synchronize: false,
  });
