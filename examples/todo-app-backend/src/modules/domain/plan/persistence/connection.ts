import { PRIMARY_CONNECTION } from "@modules/platform/database"
import { PaymentIntentEntity } from "./entities/payment-intent.entity"
import { SubscriptionEntity } from "./entities/subscription.entity"
import { CreatePlanTables1758160000003 } from "./migrations/1758160000003-create-plan-tables"

/** The connection that holds the tables of the plan capability. */
export const CONNECTION = PRIMARY_CONNECTION

/** The entities of the plan capability, for the connection that holds them. */
export const planEntities = [SubscriptionEntity, PaymentIntentEntity]

/** The migrations of the plan capability, in the order they run. */
export const planMigrations = [CreatePlanTables1758160000003]
