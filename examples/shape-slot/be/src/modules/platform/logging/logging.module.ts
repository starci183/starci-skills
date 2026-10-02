import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { CLOCK } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { createJsonLogger } from "./json-logger.service"
import { LOGGER } from "./logging.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./logging.module-definition"

@Module({})
/** Provides the Logger port as the JSON-lines adapter stamped by the Clock the app registers. */
export class LoggingModule extends ConfigurableModuleClass {
    /** Registers the capability once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                { provide: LOGGER, inject: [CLOCK], useFactory: (clock: Clock) => createJsonLogger(clock) },
            ],
            exports: [LOGGER],
        }
    }
}
