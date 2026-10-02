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

const build = async (
    openSource: (target: DatabaseConnectionOptions) => ConnectionSource,
    readSeeds: (directory: string) => Promise<ReadonlyArray<SeedFile>>,
) => {
    const logger = mock<Logger>()
    const open: OpenConnection = jest.fn((target: DatabaseConnectionOptions) => openSource(target))
    const read: ReadSeedFiles = jest.fn((directory: string) => readSeeds(directory))
    const moduleRef = await Test.createTestingModule({
        providers: [
            SeedRunnerService,
            {
                provide: DATABASE_OPTIONS,
                useValue: { connections: [connection("primary")] },
            },
            { provide: CONNECTION_SOURCE, useValue: open },
            { provide: READ_SEED_FILES, useValue: read },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { runner: moduleRef.get(SeedRunnerService), logger, read }
}

describe("SeedRunnerService", () => {
    it("reads the seeds of the named environment, runs them on their connections and logs the report", async () => {
        const primary = mock<ConnectionSource>()
        const { runner, logger, read } = await build(
            () => primary,
            () =>
                Promise.resolve([
                    file("primary-notes.sql", "INSERT INTO notes (body) VALUES ('a')"),
                    file("legacy-users.sql", "INSERT INTO users DEFAULT VALUES"),
                ]),
        )

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
        const { runner, logger, read } = await build(
            () => mock<ConnectionSource>(),
            () => Promise.resolve([]),
        )

        await expect(runner.run()).resolves.toBeUndefined()

        expect(read).toHaveBeenCalledWith(seedDirectoryOf("dev"))
        expect(logger.info).toHaveBeenCalledWith(LoggingLogEvent.SeedsApplied, {
            env: "dev",
            applied: {},
            unmatched: [],
        })
    })
})
