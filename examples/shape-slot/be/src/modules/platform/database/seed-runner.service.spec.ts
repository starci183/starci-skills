import { mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { Secret } from "@modules/platform/config"
import { LOGGER, LoggingLogEvent } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { CONNECTION_SOURCE, DATABASE_OPTIONS, READ_SEED_FILES } from "./database.port"
import type { ConnectionSource, OpenConnection } from "./database.port"
import type { DatabaseConnectionOptions } from "./database.options"
import { seedText } from "./database.sql"
import { seedDirectoryOf } from "./seed-connections.client"
import type { ReadSeedFiles, SeedFile } from "./seed-connections.client"
import { SeedRunnerService } from "./seed-runner.service"

const connection = (name: string): DatabaseConnectionOptions => ({
    name,
    url: new Secret(`postgres://localhost:5432/${name}`),
    entities: [],
    migrations: [],
})

const file = (name: string, text: string): SeedFile => ({
    name,
    text: seedText(text),
})

const build = async (open: OpenConnection, read: ReadSeedFiles) => {
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            SeedRunnerService,
            {
                provide: DATABASE_OPTIONS,
                useValue: { connections: [connection("primary")] },
            },
            { provide: CONNECTION_SOURCE, useFactory: () => open },
            { provide: READ_SEED_FILES, useFactory: () => read },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { runner: moduleRef.get(SeedRunnerService), logger }
}

describe("SeedRunnerService", () => {
    it("reads the seeds of the named environment, runs them on their connections and logs the report", async () => {
        const primary = mock<ConnectionSource>()
        const read: ReadSeedFiles = jest.fn(() =>
            Promise.resolve([
                file("primary-notes.sql", "INSERT INTO notes (body) VALUES ('a')"),
                file("legacy-users.sql", "INSERT INTO users DEFAULT VALUES"),
            ]),
        )
        const { runner, logger } = await build(() => primary, read)

        await expect(runner.run("staging")).resolves.toBeUndefined()

        expect(read).toHaveBeenCalledWith(seedDirectoryOf("staging"))
        expect(primary.query).toHaveBeenCalledWith("INSERT INTO notes (body) VALUES ('a')")
        expect(logger.info).toHaveBeenCalledWith(LoggingLogEvent.SeedsApplied, {
            env: "staging",
            applied: { primary: ["primary-notes.sql"] },
            unmatched: ["legacy-users.sql"],
        })
    })

    it("reads the dev seeds when no environment is named", async () => {
        const read: ReadSeedFiles = jest.fn(() => Promise.resolve([]))
        const { runner, logger } = await build(() => mock<ConnectionSource>(), read)

        await expect(runner.run()).resolves.toBeUndefined()

        expect(read).toHaveBeenCalledWith(seedDirectoryOf("dev"))
        expect(logger.info).toHaveBeenCalledWith(LoggingLogEvent.SeedsApplied, {
            env: "dev",
            applied: {},
            unmatched: [],
        })
    })
})
