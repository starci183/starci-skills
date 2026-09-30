import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { APP_FILTER } from "@nestjs/core"
import { ERRORS_SERVICE } from "./errors.decorators"
import { ErrorsFilter } from "./errors.filter"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./errors.module-definition"
import { ErrorsService } from "./errors.service"

@Module({})
/** The errors capability: the one description service, the one REST filter (registered app-wide) and the GraphQL formatter. */
export class ErrorsModule extends ConfigurableModuleClass {
    /** Registers the capability once per app; the filter is bound through APP_FILTER. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                { provide: ERRORS_SERVICE, useClass: ErrorsService },
                { provide: APP_FILTER, useClass: ErrorsFilter },
            ],
            exports: [ERRORS_SERVICE],
        }
    }
}
