import { Injectable } from "@nestjs/common"
import { EntityManager } from "typeorm"
import { CartService } from "@modules/domain/cart"
import type { CartLine } from "@modules/domain/cart"
import { CatalogService } from "@modules/domain/catalog"
import { InjectOrderEntityManager } from "@modules/platform/database"
import { ok, refused } from "@modules/platform/primitives"
import type { Outcome } from "@modules/platform/primitives"
import { OrderErrorCode } from "./errors/order.error"
import type { AddToCartParams, CartView, EmptyCartParams, ViewCartParams } from "./order.contracts"

@Injectable()
/** The cart side of checkout: what a person holds, adding a catalog product to it and emptying it, each write in one transaction. */
export class CheckoutService {
    constructor(
        @InjectOrderEntityManager() private readonly entityManager: EntityManager,
        private readonly cart: CartService,
        private readonly catalog: CatalogService,
    ) {}

    /** The cart lines of a person and the catalog they price against. */
    async viewCart(params: ViewCartParams): Promise<CartView> {
        const [items, catalog] = await Promise.all([this.cart.list({ personId: params.personId }), this.catalog.list()])
        return { items, catalog }
    }

    /** Adds units of a product the catalog has; an unknown product is a refusal and nothing is written. */
    async addToCart(params: AddToCartParams): Promise<Outcome<CartLine, OrderErrorCode.UnknownProduct>> {
        const products = await this.catalog.byIds({ ids: [params.productId] })
        if (!products[params.productId]) return refused(OrderErrorCode.UnknownProduct, { productId: params.productId })
        const line = await this.entityManager.transaction((manager) =>
            this.cart.add({
                manager,
                personId: params.personId,
                productId: params.productId,
                quantity: params.quantity,
            }),
        )
        return ok(line)
    }

    /** Empties the cart of a person. */
    async emptyCart(params: EmptyCartParams): Promise<void> {
        await this.entityManager.transaction((manager) => this.cart.clear({ manager, personId: params.personId }))
    }
}
