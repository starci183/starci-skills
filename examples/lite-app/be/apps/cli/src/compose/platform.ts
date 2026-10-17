import type { DynamicModule } from "@nestjs/common"
import { ClockModule } from "@modules/platform/clock"
import { DatabaseModule } from "@modules/platform/database"
import { LoggingModule } from "@modules/platform/logging"
import type { CliAppOptions } from "../cli.options"

/** Registers the shared infrastructure of every CLI command. */
export const platformModules = (options: CliAppOptions): Array<DynamicModule> => [
    ClockModule.register({ isGlobal: true }),
    LoggingModule.register({ isGlobal: true }),
    DatabaseModule.register({ isGlobal: true, connections: options.connections }),
]
