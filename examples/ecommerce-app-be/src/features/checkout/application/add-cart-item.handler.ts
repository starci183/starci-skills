import { CommandHandler } from "@nestjs/cqrs"
import { CheckoutService } from "@modules/domain/order"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { AddCartItemResult } from "./add-cart-item.contracts"
import { AddCartItemCommand } from "./add-cart-item.command"

@CommandHandler(AddCartItemCommand)
/** Adds units to the caller cart; the checkout service checks the catalog and writes in one transaction. */
export class AddCartItemHandler extends ICQRSHandler<AddCartItemCommand, AddCartItemResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly checkout: CheckoutService,
    ) {
        super(logger)
    }

    protected override process(command: AddCartItemCommand): Promise<AddCartItemResult> {
        const { request, principal } = command.params
        return this.checkout.addToCart({
            personId: principal.id,
            productId: request.productId,
            quantity: request.quantity,
        })
    }
}
