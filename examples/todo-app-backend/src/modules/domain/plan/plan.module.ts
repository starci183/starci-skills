import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { CapGuardPolicy } from "./cap-guard.policy"
import { PaymentService } from "./payment.service"
import { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } from "./plan.module-definition"
import { SettlementService } from "./settlement.service"
import { SubscriptionService } from "./subscription.service"

@Module({})
/** The plan capability: subscriptions, the payment ledger, the settlement of gateway outcomes and the cap guard. The handlers that orchestrate it live in the todo feature. */
export class PlanModule extends ConfigurableModuleClass {
    /** Registers the capability once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), SubscriptionService, PaymentService, SettlementService, CapGuardPolicy],
            exports: [MODULE_OPTIONS_TOKEN, SubscriptionService, PaymentService, SettlementService, CapGuardPolicy],
        }
    }
}
