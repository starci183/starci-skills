import { Injectable } from "@nestjs/common"
import type { CommandBus } from "@nestjs/cqrs"
import { InjectCommandBus } from "@modules/platform/cqrs"
import { CancelOrderCommand } from "../../application/cancel-order.command"

@Injectable()
/** The compensation of the reserve-order step: cancels the order, releases the stock of its lines and refunds its payment. */
export class ReserveOrderCompensation {
    /** The step this compensation undoes. */
    readonly step = "reserve-order"

    /** The event that tells the saga to run this compensation (the contract `be/contracts/billing/events.json`, which says it compensates `order.placed`). */
    readonly event = "billing.invoice-rejected"

    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Dispatches the one command of the compensation. */
    async run(orderId: string): Promise<void> {
        await this.commandBus.execute(new CancelOrderCommand({ request: { orderId } }))
    }
}
