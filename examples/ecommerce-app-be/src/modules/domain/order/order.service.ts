import { Injectable } from "@nestjs/common"
import { EntityManager } from "typeorm"
import { CartService } from "@modules/domain/cart"
import { CatalogService } from "@modules/domain/catalog"
import { PaymentService } from "@modules/domain/payment"
import { InjectOrderEntityManager } from "@modules/platform/database"
import { OrderError, OrderErrorCode } from "./errors/order.error"
import type {
    GetBuyerStatusResult,
    BuyerStatusParams,
    FindPlacedOrderParams,
    FindPlacedOrderResult,
    PlaceOrderParams,
    PlacedOrder,
} from "./order.contracts"
import { OrderEntity } from "./persistence/entities/order.entity"
import { OrderLineEntity } from "./persistence/entities/order-line.entity"
import { toBuyerStatus, toOrderId } from "./persistence/order.rows"
import type { OrderCountRow, OrderIdRow } from "./persistence/order.rows"
import { COUNT_PERSON_ORDERS, INSERT_ORDER_IF_NEW } from "./persistence/order.sql"

@Injectable()
/**
 * Confirms orders. `place` runs inside the caller transaction: it claims the idempotency key, takes the stock with
 * guarded decrements, writes the lines, captures the payment and clears the cart, so a failure at any step rolls the
 * whole confirmation back and the buyer keeps the cart.
 */
export class OrderService {
    constructor(
        @InjectOrderEntityManager() private readonly entityManager: EntityManager,
        private readonly cart: CartService,
        private readonly catalog: CatalogService,
        private readonly payments: PaymentService,
    ) {}

    /** The order an earlier confirmation with the same key produced, marked as a replay, or null. */
    async findPlaced(params: FindPlacedOrderParams): Promise<FindPlacedOrderResult> {
        const manager = params.manager ?? this.entityManager
        const order = await manager.findOneBy(OrderEntity, {
            personId: params.personId,
            idempotencyKey: params.idempotencyKey,
        })
        return order ? this.snapshot(order, manager) : null
    }

    /** Confirms an evaluated cart in the caller transaction. */
    async place(params: PlaceOrderParams): Promise<PlacedOrder> {
        const { manager, personId, plan, idempotencyKey } = params
        const rows: Array<OrderIdRow> = await manager.query(INSERT_ORDER_IF_NEW, [
            personId,
            plan.totalMinorUnits,
            plan.currency,
            idempotencyKey ?? null,
        ])
        const orderId = toOrderId(rows)
        if (orderId === null) return this.replayOf(params)
        for (const line of plan.lines) {
            const reserved = await this.catalog.reserveStock({
                manager,
                productId: line.productId,
                quantity: line.quantity,
            })
            if (!reserved) {
                throw new OrderError({
                    code: OrderErrorCode.InsufficientStock,
                    params: { productId: line.productId, requested: line.quantity },
                })
            }
        }
        await manager.insert(
            OrderLineEntity,
            plan.lines.map((line) => ({
                orderId,
                productId: line.productId,
                quantity: line.quantity,
                unitPriceMinorUnits: line.unitPriceMinorUnits,
            })),
        )
        const payment = await this.payments.capture({
            manager,
            personId,
            orderId,
            amountMinorUnits: plan.totalMinorUnits,
        })
        await this.cart.clear({ manager, personId })
        return {
            orderId,
            status: "confirmed",
            totalMinorUnits: plan.totalMinorUnits,
            currency: plan.currency,
            paymentId: payment.paymentId,
            replayed: false,
        }
    }

    /** Whether one person has confirmed orders; an unknown person is not an error, no orders is the honest answer. */
    async buyerStatus(params: BuyerStatusParams): Promise<GetBuyerStatusResult> {
        const rows: Array<OrderCountRow> = await this.entityManager.query(COUNT_PERSON_ORDERS, [params.personId])
        return toBuyerStatus(params.personId, rows)
    }

    /** A concurrent request with the same key won the insert: answer that order as a replay. */
    private async replayOf(params: PlaceOrderParams): Promise<PlacedOrder> {
        const existing =
            params.idempotencyKey === undefined
                ? null
                : await this.findPlaced({
                      manager: params.manager,
                      personId: params.personId,
                      idempotencyKey: params.idempotencyKey,
                  })
        if (existing === null) throw new OrderError({ code: OrderErrorCode.PlacementFailed })
        return existing
    }

    private async snapshot(order: OrderEntity, manager: EntityManager): Promise<PlacedOrder> {
        const payment = await this.payments.findByOrder({ orderId: order.id, manager })
        if (payment === null) throw new OrderError({ code: OrderErrorCode.PaymentMissing })
        return {
            orderId: order.id,
            status: order.status,
            totalMinorUnits: order.totalMinorUnits,
            currency: "USD",
            paymentId: payment.paymentId,
            replayed: true,
        }
    }
}
