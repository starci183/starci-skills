import { CommandHandler } from "@nestjs/cqrs"
import { CheckoutService } from "@modules/domain/order"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { ClearCartResult } from "./clear-cart.contracts"
import { ClearCartCommand } from "./clear-cart.command"

@CommandHandler(ClearCartCommand)
/** Empties the caller cart. */
export class ClearCartHandler extends ICQRSHandler<ClearCartCommand, ClearCartResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly checkout: CheckoutService,
    ) {
        super(logger)
    }

    protected override process(command: ClearCartCommand): Promise<ClearCartResult> {
        return this.checkout.emptyCart({ personId: command.params.principal.id })
    }
}
