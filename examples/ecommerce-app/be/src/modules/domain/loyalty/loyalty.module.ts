import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { LOYALTY_SERVICE } from "./loyalty.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./loyalty.module-definition"
import { LoyaltyService } from "./loyalty.service"

@Module({})
/** The loyalty capability over the order database; the inbox it uses is registered by the app. */
export class LoyaltyModule extends ConfigurableModuleClass {
    /** Registers the capability once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                LoyaltyService,
                { provide: LOYALTY_SERVICE, useExisting: LoyaltyService },
            ],
            exports: [LoyaltyService, LOYALTY_SERVICE],
        }
    }
}
