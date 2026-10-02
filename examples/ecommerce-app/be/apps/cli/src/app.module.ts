import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ClockModule } from "@modules/platform/clock"
import { LoggingModule } from "@modules/platform/logging"
import { CliModule } from "@features/cli"
import type { CliAppOptions } from "./cli.options"

@Module({})
/** The composition root of the cli: the clock and the logger every command logs through, and the cli feature root. */
export class AppModule {
    /** Builds the cli from its parsed options. */
    static register(options: CliAppOptions): DynamicModule {
        return {
            module: AppModule,
            imports: [
                ClockModule.register({ isGlobal: true }),
                LoggingModule.register({ isGlobal: true }),
                CliModule.register({ connections: options.connections }),
            ],
        }
    }
}
