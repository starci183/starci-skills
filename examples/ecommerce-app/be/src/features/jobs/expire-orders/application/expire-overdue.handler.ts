import { CommandHandler } from "@nestjs/cqrs"
import { OrderPaymentService } from "@modules/domain/order"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ExpireOverdueCommand } from "./expire-overdue.command"
import type { ExpireOverdueResult } from "./expire-overdue.contracts"

@CommandHandler(ExpireOverdueCommand)
/** Expires the orders nobody paid in time; the order payment service moves them in one transaction and announces each. */
export class ExpireOverdueHandler extends ICQRSHandler<ExpireOverdueCommand, ExpireOverdueResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly payments: OrderPaymentService,
    ) {
        super(logger)
    }

    protected override process(command: ExpireOverdueCommand): Promise<ExpireOverdueResult> {
        return this.payments.expireOverdue(command.params.request)
    }
}
