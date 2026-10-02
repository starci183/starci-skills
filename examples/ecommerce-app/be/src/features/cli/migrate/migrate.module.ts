import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { MigrateCli } from "./migrate.cli"
import { OPEN_CONNECTION } from "./migrate.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./migrate.module-definition"
import { RunCli, openConnection } from "./subs/run.cli"

@Module({})
/** The migrate group: its command, its sub-commands and the opener of a connection's data source. */
export class MigrateModule extends ConfigurableModuleClass {
    /** Registers the group with the connections it migrates. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                MigrateCli,
                RunCli,
                { provide: OPEN_CONNECTION, useValue: openConnection },
            ],
        }
    }
}
