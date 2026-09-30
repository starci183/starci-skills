import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { JsonLoggerService } from "./json-logger.service"
import { LOG_ERR, LOG_OUT, LOGGER } from "./logging.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./logging.module-definition"

@Module({})
/** Provides the Logger port as the JSON-lines adapter stamped by the Clock the app registers, writing to stdout and stderr. */
export class LoggingModule extends ConfigurableModuleClass {
    /** Registers the capability once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                { provide: LOG_OUT, useValue: process.stdout },
                { provide: LOG_ERR, useValue: process.stderr },
                JsonLoggerService,
                { provide: LOGGER, useExisting: JsonLoggerService },
            ],
            exports: [LOGGER],
        }
    }
}
