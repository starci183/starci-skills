import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { commandsModules } from "./compose/commands"
import { databaseModules } from "./compose/database"
import { platformModules } from "./compose/platform"
import type { CliAppOptions } from "./cli.options"

@Module({})
/**
 * The composition root of the cli: the clock and the logger every command logs through, the database capability over every
 * connection with its entities and migrations, and the cli feature root.
 */
export class AppModule {
    /** Builds the cli from its parsed options. */
    static register(options: CliAppOptions): DynamicModule {
        return {
            module: AppModule,
            imports: [
                ...platformModules(),
                ...databaseModules(options),
                ...commandsModules(),
            ],
        }
    }
}
