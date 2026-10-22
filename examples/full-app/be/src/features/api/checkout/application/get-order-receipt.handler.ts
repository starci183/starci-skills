import { QueryHandler } from "@nestjs/cqrs"
import { ReceiptService } from "@modules/domain/order"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { GetOrderReceiptResult } from "./get-order-receipt.contracts"
import { GetOrderReceiptQuery } from "./get-order-receipt.query"

@QueryHandler(GetOrderReceiptQuery)
/** A download link of the caller's receipt; only the buyer of the order gets one. */
export class GetOrderReceiptHandler extends ICQRSHandler<GetOrderReceiptQuery, GetOrderReceiptResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly receipts: ReceiptService,
    ) {
        super(logger)
    }

    protected override process(query: GetOrderReceiptQuery): Promise<GetOrderReceiptResult> {
        return this.receipts.link({ personId: query.params.principal.id, orderId: query.params.request.orderId })
    }
}
