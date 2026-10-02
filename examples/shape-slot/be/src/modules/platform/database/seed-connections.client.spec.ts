import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { mock } from "@starci/jest-preset"
import { Secret } from "@modules/platform/config"
import type { DatabaseConnectionOptions } from "./database.options"
import type { ConnectionSource, OpenConnection } from "./database.port"
import { seedText } from "./database.sql"
import { readSeedFiles, seedConnections, seedDirectoryOf } from "./seed-connections.client"
import type { SeedFile } from "./seed-connections.client"

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

    it("answers the files that name no connection as unmatched", async () => {
        const report = await seedConnections(
            [connection("primary")],
            [file("legacy-users.sql", "INSERT INTO users DEFAULT VALUES")],
            () => mock<ConnectionSource>(),
        )

        expect(report).toEqual({ applied: {}, unmatched: ["legacy-users.sql"] })
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
