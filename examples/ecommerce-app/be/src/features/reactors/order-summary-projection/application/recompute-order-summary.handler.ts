import { CommandHandler } from "@nestjs/cqrs"
import { OrderSummaryProjection } from "@modules/projections/order-summary"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { RecomputeOrderSummaryCommand } from "./recompute-order-summary.command"

@CommandHandler(RecomputeOrderSummaryCommand)
/** Recomputes the summary of one order; the order placed, order paid and order expired consumers send it for every delivered event. */
export class RecomputeOrderSummaryHandler extends ICQRSHandler<RecomputeOrderSummaryCommand, void> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly projection: OrderSummaryProjection,
    ) {
        super(logger)
    }

    protected override process(command: RecomputeOrderSummaryCommand): Promise<void> {
        return this.projection.recomputeOrderSummary(command.params.request.orderId)
    }
}
