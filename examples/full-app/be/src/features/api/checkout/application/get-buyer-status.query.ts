import { Query } from "@nestjs/cqrs"
import type { GetBuyerStatusResult } from "@modules/domain/order"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { GetBuyerStatusRequest } from "./get-buyer-status.contracts"

/** Asks whether the caller has confirmed orders; the identity service asks it, forwarding the caller bearer token. */
export class GetBuyerStatusQuery extends Query<GetBuyerStatusResult> {
    constructor(readonly params: ExecuteParams<GetBuyerStatusRequest>) {
        super()
    }
}
