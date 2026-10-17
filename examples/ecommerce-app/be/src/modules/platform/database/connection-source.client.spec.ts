import { Test } from "@nestjs/testing"
import type { QueryRunner } from "typeorm"
import { Secret } from "@modules/platform/config"
import type { DatabaseConnectionOptions } from "./database.options"
import { openConnectionSource } from "./connection-source.client"
import { CONNECTION_SOURCE } from "./database.port"
import type { ConnectionOpener } from "./database.port"

class AccountEntity {}

class CreateAccounts {
    up(_queryRunner: QueryRunner): Promise<void> {
        return Promise.resolve()
    }

    down(_queryRunner: QueryRunner): Promise<void> {
        return Promise.resolve()
    }
}

describe("openConnectionSource", () => {
    it("opens an isolated PostgreSQL data source with the connection's entities and migrations, uninitialized", async () => {
        const moduleRef = await Test.createTestingModule({
            providers: [{ provide: CONNECTION_SOURCE, useFactory: () => ({ open: openConnectionSource }) }],
        }).compile()
        const client = moduleRef.get<ConnectionOpener>(CONNECTION_SOURCE)
        const connection: DatabaseConnectionOptions = {
            name: "identity",
            url: new Secret("postgres://database.test:5432/identity"),
            entities: [AccountEntity],
            migrations: [CreateAccounts],
        }

        const source = client.open(connection)

        expect(source).toMatchObject({
            options: {
                type: "postgres",
                url: "postgres://database.test:5432/identity",
                entities: [AccountEntity],
                migrations: [CreateAccounts],
                migrationsTableName: "identity_migrations",
                synchronize: false,
            },
            isInitialized: false,
        })
    })
})
