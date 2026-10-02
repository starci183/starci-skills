import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectCartService } from "@modules/domain/cart"
import type { CartService } from "@modules/domain/cart"
import { InjectCatalogService } from "@modules/domain/catalog"
import type { CatalogService } from "@modules/domain/catalog"
import { InjectPaymentService } from "@modules/domain/payment"
import type { PaymentService } from "@modules/domain/payment"
import { InjectOrderEntityManager, LIST_ROWS_MAX } from "@modules/platform/database"
import { InjectSagaService } from "@modules/platform/saga"
import type { SagaService } from "@modules/platform/saga"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { OrderPlacedEvent } from "@modules/events/order"
import { InjectEventBus } from "@modules/platform/event-bus"
import type { EventBus } from "@modules/platform/event-bus"
import { ok } from "@modules/platform/primitives"
import type { Outcome } from "@modules/platform/primitives"
import { evaluateCheckout } from "./checkout.policy"
import { OrderError, OrderErrorCode } from "./errors/order.error"
import { PLACE_ORDER_SAGA } from "./order.contracts"
import { OrderLogEvent } from "./order.log-events"
import type {
    GetBuyerStatusResult,
    BuyerStatusParams,
    FindPlacedOrderParams,
    FindPlacedOrderResult,
    CancelOrderParams,
    CancelledOrder,
    PlaceOrderParams,
    PlaceOrderRequest,
    PlacedOrder,
} from "./order.contracts"
import { OrderEntity } from "./persistence/entities/order.entity"
import { OrderLineEntity } from "./persistence/entities/order-line.entity"
import { toBuyerStatus, toOrderId } from "./persistence/order.rows"
import { ReceiptService } from "./receipt.service"
import type { OrderCountRow, OrderIdRow } from "./persistence/order.rows"
import { CANCEL_ORDER_IF_CONFIRMED, COUNT_PERSON_ORDERS, INSERT_ORDER_IF_NEW } from "./persistence/order.sql"

@Injectable()
/**
 * Confirms orders. `placeOrder` answers a replayed key with the first order, otherwise prices the cart against the
 * catalog and, when it can be confirmed, runs `confirm` in one transaction: it claims the idempotency key, takes the stock with
 * guarded decrements, writes the lines, captures the payment and clears the cart, so a failure at any step rolls the
 * whole confirmation back and the buyer keeps the cart.
 */
export class OrderService {
    constructor(
        @InjectOrderEntityManager() private readonly entityManager: EntityManager,
        @InjectCartService() private readonly cart: CartService,
        @InjectCatalogService() private readonly catalog: CatalogService,
        @InjectPaymentService() private readonly payments: PaymentService,
        private readonly receipts: ReceiptService,
        @InjectEventBus() private readonly bus: EventBus,
        @InjectLogger() private readonly logger: Logger,
        @InjectSagaService() private readonly sagas: SagaService,
    ) {}

    /**
     * Confirms the cart of a person. A replayed key answers the first order; an empty cart, an unknown product or too
     * little stock is a refusal; otherwise the order, stock, payment and cart clear all happen in one transaction.
     */
    async placeOrder(request: PlaceOrderRequest): Promise<Outcome<PlacedOrder, OrderErrorCode>> {
        const { personId, idempotencyKey } = request
        if (idempotencyKey !== undefined) {
            const replay = await this.findPlaced({ personId, idempotencyKey })
            if (replay) {
                await this.announce(replay, personId)
                return ok(replay)
            }
        }
        const lines = await this.cart.list({ personId })
        const products = await this.catalog.byIds({ ids: lines.map((line) => line.productId) })
        const evaluation = evaluateCheckout(lines, products)
        if (evaluation.kind === "refused") return evaluation
        const placed = await this.entityManager.transaction((manager) =>
            this.confirm({ manager, personId, plan: evaluation.value, idempotencyKey }),
        )
        // The receipt is archived after the commit: the order never waits on, or fails with, the object storage.
        if (!placed.replayed) await this.receipts.archive(placed.orderId)
        await this.announce(placed, personId)
        return ok(placed)
    }

    /**
     * Tells the billing service about a placed order, after the commit. The event id is the order id, so billing dedupes a
     * repeat; a replayed confirmation announces again, which repairs an announcement a failed publish lost. A failure is
     * logged and never fails the order the buyer already holds.
     */
    private async announce(placed: PlacedOrder, personId: string): Promise<void> {
        try {
            await this.bus.publish(
                OrderPlacedEvent.create({ orderId: placed.orderId, personId, totalMinorUnits: placed.totalMinorUnits }),
                this.entityManager,
            )
        } catch (cause) {
            this.logger.error(OrderLogEvent.EventPublishFailed, cause, { orderId: placed.orderId })
        }
    }

    /**
     * Compensates an order whose invoice the billing service rejected, in one transaction: the order is cancelled, the
     * stock its lines took is released and its payment is refunded. An order that is not confirmed any more (already
     * cancelled, or unknown) changes nothing, so the redelivery of the rejection is a no-op.
     */
    async cancelOrder(params: CancelOrderParams): Promise<CancelledOrder> {
        const cancelled = await this.entityManager.transaction(async (manager) => {
            const rows: Array<OrderIdRow> = await manager.query(CANCEL_ORDER_IF_CONFIRMED, [params.orderId])
            if (toOrderId(rows) === null) return false
            const lines = await manager.find(OrderLineEntity, {
                where: { orderId: params.orderId },
                take: LIST_ROWS_MAX,
            })
            for (const line of lines) {
                await this.catalog.releaseStock({ manager, productId: line.productId, quantity: line.quantity })
            }
            await this.payments.refund({ manager, orderId: params.orderId })
            return true
        })
        return { orderId: params.orderId, cancelled }
    }

    /** Whether one person has confirmed orders; an unknown person is not an error, no orders is the honest answer. */
    async buyerStatus(params: BuyerStatusParams): Promise<GetBuyerStatusResult> {
        const rows: Array<OrderCountRow> = await this.entityManager.query(COUNT_PERSON_ORDERS, [params.personId])
        return toBuyerStatus(params.personId, rows)
    }

    /** The order an earlier confirmation with the same key produced, marked as a replay, or null. */
    private async findPlaced(params: FindPlacedOrderParams): Promise<FindPlacedOrderResult> {
        const manager = params.manager ?? this.entityManager
        const order = await manager.findOneBy(OrderEntity, {
            personId: params.personId,
            idempotencyKey: params.idempotencyKey,
        })
        return order ? this.snapshot(order, manager) : null
    }

    /** Confirms an evaluated cart in the caller transaction. */
    private async confirm(params: PlaceOrderParams): Promise<PlacedOrder> {
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
        await this.sagas.begin({ manager, saga: PLACE_ORDER_SAGA, correlationId: orderId })
        return {
            orderId,
            status: "confirmed",
            totalMinorUnits: plan.totalMinorUnits,
            currency: plan.currency,
            paymentId: payment.paymentId,
            replayed: false,
        }
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
