import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { WebhookSignatureService } from "@modules/platform/http-security"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./sepay.module-definition"
import { SepaySignatureService } from "./sepay-signature.service"

@Module({})
/** Provides the shared webhook proof configured for the SePay notifier. */
export class SepayModule extends ConfigurableModuleClass {
    /** Registers the notifier's signature verifier with its parsed provider options. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                { provide: WebhookSignatureService, useClass: SepaySignatureService },
            ],
            exports: [WebhookSignatureService],
        }
    }
}
