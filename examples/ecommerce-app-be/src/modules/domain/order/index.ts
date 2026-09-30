import { OrderEntity } from "./persistence/entities/order.entity"
import { OrderLineEntity } from "./persistence/entities/order-line.entity"
import { CreateOrders1789800003000 } from "./persistence/migrations/1789800003000-create-orders"

/** The entities of the order capability, for the connection that holds them. */
export const orderEntities = [OrderEntity, OrderLineEntity]

/** The migrations of the order capability, in the order they run. */
export const orderMigrations = [CreateOrders1789800003000]

export { evaluateCheckout } from "./checkout.policy"
export { ORDER_ERROR_KINDS, OrderError, OrderErrorCode } from "./errors/order.error"
export { ORDER_MESSAGES } from "./messages/order.messages"
export type { BuyerStatus, PlacedOrder } from "./order.contracts"
export { OrderModule } from "./order.module"
export { OrderService } from "./order.service"
