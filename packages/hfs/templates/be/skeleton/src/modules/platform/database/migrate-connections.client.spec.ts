import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { Secret } from "@modules/platform/config"
import type { DatabaseConnectionOptions } from "./database.options"
import type { ConnectionOpener, ConnectionSource } from "./database.port"
import { migrateConnections } from "./migrate-connections.client"

const MIGRATE_CLIENT = Symbol("migrate-connections")

const setup = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: MIGRATE_CLIENT, useFactory: () => ({ migrateConnections }) }],
    }).compile()
    return moduleRef.get<{ readonly migrateConnections: typeof migrateConnections }>(MIGRATE_CLIENT)
}

const connection = (name: string): DatabaseConnectionOptions => ({
    name,
    url: new Secret(`postgres://localhost:5432/${name}`),
    entities: [],
    migrations: [],
})

describe("migrateConnections", () => {
    it("runs the pending migrations of each connection in order and answers their names by connection", async () => {
        const client = await setup()
        const primary = mock<ConnectionSource>()
        primary.runMigrations.mockResolvedValue([{ id: 1, timestamp: 1, name: "Init1" }])
        const archive = mock<ConnectionSource>()
        archive.runMigrations.mockResolvedValue([])
        const sources = new Map([
            ["primary", primary],
            ["archive", archive],
        ])
        const opener = mock<ConnectionOpener>()
        opener.open.mockImplementation(
            (target: DatabaseConnectionOptions) => sources.get(target.name) ?? mock<ConnectionSource>(),
        )

        const applied = await client.migrateConnections([connection("primary"), connection("archive")], opener)

        expect(applied).toEqual({ primary: ["Init1"], archive: [] })
        expect(primary.initialize).toHaveBeenCalledTimes(1)
        expect(primary.destroy).toHaveBeenCalledTimes(1)
        expect(archive.destroy).toHaveBeenCalledTimes(1)
    })

    it("destroys the data source of a connection whose migration fails, and fails", async () => {
        const client = await setup()
        const failing = mock<ConnectionSource>()
        failing.runMigrations.mockRejectedValue(new TypeError("relation already exists"))
        const opener = mock<ConnectionOpener>()
        opener.open.mockReturnValue(failing)

        await expect(client.migrateConnections([connection("primary")], opener)).rejects.toThrow(
            "relation already exists",
        )
        expect(failing.destroy).toHaveBeenCalledTimes(1)
    })
})
