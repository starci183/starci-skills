import { mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { Secret } from "@modules/platform/config"
import { LOGGER, LoggingLogEvent } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { CONNECTION_SOURCE, DATABASE_OPTIONS, READ_SEED_FILES } from "./database.port"
import type { ConnectionOpener, ConnectionSource, SeedFileReader } from "./database.port"
import type { DatabaseConnectionOptions } from "./database.options"
import { seedText } from "./database.sql"
import { seedDirectoryOf } from "./seed-connections.client"
import type { SeedFile } from "./seed-connections.client"
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
    const opener = mock<ConnectionOpener>()
    opener.open.mockImplementation((target) => openSource(target))
    const reader = mock<SeedFileReader>()
    reader.read.mockImplementation((directory) => readSeeds(directory))
    const moduleRef = await Test.createTestingModule({
        providers: [
            SeedRunnerService,
            {
                provide: DATABASE_OPTIONS,
                useValue: { connections: [connection("primary")] },
            },
            { provide: CONNECTION_SOURCE, useValue: opener },
            { provide: READ_SEED_FILES, useValue: reader },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { runner: moduleRef.get(SeedRunnerService), logger, reader }
}

describe("SeedRunnerService", () => {
    it("reads the seeds of the named environment, runs them on their connections and logs the report", async () => {
        const primary = mock<ConnectionSource>()
        const { runner, logger, reader } = await build(
            () => primary,
            () =>
                Promise.resolve([
                    file("primary-notes.sql", "INSERT INTO notes (body) VALUES ('a')"),
                    file("legacy-users.sql", "INSERT INTO users DEFAULT VALUES"),
                ]),
        )

        await expect(runner.run("staging")).resolves.toBeUndefined()

        expect(reader.read).toHaveBeenCalledWith(seedDirectoryOf("staging"))
        expect(primary.query).toHaveBeenCalledWith("INSERT INTO notes (body) VALUES ('a')")
        expect(logger.info).toHaveBeenCalledWith(LoggingLogEvent.SeedsApplied, {
            env: "staging",
            applied: { primary: ["primary-notes.sql"] },
            unmatched: ["legacy-users.sql"],
        })
    })

    it("reads the dev seeds when no environment is named", async () => {
        const { runner, logger, reader } = await build(
            () => mock<ConnectionSource>(),
            () => Promise.resolve([]),
        )

        await expect(runner.run()).resolves.toBeUndefined()

        expect(reader.read).toHaveBeenCalledWith(seedDirectoryOf("dev"))
        expect(logger.info).toHaveBeenCalledWith(LoggingLogEvent.SeedsApplied, {
            env: "dev",
            applied: {},
            unmatched: [],
        })
    })
})
