import { mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { Secret } from "@modules/platform/config"
import { CONNECTION_SOURCE, DATABASE_OPTIONS } from "@modules/platform/database"
import type { ConnectionSource, DatabaseConnectionOptions, OpenConnection } from "@modules/platform/database"
import { LOGGER, LoggingLogEvent } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { RunCli, migrateConnections } from "./run.cli"

const connection = (name: string): DatabaseConnectionOptions => ({
    name,
    url: new Secret(`postgres://localhost:5432/${name}`),
    entities: [],
    migrations: [],
})

/** A connection source double whose runMigrations answers `ran`. */
const source = (ran: ReadonlyArray<string>) => {
    const double = mock<ConnectionSource>()
    double.runMigrations.mockResolvedValue(ran.map((name) => ({ name })))
    return double
}

describe("RunCli", () => {
    it("migrates every connection in order and logs the applied names by connection", async () => {
        const identity = source(["Accounts1"])
        const order = source(["Orders1", "Carts1"])
        const sources = new Map([
            ["identity", identity],
            ["order", order],
        ])
        const open: OpenConnection = jest.fn(
            (target: DatabaseConnectionOptions) => sources.get(target.name) ?? source([]),
        )
        const logger = mock<Logger>()
        const moduleRef = await Test.createTestingModule({
            providers: [
                RunCli,
                { provide: DATABASE_OPTIONS, useValue: { connections: [connection("identity"), connection("order")] } },
                { provide: CONNECTION_SOURCE, useValue: open },
                { provide: LOGGER, useValue: logger },
            ],
        }).compile()

        await moduleRef.get(RunCli).run()

        expect(logger.info).toHaveBeenCalledWith(LoggingLogEvent.MigrationsApplied, {
            applied: { identity: ["Accounts1"], order: ["Orders1", "Carts1"] },
        })
        expect(identity.destroy).toHaveBeenCalledTimes(1)
        expect(order.destroy).toHaveBeenCalledTimes(1)
    })
})

describe("migrateConnections", () => {
    it("answers no applied name when there is no connection", async () => {
        await expect(migrateConnections([], () => source([]))).resolves.toEqual({})
    })

    it("destroys the data source of a connection whose migrations fail, and fails", async () => {
        const failing = source([])
        failing.runMigrations.mockRejectedValue(new TypeError("relation exists"))

        await expect(migrateConnections([connection("identity")], () => failing)).rejects.toThrow("relation exists")
        expect(failing.destroy).toHaveBeenCalledTimes(1)
    })
})
