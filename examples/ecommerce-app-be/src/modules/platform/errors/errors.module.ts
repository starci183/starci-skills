import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ERRORS_SERVICE } from "./errors.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./errors.module-definition"
import { ErrorsService } from "./errors.service"

@Module({})
/** The errors capability: the one description service, the GraphQL formatter and the REST filter class the app binds through APP_FILTER. */
export class ErrorsModule extends ConfigurableModuleClass {
    /** Registers the capability once per app; the app root binds ErrorsFilter through APP_FILTER. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), { provide: ERRORS_SERVICE, useClass: ErrorsService }],
            exports: [ERRORS_SERVICE],
        }
    }
}
