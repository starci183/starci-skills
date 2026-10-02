// Imports the host resolves:
//   import { CommandHandler } from "@nestjs/cqrs"
//   import { ICQRSHandler } from "@modules/platform/cqrs"
//   import { CheckoutService } from "@modules/domain/order"
//   import { StartCheckoutCommand } from "./start-checkout.command"

@CommandHandler(StartCheckoutCommand)
/** Starts a checkout: the domain service of the order context does the work in one transaction. */
export class StartCheckoutHandler extends ICQRSHandler<StartCheckoutCommand, StartCheckoutResult> {
    constructor(private readonly checkout: CheckoutService) {
        super()
    }

    /** Takes the principal the command carries, then delegates. */
    protected async process({ params }: StartCheckoutCommand): Promise<StartCheckoutResult> {
        return this.checkout.start(params.principal.personId, params.request)
    }
}
