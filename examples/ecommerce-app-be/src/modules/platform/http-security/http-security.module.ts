import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { APP_PIPE } from "@nestjs/core"
import { ThrottlerModule } from "@nestjs/throttler"
import { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } from "./http-security.module-definition"
import { throttlerOptionsOf } from "./rate-limit.guard"
import { RequestValidationService } from "./request-validation.service"

@Module({})
/** The http-security capability: the global validation pipe, the throttler windows and the options the guards (registered by each api app) read. */
export class HttpSecurityModule extends ConfigurableModuleClass {
    /** Registers the capability once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            imports: [...(base.imports ?? []), ThrottlerModule.forRoot(throttlerOptionsOf(options.rateLimit))],
            providers: [...(base.providers ?? []), { provide: APP_PIPE, useClass: RequestValidationService }],
            exports: [MODULE_OPTIONS_TOKEN],
        }
    }
}
