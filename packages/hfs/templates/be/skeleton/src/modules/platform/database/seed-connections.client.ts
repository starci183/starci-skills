import { readFile, readdir } from "node:fs/promises"
import { join } from "node:path"
import { seedText } from "./database.sql"
import type { SqlText } from "./database.sql"
import type { DatabaseConnectionOptions } from "./database.options"
import type { ConnectionOpener } from "./database.port"

const SEED_EXTENSION = ".sql"

/** The stack environment whose seeds run when `--env` is not given. */
export const DEFAULT_SEED_ENV = "dev"

/** One seed file: its name (`<connection>-<name>.sql`, the connection it seeds first) and its statements. */
export interface SeedFile {
    /** The file name, without its directory. */
    readonly name: string
    /** The statements of the file, run as written. */
    readonly text: SqlText
}

/** What a seed run did: the files it ran by connection, and the files that name no connection (never run). */
export interface SeedReport {
    /** The names of the files run, by connection, in the order they ran. */
    readonly applied: Readonly<Record<string, ReadonlyArray<string>>>
    /** The files whose name starts with no declared connection. */
    readonly unmatched: ReadonlyArray<string>
}

/** The seed directory of a stack environment, relative to the working directory of the run: the app root. */
export const seedDirectoryOf = (env: string): string => join(".starcistacks", env, "seeds")

/** Reads every `*.sql` file of the seed directory, sorted by name; a missing directory fails the run. */
export const readSeedFiles = async (directory: string): Promise<ReadonlyArray<SeedFile>> => {
    const names = (await readdir(directory))
        .filter((name) => name.endsWith(SEED_EXTENSION))
        .sort((a, b) => a.localeCompare(b))
    return Promise.all(
        names.map(async (name) => ({
            name,
            text: seedText(await readFile(join(directory, name), "utf8")),
        })),
    )
}

/** Whether a seed file seeds the connection: its name starts with the connection name and a dash. */
const seeds = (file: SeedFile, connection: DatabaseConnectionOptions): boolean =>
    file.name.startsWith(`${connection.name}-`)

/**
 * Runs the seed files of every connection in turn, each through the data source of the connection it names, and answers the
 * files it ran by connection and the files that name no connection. A connection without a seed file is never opened.
 */
export async function seedConnections(
    connections: ReadonlyArray<DatabaseConnectionOptions>,
    files: ReadonlyArray<SeedFile>,
    opener: ConnectionOpener,
): Promise<SeedReport> {
    const applied: Record<string, ReadonlyArray<string>> = {}
    for (const connection of connections) {
        const own = files.filter((file) => seeds(file, connection))
        if (own.length === 0) continue
        const source = opener.open(connection)
        await source.initialize()
        try {
            for (const file of own) await source.query(file.text)
        } finally {
            await source.destroy()
        }
        applied[connection.name] = own.map((file) => file.name)
    }
    const unmatched = files
        .filter((file) => !connections.some((connection) => seeds(file, connection)))
        .map((file) => file.name)
    return { applied, unmatched }
}
