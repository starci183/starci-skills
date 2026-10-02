import { mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { DataSource, Migration } from "typeorm"
import { Secret } from "@modules/platform/config"
import type { DatabaseConnectionOptions } from "@modules/platform/database"
import { LOGGER, LoggingLogEvent } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { OPEN_CONNECTION } from "../migrate.decorators"
import { MODULE_OPTIONS_TOKEN } from "../migrate.module-definition"
import type { OpenConnection } from "../migrate.options"
import { RunCli, migrateConnections, openConnection } from "./run.cli"

const connection = (name: string): DatabaseConnectionOptions => ({
    name,
    url: new Secret(`postgres://localhost:5432/${name}`),
    entities: [],
    migrations: [],
})

/** A data source double that answers `ran` from runMigrations, or rejects with `failure`. */
const dataSource = (ran: ReadonlyArray<string>, failure?: Error) =>
    mock<DataSource>({
        initialize: jest.fn(async () => mock<DataSource>()),
        runMigrations: jest.fn(async () => {
            if (failure) throw failure
            return ran.map((name) => new Migration(1, 1, name))
        }),
        destroy: jest.fn(async () => undefined),
    })

describe("RunCli", () => {
    it("migrates every connection in order and logs the applied names by connection", async () => {
        const identity = dataSource(["Accounts1"])
        const order = dataSource(["Orders1", "Carts1"])
        const sources = new Map([
            ["identity", identity],
            ["order", order],
        ])
        const open: OpenConnection = jest.fn(
            (target: DatabaseConnectionOptions) => sources.get(target.name) ?? dataSource([]),
        )
        const logger = mock<Logger>()
        const moduleRef = await Test.createTestingModule({
            providers: [
                RunCli,
                {
                    provide: MODULE_OPTIONS_TOKEN,
                    useValue: { connections: [connection("identity"), connection("order")] },
                },
                { provide: OPEN_CONNECTION, useValue: open },
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
    it("destroys the data source of a connection whose migrations fail, and fails", async () => {
        const failing = dataSource([], new Error("relation exists"))

        await expect(migrateConnections([connection("order")], () => failing)).rejects.toThrow("relation exists")
        expect(failing.destroy).toHaveBeenCalledTimes(1)
    })
})

describe("openConnection", () => {
    it("opens an uninitialized postgres data source with the connection's own ledger table and no synchronize", () => {
        const opened = openConnection(connection("order"))

        expect(opened).toBeInstanceOf(DataSource)
        expect(opened.isInitialized).toBe(false)
        expect(opened.options).toMatchObject({
            type: "postgres",
            url: "postgres://localhost:5432/order",
            migrationsTableName: "order_migrations",
            synchronize: false,
        })
    })
})
