import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { WEBHOOK_SIGNATURE } from "./http-security.decorators"
import { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } from "./http-security.module-definition"
import { WebhookSignatureService } from "./webhook-signature.service"

@Module({})
/** The http-security capability: the options its guards (registered by each api app) read. */
export class HttpSecurityModule extends ConfigurableModuleClass {
    /** Registers the capability once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                WebhookSignatureService,
                { provide: WEBHOOK_SIGNATURE, useExisting: WebhookSignatureService },
            ],
            exports: [MODULE_OPTIONS_TOKEN, WebhookSignatureService, WEBHOOK_SIGNATURE],
        }
    }
}
