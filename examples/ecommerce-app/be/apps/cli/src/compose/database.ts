import type { DynamicModule } from "@nestjs/common"
import { DatabaseModule } from "@modules/platform/database"
import type { CliAppOptions } from "../cli.options"

/** The CLI opens each service connection with its owned entities and migrations. */
export const databaseModules = (options: CliAppOptions): Array<DynamicModule> => [
    DatabaseModule.register({ isGlobal: true, connections: options.connections }),
]
