import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { SepayClient } from "./sepay.client"
import { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } from "./sepay.module-definition"

@Module({})
/** Provides the SePay client, and the options the webhook door needs to verify a delivery. */
export class SepayModule extends ConfigurableModuleClass {
    /** Registers the integration once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), SepayClient],
            exports: [MODULE_OPTIONS_TOKEN, SepayClient],
        }
    }
}
