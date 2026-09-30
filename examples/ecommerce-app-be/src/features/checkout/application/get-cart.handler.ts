import { QueryHandler } from "@nestjs/cqrs"
import { CartService } from "@modules/domain/cart"
import { CatalogService } from "@modules/domain/catalog"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { GetCartResult } from "./get-cart.contracts"
import { GetCartQuery } from "./get-cart.query"

@QueryHandler(GetCartQuery)
/** Reads the caller cart and the catalog it prices against. */
export class GetCartHandler extends ICQRSHandler<GetCartQuery, GetCartResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly cart: CartService,
        private readonly catalog: CatalogService,
    ) {
        super(logger)
    }

    protected override async process(query: GetCartQuery): Promise<GetCartResult> {
        const [items, catalog] = await Promise.all([
            this.cart.list({ personId: query.params.principal.id }),
            this.catalog.list(),
        ])
        return { items, catalog }
    }
}
