import { Test } from "@nestjs/testing"
import type { QueryRunner } from "typeorm"
import { Secret } from "@modules/platform/config"
import type { DatabaseConnectionOptions } from "./database.options"
import { openConnectionSource } from "./connection-source.client"

class NoteEntity {}

class CreateNotes {
    up(_queryRunner: QueryRunner): Promise<void> {
        return Promise.resolve()
    }

    down(_queryRunner: QueryRunner): Promise<void> {
        return Promise.resolve()
    }
}

const SUBJECT = Symbol("subject")
const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { openConnectionSource } }],
    }).compile()
    return moduleRef.get<typeof import("./connection-source.client")>(SUBJECT)
}

describe("openConnectionSource", () => {
    it("opens an isolated PostgreSQL data source with the connection's entities and migrations", async () => {
        const subject = await build()
        const connection: DatabaseConnectionOptions = {
            name: "primary",
            url: new Secret("postgres://database.test:5432/primary"),
            entities: [NoteEntity],
            migrations: [CreateNotes],
        }

        const source = subject.openConnectionSource(connection)

        expect(source).toMatchObject({
            options: {
                type: "postgres",
                url: "postgres://database.test:5432/primary",
                entities: [NoteEntity],
                migrations: [CreateNotes],
                migrationsTableName: "primary_migrations",
                synchronize: false,
            },
            isInitialized: false,
        })
    })
})
