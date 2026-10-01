import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectCartService } from "@modules/domain/cart"
import type { CartService } from "@modules/domain/cart"
import { InjectCatalogService } from "@modules/domain/catalog"
import type { CatalogService } from "@modules/domain/catalog"
import { InjectPaymentService } from "@modules/domain/payment"
import type { PaymentService } from "@modules/domain/payment"
import { InjectOrderEntityManager } from "@modules/platform/database"
import { ok } from "@modules/platform/primitives"
import type { Outcome } from "@modules/platform/primitives"
import { evaluateCheckout } from "./checkout.policy"
import { OrderError, OrderErrorCode } from "./errors/order.error"
import type {
    GetBuyerStatusResult,
    BuyerStatusParams,
    FindPlacedOrderParams,
    FindPlacedOrderResult,
    PlaceOrderParams,
    PlaceOrderRequest,
    PlacedOrder,
} from "./order.contracts"
import { OrderEntity } from "./persistence/entities/order.entity"
import { OrderLineEntity } from "./persistence/entities/order-line.entity"
import { toBuyerStatus, toOrderId } from "./persistence/order.rows"
import { ReceiptService } from "./receipt.service"
import type { OrderCountRow, OrderIdRow } from "./persistence/order.rows"
import { COUNT_PERSON_ORDERS, INSERT_ORDER_IF_NEW } from "./persistence/order.sql"

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
    ) {}

    /**
     * Confirms the cart of a person. A replayed key answers the first order; an empty cart, an unknown product or too
     * little stock is a refusal; otherwise the order, stock, payment and cart clear all happen in one transaction.
     */
    async placeOrder(request: PlaceOrderRequest): Promise<Outcome<PlacedOrder, OrderErrorCode>> {
        const { personId, idempotencyKey } = request
        if (idempotencyKey !== undefined) {
            const replay = await this.findPlaced({ personId, idempotencyKey })
            if (replay) return ok(replay)
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
        return ok(placed)
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
