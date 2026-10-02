import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { Secret } from "@modules/platform/config"
import { CONNECTION_SOURCE, DATABASE_OPTIONS, seedText } from "@modules/platform/database"
import type { ConnectionSource, DatabaseConnectionOptions, OpenConnection } from "@modules/platform/database"
import { LOGGER, LoggingLogEvent } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { READ_SEED_FILES, RunSeedsCli, readSeedFiles, seedConnections, seedDirectoryOf } from "./run.cli"
import type { ReadSeedFiles, SeedFile } from "./run.cli"

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

const build = async (open: OpenConnection, read: ReadSeedFiles, logger: Logger) => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            RunSeedsCli,
            {
                provide: DATABASE_OPTIONS,
                useValue: { connections: [connection("primary")] },
            },
            { provide: CONNECTION_SOURCE, useValue: open },
            { provide: READ_SEED_FILES, useValue: read },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return moduleRef.get(RunSeedsCli)
}

describe("RunSeedsCli", () => {
    it("reads the seeds of the named environment, seeds every connection and logs the report", async () => {
        const primary = mock<ConnectionSource>()
        const read: ReadSeedFiles = jest.fn(() =>
            Promise.resolve([
                file("primary-notes.sql", "INSERT INTO notes (body) VALUES ('a')"),
                file("legacy-users.sql", "INSERT INTO users DEFAULT VALUES"),
            ]),
        )
        const logger = mock<Logger>()
        const command = await build(() => primary, read, logger)

        await command.run([], { env: "staging" })

        expect(read).toHaveBeenCalledWith(seedDirectoryOf("staging"))
        expect(logger.info).toHaveBeenCalledWith(LoggingLogEvent.SeedsApplied, {
            env: "staging",
            applied: { primary: ["primary-notes.sql"] },
            unmatched: ["legacy-users.sql"],
        })
        expect(primary.query).toHaveBeenCalledWith("INSERT INTO notes (body) VALUES ('a')")
    })

    it("reads the dev seeds when no environment is named, and takes --env as given", async () => {
        const read: ReadSeedFiles = jest.fn(() => Promise.resolve([]))
        const command = await build(() => mock<ConnectionSource>(), read, mock<Logger>())

        await command.run([])

        expect(read).toHaveBeenCalledWith(seedDirectoryOf("dev"))
        expect(command.parseEnv("staging")).toBe("staging")
    })
})

describe("seedDirectoryOf", () => {
    it("is the seeds folder of the environment under .starcistacks, relative to the app root", () => {
        expect(seedDirectoryOf("dev")).toBe(join(".starcistacks", "dev", "seeds"))
    })
})

describe("seedConnections", () => {
    it("runs the files of each connection in the given order and never opens a connection without a file", async () => {
        const primary = mock<ConnectionSource>()
        const archive = mock<ConnectionSource>()
        const sources = new Map([
            ["primary", primary],
            ["archive", archive],
        ])
        const open: OpenConnection = jest.fn(
            (target: DatabaseConnectionOptions) => sources.get(target.name) ?? mock<ConnectionSource>(),
        )

        const report = await seedConnections(
            [connection("primary"), connection("archive")],
            [file("primary-a.sql", "SELECT 1"), file("primary-b.sql", "SELECT 2")],
            open,
        )

        expect(report).toEqual({
            applied: { primary: ["primary-a.sql", "primary-b.sql"] },
            unmatched: [],
        })
        expect(primary.query.mock.calls).toEqual([["SELECT 1"], ["SELECT 2"]])
        expect(primary.destroy).toHaveBeenCalledTimes(1)
        expect(archive.initialize).not.toHaveBeenCalled()
    })

    it("destroys the data source of a connection whose seed fails, and fails", async () => {
        const failing = mock<ConnectionSource>()
        failing.query.mockRejectedValue(new TypeError("relation does not exist"))

        await expect(
            seedConnections([connection("primary")], [file("primary-a.sql", "SELECT 1")], () => failing),
        ).rejects.toThrow("relation does not exist")
        expect(failing.destroy).toHaveBeenCalledTimes(1)
    })
})

describe("readSeedFiles", () => {
    let directory = ""

    beforeEach(async () => {
        directory = await mkdtemp(join(tmpdir(), "seeds-"))
    })

    afterEach(async () => {
        await rm(directory, { recursive: true, force: true })
    })

    it("answers every sql file of the directory sorted by name with its statements, and nothing else", async () => {
        await writeFile(join(directory, "primary-b.sql"), "SELECT 2")
        await writeFile(join(directory, "primary-a.sql"), "SELECT 1")
        await writeFile(join(directory, "README.md"), "not a seed")

        const files = await readSeedFiles(directory)

        expect(files).toEqual([
            { name: "primary-a.sql", text: "SELECT 1" },
            { name: "primary-b.sql", text: "SELECT 2" },
        ])
    })
})
