import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { APP_PIPE } from "@nestjs/core"
import { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } from "./http-security.module-definition"
import { RequestValidationPipe } from "./request-validation.service"

@Module({})
/** The http-security capability: the global validation pipe, and the options its guards (registered by each api app) read. */
export class HttpSecurityModule extends ConfigurableModuleClass {
    /** Registers the capability once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), { provide: APP_PIPE, useClass: RequestValidationPipe }],
            exports: [MODULE_OPTIONS_TOKEN],
        }
    }
}
