import { Injectable } from "@nestjs/common"
import { InjectLogger, LoggingLogEvent } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { InjectConnectionSource, InjectDatabaseOptions } from "./database.port"
import type { DatabaseOptions } from "./database.options"
import type { ConnectionOpener } from "./database.port"
import { migrateConnections } from "./migrate-connections.client"

@Injectable()
/** The one migration runner: applies the pending migrations of every connection and logs the names it applied. */
export class MigrationRunnerService {
    constructor(
        @InjectDatabaseOptions() private readonly options: DatabaseOptions,
        @InjectConnectionSource() private readonly opener: ConnectionOpener,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /** Runs the migrations of every connection and logs the applied names. */
    async run(): Promise<void> {
        const applied = await migrateConnections(this.options.connections, this.opener)
        this.logger.info(LoggingLogEvent.MigrationsApplied, { applied })
    }
}
