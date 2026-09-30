import { QueryHandler } from "@nestjs/cqrs"
import { CheckoutService } from "@modules/domain/order"
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
        private readonly checkout: CheckoutService,
    ) {
        super(logger)
    }

    protected override process(query: GetCartQuery): Promise<GetCartResult> {
        return this.checkout.viewCart({ personId: query.params.principal.id })
    }
}
