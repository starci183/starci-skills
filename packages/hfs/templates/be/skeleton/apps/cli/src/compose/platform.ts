import type { DynamicModule } from "@nestjs/common"
import { ClockModule } from "@modules/platform/clock"
import { DatabaseModule } from "@modules/platform/database"
import { LoggingModule } from "@modules/platform/logging"
import type { CliAppOptions } from "../cli.options"

/** The clock, logger and declared database connections shared by CLI commands. */
export const platformModules = (options: CliAppOptions): Array<DynamicModule> => [
    ClockModule.register({ isGlobal: true }),
    LoggingModule.register({ isGlobal: true }),
    DatabaseModule.register({ isGlobal: true, connections: options.connections }),
]
