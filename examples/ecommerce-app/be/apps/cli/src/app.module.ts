import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { commandsModules } from "./compose/commands"
import { databaseConnections, databaseModules } from "./compose/database"
import { domainModules } from "./compose/domain"
import { platformModules } from "./compose/platform"
import type { CliAppOptions } from "./cli.options"
import type { CliEnv } from "./cli.env"

@Module({})
/**
 * The composition root of the cli: the clock and the logger every command logs through, the database capability over every
 * connection with its entities and migrations, and the cli feature root.
 */
export class AppModule {
    /** Builds the cli from its parsed options. */
    static register(options: CliEnv): DynamicModule {
        return {
            module: AppModule,
            imports: [
                ...platformModules(),
                ...databaseModules(options),
                ...domainModules(options),
                ...commandsModules(),
            ],
        }
    }
}

/** Composes the same database registrations for the test world's migration runner. */
export const createCliAppOptions = (databases: CliEnv): CliAppOptions => ({
    orderExpiry: databases.orderExpiry,
    connections: [...databaseConnections(databases)],
})
