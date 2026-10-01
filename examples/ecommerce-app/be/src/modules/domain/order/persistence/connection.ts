import { OrderEntity } from "./entities/order.entity"
import { OrderLineEntity } from "./entities/order-line.entity"
import { CreateOrders1789800003000 } from "./migrations/1789800003000-create-orders"
import { AddOrderReceiptKey1789800004000 } from "./migrations/1789800004000-add-order-receipt-key"

/** The entities of the order capability, for the connection that holds them. */
export const orderEntities = [OrderEntity, OrderLineEntity]

/** The migrations of the order capability, in the order they run. */
export const orderMigrations = [CreateOrders1789800003000, AddOrderReceiptKey1789800004000]
