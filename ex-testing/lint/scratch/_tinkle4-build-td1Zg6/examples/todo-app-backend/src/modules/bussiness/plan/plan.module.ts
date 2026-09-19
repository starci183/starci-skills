import {
    DynamicModule, Module, OnModuleInit 
} from "@nestjs/common"
import {
    CqrsModule 
} from "@nestjs/cqrs"
import {
    TaskModule 
} from "../task/task.module"
import {
    TaskCreationPolicyRegistry 
} from "../task/creation-policy.providers"
import {
    ConfigurableModuleClass, OPTIONS_TYPE 
} from "./plan.module-definition"
import {
    SubscriptionService 
} from "./subscription.service"
import {
    PaymentService 
} from "./payment.service"
import {
    PlanCapGuardPolicy 
} from "./cap-guard.policy"
import {
    UpgradePlanHandler 
} from "./upgrade-plan.handler"
import {
    DowngradePlanHandler 
} from "./downgrade-plan.handler"
import {
    ConfirmPaymentHandler 
} from "./confirm-payment.handler"
import {
    ReconcilePaymentHandler 
} from "./reconcile-payment.handler"
import {
    PlanUsageHandler 
} from "./plan-usage.handler"

/**
 * The `plan` capability module, under nivo's `modules/bussiness/<capability>` shape. Owns
 * SubscriptionService, PaymentService, PlanCapGuardPolicy and every plan CQRS command/query handler.
 *
 * `TaskModule.register()` is imported for exactly one reason: `contract.plan.create-precondition`'s
 * provider side (sds.plan.cap-guard) must reach the one live `TaskCreationPolicyRegistry` instance
 * `bussiness/task`'s own `CreateTaskHandler` already consults, and that registry is only reachable
 * through `TaskModule`'s exports (creation-policy.providers.ts's own comment invites exactly this: "a
 * future feature registers a policy here from its own Nest module"). `TaskModule.register()` is called
 * with no options here, identically to how `app.module.ts` calls it, so Nest's module-token
 * deduplication resolves both imports to the one instance already composed into the app - this module
 * never edits `bussiness/task`'s own files, and never constructs a second, divergent TaskService/registry
 * graph. `TaskService` (also exported by TaskModule) is used read-only, by PlanCapGuardPolicy and
 * PlanUsageHandler, to compute the same active-task count (br.plan.active-scope) both places need.
 *
 * `onModuleInit` is where gap.plan.cap-guard-not-wired actually closes: this is the "OnModuleInit hook"
 * creation-policy.providers.ts's own comment names as one of the two places a policy registers itself.
 * `PostgresqlPrimaryModule`/`ConfigModule`/`PlatformEventsModule`/`SepayModule` are not imported
 * here: all four are registered globally from `app.module.ts`, so `SepayClient` resolves ambiently.
 */
@Module({
})
/** Nest module wiring the plan capability's providers; the app composition root registers it - other modules never import it. */
export class PlanModule extends ConfigurableModuleClass implements OnModuleInit {
    constructor(
    private readonly creationPolicyRegistry: TaskCreationPolicyRegistry,
    private readonly capGuardPolicy: PlanCapGuardPolicy,
    ) {
        super()
    }

    onModuleInit(): void {
        this.creationPolicyRegistry.register(this.capGuardPolicy)
    }

    static register(options: typeof OPTIONS_TYPE = {
    }): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            imports: [CqrsModule,
                TaskModule.register()],
            providers: [
                ...(base.providers ?? []),
                SubscriptionService,
                PaymentService,
                PlanCapGuardPolicy,
                UpgradePlanHandler,
                DowngradePlanHandler,
                ConfirmPaymentHandler,
                ReconcilePaymentHandler,
                PlanUsageHandler,
            ],
            exports: [SubscriptionService,
                PaymentService],
        }
    }
}
