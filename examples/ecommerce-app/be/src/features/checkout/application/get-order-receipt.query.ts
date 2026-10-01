import { Query } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { GetOrderReceiptRequest, GetOrderReceiptResult } from "./get-order-receipt.contracts"

/** Asks for a download link of the caller's receipt of one order. */
export class GetOrderReceiptQuery extends Query<GetOrderReceiptResult> {
    constructor(readonly params: ExecuteParams<GetOrderReceiptRequest>) {
        super()
    }
}
