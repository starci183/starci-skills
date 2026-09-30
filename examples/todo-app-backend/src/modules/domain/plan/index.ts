import { PaymentIntentEntity } from "./persistence/entities/payment-intent.entity"
import { SubscriptionEntity } from "./persistence/entities/subscription.entity"
import { CreatePlanTables1758160000003 } from "./persistence/migrations/1758160000003-create-plan-tables"

/** The entities of the plan capability, for the connection that holds them. */
export const planEntities = [SubscriptionEntity, PaymentIntentEntity]

/** The migrations of the plan capability, in the order they run. */
export const planMigrations = [CreatePlanTables1758160000003]

export { CapGuardPolicy } from "./cap-guard.policy"
export { PLAN_ERROR_KINDS, PlanError, PlanErrorCode } from "./errors/plan.error"
export { PLAN_MESSAGES } from "./messages/plan.messages"
export { PaymentService } from "./payment.service"
export { parsePlanConfig } from "./plan.config"
export type { CapVerdict, PaymentIntentView, PlanDefinition, SubscriptionView } from "./plan.contracts"
export { InjectPlanOptions } from "./plan.decorators"
export { PlanModule } from "./plan.module"
export type { PlanOptions } from "./plan.options"
export { SettlementService } from "./settlement.service"
export { SubscriptionService } from "./subscription.service"
