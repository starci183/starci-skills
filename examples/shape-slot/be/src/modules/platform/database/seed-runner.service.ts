import { Injectable } from "@nestjs/common"
import { InjectLogger, LoggingLogEvent } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { InjectConnectionSource, InjectDatabaseOptions, InjectReadSeedFiles } from "./database.port"
import type { DatabaseOptions } from "./database.options"
import type { OpenConnection } from "./database.port"
import { DEFAULT_SEED_ENV, seedConnections, seedDirectoryOf } from "./seed-connections.client"
import type { ReadSeedFiles } from "./seed-connections.client"

@Injectable()
/** The one seed runner: reads the seed files of a stack environment, runs them on the connections they name and logs the report. */
export class SeedRunnerService {
    constructor(
        @InjectDatabaseOptions() private readonly options: DatabaseOptions,
        @InjectConnectionSource() private readonly open: OpenConnection,
        @InjectReadSeedFiles() private readonly read: ReadSeedFiles,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /** Reads the seed files of the environment (the dev seeds when none is named), runs them on their connections and logs the report. */
    async run(env: string = DEFAULT_SEED_ENV): Promise<void> {
        const files = await this.read(seedDirectoryOf(env))
        const report = await seedConnections(this.options.connections, files, this.open)
        this.logger.info(LoggingLogEvent.SeedsApplied, {
            env,
            applied: report.applied,
            unmatched: report.unmatched,
        })
    }
}
