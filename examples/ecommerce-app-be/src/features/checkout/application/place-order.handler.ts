import { CommandHandler } from "@nestjs/cqrs"
import { EntityManager } from "typeorm"
import { CartService } from "@modules/domain/cart"
import { CatalogService } from "@modules/domain/catalog"
import { evaluateCheckout, OrderService } from "@modules/domain/order"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectOrderEntityManager } from "@modules/platform/database"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ok } from "@modules/platform/primitives"
import type { PlaceOrderResult } from "./place-order.contracts"
import { PlaceOrderCommand } from "./place-order.command"

@CommandHandler(PlaceOrderCommand)
/**
 * Confirms the caller cart. A replayed key answers the first order; otherwise the cart is priced against the catalog
 * and, when it can be confirmed, the order, stock, payment and cart clear all happen in one transaction, so a failure
 * anywhere leaves the buyer with the cart and no stock moved.
 */
export class PlaceOrderHandler extends ICQRSHandler<PlaceOrderCommand, PlaceOrderResult> {
    constructor(
        @InjectLogger() logger: Logger,
        @InjectOrderEntityManager() private readonly entityManager: EntityManager,
        private readonly cart: CartService,
        private readonly catalog: CatalogService,
        private readonly orders: OrderService,
    ) {
        super(logger)
    }

    protected override async process(command: PlaceOrderCommand): Promise<PlaceOrderResult> {
        const { request, principal } = command.params
        const personId = principal.id
        if (request.idempotencyKey !== undefined) {
            const replay = await this.orders.findPlaced({ personId, idempotencyKey: request.idempotencyKey })
            if (replay) return ok(replay)
        }
        const lines = await this.cart.list({ personId })
        const products = await this.catalog.byIds({ ids: lines.map((line) => line.productId) })
        const evaluation = evaluateCheckout(lines, products)
        if (evaluation.kind === "refused") return evaluation
        const placed = await this.entityManager.transaction((manager) =>
            this.orders.place({ manager, personId, plan: evaluation.value, idempotencyKey: request.idempotencyKey }),
        )
        return ok(placed)
    }
}
