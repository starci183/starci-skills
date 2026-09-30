import { Query } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { GetCartRequest, GetCartResult } from "./get-cart.contracts"

/** Asks for the caller cart and the catalog it prices against. */
export class GetCartQuery extends Query<GetCartResult> {
    constructor(readonly params: ExecuteParams<GetCartRequest>) {
        super()
    }
}
