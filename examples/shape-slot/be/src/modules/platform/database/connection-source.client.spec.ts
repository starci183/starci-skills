import type { QueryRunner } from "typeorm";
import { Secret } from "@modules/platform/config";
import type { DatabaseConnectionOptions } from "./database.options";
import { openConnectionSource } from "./connection-source.client";

class NoteEntity {}

class CreateNotes {
  up(_queryRunner: QueryRunner): Promise<void> {
    return Promise.resolve();
  }

  down(_queryRunner: QueryRunner): Promise<void> {
    return Promise.resolve();
  }
}

describe("openConnectionSource", () => {
  it("opens an isolated PostgreSQL data source with the connection's entities and migrations", () => {
    const connection: DatabaseConnectionOptions = {
      name: "primary",
      url: new Secret("postgres://user:password@database.test:5432/primary"),
      entities: [NoteEntity],
      migrations: [CreateNotes],
    };

    const source = openConnectionSource(connection);

    expect(source).toMatchObject({
      options: {
        type: "postgres",
        url: "postgres://user:password@database.test:5432/primary",
        entities: [NoteEntity],
        migrations: [CreateNotes],
        migrationsTableName: "primary_migrations",
        synchronize: false,
      },
      isInitialized: false,
    });
  });
});
