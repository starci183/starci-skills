import type {
    MigrationInterface 
} from "typeorm"
import {
    ProductEntity 
} from "./entities/product.entity"
import {
    CartItemEntity 
} from "./entities/cart-item.entity"
import {
    OrderEntity 
} from "./entities/order.entity"
import {
    OrderLineEntity 
} from "./entities/order-line.entity"
import {
    PaymentEntity 
} from "./entities/payment.entity"
import {
    CreateOrderTables1789800001000 
} from "./migrations/1789800001000-create-order-tables"

export { CONNECTION } from "./connection"
export { pingDatabase } from "./ping.repository"
export { ProductEntity, CartItemEntity, OrderEntity, OrderLineEntity, PaymentEntity }

/** Every entity of the order connection, listed explicitly so what runs is what was reviewed (no glob). */
export const entities = [ProductEntity,
    CartItemEntity,
    OrderEntity,
    OrderLineEntity,
    PaymentEntity]

/** Every migration of the order connection in the order it runs; only `apps/migrate` applies them. */
export const migrations: ReadonlyArray<new () => MigrationInterface> = [CreateOrderTables1789800001000]
