import { CommandHandler } from "@nestjs/cqrs"
import { OrderStatusService } from "@modules/domain/order"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { PushOrderStatusCommand } from "./push-order-status.command"
import type { PushOrderStatusResult } from "./push-order-status.contracts"

@CommandHandler(PushOrderStatusCommand)
/** Pushes one status change of an order to its buyer; the order paid and order expired consumers send it for every delivered event. */
export class PushOrderStatusHandler extends ICQRSHandler<PushOrderStatusCommand, PushOrderStatusResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly statuses: OrderStatusService,
    ) {
        super(logger)
    }

    protected override process(command: PushOrderStatusCommand): Promise<PushOrderStatusResult> {
        this.statuses.push(command.params.request)
        return Promise.resolve()
    }
}
