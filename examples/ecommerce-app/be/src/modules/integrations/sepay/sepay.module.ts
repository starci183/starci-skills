import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { CLOCK } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { WebhookSignatureService } from "@modules/platform/http-security"
import { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } from "./sepay.module-definition"
import type { SepayOptions } from "./sepay.options"

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
                {
                    provide: WebhookSignatureService,
                    inject: [MODULE_OPTIONS_TOKEN, CLOCK],
                    useFactory: (provider: SepayOptions, clock: Clock) =>
                        new WebhookSignatureService(
                            {
                                allowedOrigins: [],
                                rateLimit: { windowMs: 60_000, defaultLimit: 100, strictLimit: 100 },
                                webhooks: { sepay: provider },
                            },
                            clock,
                        ),
                },
            ],
            exports: [WebhookSignatureService],
        }
    }
}
