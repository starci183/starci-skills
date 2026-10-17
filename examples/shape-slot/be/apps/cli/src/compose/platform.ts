import type { DynamicModule } from "@nestjs/common"
import { noteEntities, noteMigrations } from "@modules/domain/note"
import { ClockModule } from "@modules/platform/clock"
import { DatabaseModule } from "@modules/platform/database"
import type { DatabaseConnectionConfig, DatabaseConnectionOptions } from "@modules/platform/database"
import { HttpModule } from "@modules/platform/http"
import { LoggingModule } from "@modules/platform/logging"
import type { CliAppOptions } from "../cli.options"

/** Binds the primary connection to its owners' entities and migrations during composition. */
const primaryConnectionOf = (primary: DatabaseConnectionConfig): DatabaseConnectionOptions => ({
    ...primary,
    name: "primary",
    entities: noteEntities,
    migrations: noteMigrations,
})

/** The clock, logger and declared database connections shared by CLI commands. */
export const platformModules = (options: CliAppOptions): Array<DynamicModule> => [
    ClockModule.register({ isGlobal: true }),
    HttpModule.register({ isGlobal: true }),
    LoggingModule.register({ isGlobal: true }),
    DatabaseModule.register({
        isGlobal: true,
        connections: [primaryConnectionOf(options.database)],
    }),
]
