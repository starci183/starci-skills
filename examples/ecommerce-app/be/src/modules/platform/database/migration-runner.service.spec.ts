import { mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { Secret } from "@modules/platform/config"
import { LOGGER, LoggingLogEvent } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { CONNECTION_SOURCE, DATABASE_OPTIONS } from "./database.port"
import type { ConnectionOpener, ConnectionSource } from "./database.port"
import type { DatabaseConnectionOptions } from "./database.options"
import { MigrationRunnerService } from "./migration-runner.service"

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

const build = async (
    connections: ReadonlyArray<DatabaseConnectionOptions>,
    openSource: (target: DatabaseConnectionOptions) => ConnectionSource,
) => {
    const logger = mock<Logger>()
    const opener = mock<ConnectionOpener>()
    opener.open.mockImplementation((target) => openSource(target))
    const moduleRef = await Test.createTestingModule({
        providers: [
            MigrationRunnerService,
            { provide: DATABASE_OPTIONS, useValue: { connections } },
            { provide: CONNECTION_SOURCE, useValue: opener },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { runner: moduleRef.get(MigrationRunnerService), logger }
}

describe("MigrationRunnerService", () => {
    it("migrates every connection in order and logs the applied names by connection", async () => {
        const identity = source(["Accounts1"])
        const order = source(["Orders1", "Carts1"])
        const sources = new Map([
            ["identity", identity],
            ["order", order],
        ])
        const { runner, logger } = await build([connection("identity"), connection("order")], (target) => sources.get(target.name) ?? source([]))

        await runner.run()

        expect(logger.info).toHaveBeenCalledWith(LoggingLogEvent.MigrationsApplied, {
            applied: { identity: ["Accounts1"], order: ["Orders1", "Carts1"] },
        })
        expect(identity.destroy).toHaveBeenCalledTimes(1)
        expect(order.destroy).toHaveBeenCalledTimes(1)
    })

    it("answers no applied name when there is no connection", async () => {
        const { runner, logger } = await build([], () => source([]))

        await runner.run()

        expect(logger.info).toHaveBeenCalledWith(LoggingLogEvent.MigrationsApplied, { applied: {} })
    })

    it("destroys the data source of a connection whose migrations fail, and fails", async () => {
        const failing = source([])
        failing.runMigrations.mockRejectedValue(new TypeError("relation exists"))
        const { runner } = await build([connection("identity")], () => failing)

        await expect(runner.run()).rejects.toThrow("relation exists")
        expect(failing.destroy).toHaveBeenCalledTimes(1)
    })
})
