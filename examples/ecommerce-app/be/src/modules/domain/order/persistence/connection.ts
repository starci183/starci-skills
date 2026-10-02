import { OrderEntity } from "./entities/order.entity"
import { OrderLineEntity } from "./entities/order-line.entity"
import { CreateOrders1789800003000 } from "./migrations/1789800003000-create-orders"
import { AddOrderReceiptKey1789800004000 } from "./migrations/1789800004000-add-order-receipt-key"
import { AddOrderCancellation1789800007000 } from "./migrations/1789800007000-add-order-cancellation"
import { AddOrderPaymentLifecycle1789800010000 } from "./migrations/1789800010000-add-order-payment-lifecycle"

/** The entities of the order capability, for the connection that holds them. */
export const orderEntities = [OrderEntity, OrderLineEntity]

/** The migrations of the order capability, in the order they run. */
export const orderMigrations = [
    CreateOrders1789800003000,
    AddOrderReceiptKey1789800004000,
    AddOrderCancellation1789800007000,
    AddOrderPaymentLifecycle1789800010000,
]
