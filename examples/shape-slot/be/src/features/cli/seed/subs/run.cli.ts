import { readFile, readdir } from "node:fs/promises"
import { join } from "node:path"
import { CommandRunner, Option, SubCommand } from "nest-commander"
import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import { InjectConnectionSource, InjectDatabaseOptions, seedText } from "@modules/platform/database"
import type { DatabaseConnectionOptions, DatabaseOptions, OpenConnection, SqlText } from "@modules/platform/database"
import { InjectLogger, LoggingLogEvent } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"

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

/** Reads every seed file of a directory, sorted by name. */
export type ReadSeedFiles = (directory: string) => Promise<ReadonlyArray<SeedFile>>

/** What a seed run did: the files it ran by connection, and the files that name no connection (never run). */
export interface SeedReport {
    /** The names of the files run, by connection, in the order they ran. */
    readonly applied: Readonly<Record<string, ReadonlyArray<string>>>
    /** The files whose name starts with no declared connection. */
    readonly unmatched: ReadonlyArray<string>
}

/** The options of `cli seed run`. */
export interface SeedRunOptions {
    /** The stack environment whose `.starcistacks/<env>/seeds` run. */
    readonly env?: string
}

/** Token of the function that reads the seed files of a directory. */
export const READ_SEED_FILES: unique symbol = Symbol("features.cli.seed.read-seed-files")

/** Injects the function that reads the seed files of a directory. Parameter type: ReadSeedFiles. */
const InjectReadSeedFiles = (): TypedParameterDecorator<ReadSeedFiles> => injector<ReadSeedFiles>(READ_SEED_FILES)

/** The seed directory of a stack environment, relative to the working directory of the run: the app root. */
export const seedDirectoryOf = (env: string): string => join(".starcistacks", env, "seeds")

/** Reads every `*.sql` file of the seed directory, sorted by name; a missing directory fails the run. */
export const readSeedFiles: ReadSeedFiles = async (directory: string) => {
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
    open: OpenConnection,
): Promise<SeedReport> {
    const applied: Record<string, ReadonlyArray<string>> = {}
    for (const connection of connections) {
        const own = files.filter((file) => seeds(file, connection))
        if (own.length === 0) continue
        const source = open(connection)
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

@SubCommand({
    name: "run",
    description: "Run every seed file of a stack environment on the connection it names",
})
/** `cli seed run [--env <name>]`: seeds every connection of the back end from `.starcistacks/<env>/seeds` and logs what it ran. */
export class RunSeedsCli extends CommandRunner {
    constructor(
        @InjectDatabaseOptions() private readonly options: DatabaseOptions,
        @InjectConnectionSource() private readonly open: OpenConnection,
        @InjectReadSeedFiles() private readonly read: ReadSeedFiles,
        @InjectLogger() private readonly logger: Logger,
    ) {
        super()
    }

    /** `--env <name>`: the stack environment whose seeds run. */
    @Option({
        flags: "--env <name>",
        description: "The stack environment whose seeds run",
        defaultValue: DEFAULT_SEED_ENV,
    })
    parseEnv(value: string): string {
        return value
    }

    /** Reads the seed files of the environment, runs them on their connections and logs the report. */
    async run(_passed: Array<string>, options?: SeedRunOptions): Promise<void> {
        const env = options?.env ?? DEFAULT_SEED_ENV
        const files = await this.read(seedDirectoryOf(env))
        const report = await seedConnections(this.options.connections, files, this.open)
        this.logger.info(LoggingLogEvent.SeedsApplied, {
            env,
            applied: report.applied,
            unmatched: report.unmatched,
        })
    }
}
