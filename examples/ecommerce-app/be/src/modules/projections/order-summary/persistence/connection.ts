import { OrderSummaryProjectionEntity } from "../order-summary.projection-entity"
import { CreateOrderSummaries1789800011000 } from "./migrations/1789800011000-create-order-summaries"

/** The entities of the order-summary projection, for the connection of its context. */
export const orderSummaryEntities = [OrderSummaryProjectionEntity]

/** The migrations of the order-summary projection, in the order they run. */
export const orderSummaryMigrations = [CreateOrderSummaries1789800011000]
