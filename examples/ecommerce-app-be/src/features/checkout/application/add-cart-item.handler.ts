import { CommandHandler } from "@nestjs/cqrs"
import { EntityManager } from "typeorm"
import { CartService } from "@modules/domain/cart"
import { CatalogService } from "@modules/domain/catalog"
import { OrderErrorCode } from "@modules/domain/order"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectOrderEntityManager } from "@modules/platform/database"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ok, refused } from "@modules/platform/primitives"
import type { AddCartItemResult } from "./add-cart-item.contracts"
import { AddCartItemCommand } from "./add-cart-item.command"

@CommandHandler(AddCartItemCommand)
/** Adds units to the caller cart after checking the catalog has the product; the write runs in one transaction. */
export class AddCartItemHandler extends ICQRSHandler<AddCartItemCommand, AddCartItemResult> {
    constructor(
        @InjectLogger() logger: Logger,
        @InjectOrderEntityManager() private readonly entityManager: EntityManager,
        private readonly catalog: CatalogService,
        private readonly cart: CartService,
    ) {
        super(logger)
    }

    protected override async process(command: AddCartItemCommand): Promise<AddCartItemResult> {
        const { request, principal } = command.params
        const products = await this.catalog.byIds({ ids: [request.productId] })
        if (!products[request.productId]) return refused(OrderErrorCode.UnknownProduct, { productId: request.productId })
        const line = await this.entityManager.transaction((manager) =>
            this.cart.add({ manager, personId: principal.id, productId: request.productId, quantity: request.quantity }),
        )
        return ok(line)
    }
}
