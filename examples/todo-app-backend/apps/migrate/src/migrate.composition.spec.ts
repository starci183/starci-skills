import { EnvSource } from "@modules/platform/config"
import { PRIMARY_CONNECTION } from "@modules/platform/database"
import { parseMigrateAppOptions } from "./migrate.options"

const environment: Record<string, string> = { PRIMARY_DB_URL: "postgres://localhost:5501/todo" }

describe("parseMigrateAppOptions", () => {
    const options = parseMigrateAppOptions(new EnvSource(environment))

    it("lists the primary connection with the URL of its database", () => {
        expect(options.connections.map((connection) => connection.name)).toEqual([PRIMARY_CONNECTION])
        expect(options.connections.map((connection) => connection.url.reveal())).toEqual([
            "postgres://localhost:5501/todo",
        ])
    })

    it("hands the connection the entities of every owner of its tables", () => {
        const [primary] = options.connections
        expect(primary?.entities.map((entity) => entity.name).sort()).toEqual(
            expect.arrayContaining([
                "AuditKeyEntity",
                "InboxClaimEntity",
                "LeaseEntity",
                "OutboxMessageEntity",
                "SessionEntity",
                "TaskEntity",
                "UploadEntity",
            ]),
        )
    })

    it("names every migration after its class with a unique 13-digit epoch suffix, so TypeORM orders them", () => {
        const names: Array<string> = []
        for (const connection of options.connections) {
            for (const Migration of connection.migrations) {
                const migration = new Migration()
                expect(migration.name).toBe(Migration.name)
                expect(migration.name).toMatch(/\d{13}$/)
                names.push(migration.name.slice(-13))
            }
        }
        expect(new Set(names).size).toBe(names.length)
    })
})
