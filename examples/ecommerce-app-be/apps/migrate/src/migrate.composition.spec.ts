import { EnvSource } from "@modules/platform/config"
import { IDENTITY_CONNECTION, ORDER_CONNECTION } from "@modules/platform/database"
import { parseMigrateAppOptions } from "./migrate.options"

const environment: Record<string, string> = {
    IDENTITY_DB_URL: "postgres://localhost:5501/identity",
    ORDER_DB_URL: "postgres://localhost:5501/order",
}

describe("parseMigrateAppOptions", () => {
    const options = parseMigrateAppOptions(new EnvSource(environment))

    it("lists the identity and order connections, each with the URL of its own database", () => {
        expect(options.connections.map((connection) => connection.name)).toEqual([IDENTITY_CONNECTION, ORDER_CONNECTION])
        expect(options.connections.map((connection) => connection.url.reveal())).toEqual([
            "postgres://localhost:5501/identity",
            "postgres://localhost:5501/order",
        ])
    })

    it("hands each connection the entities and migrations of the owners of its tables", () => {
        const [identity, order] = options.connections
        expect(identity?.entities.map((entity) => entity.name)).toEqual(["PersonEntity"])
        expect(order?.entities.map((entity) => entity.name).sort()).toEqual([
            "CartItemEntity",
            "OrderEntity",
            "OrderLineEntity",
            "PaymentEntity",
            "ProductEntity",
        ])
    })

    it("names every migration after its class with a 13-digit epoch suffix, so TypeORM orders them", () => {
        for (const connection of options.connections) {
            for (const Migration of connection.migrations) {
                const migration = new Migration()
                expect(migration.name).toBe(Migration.name)
                expect(migration.name).toMatch(/\d{13}$/)
            }
        }
    })
})
