import { Query } from "@nestjs/cqrs"
import type { ListOrdersAsk, ListOrdersResult } from "@modules/domain/order"
import type { ExecuteParams } from "@modules/platform/cqrs"

/** Asks for one page of the caller's orders, newest first. */
export class ListOrdersQuery extends Query<ListOrdersResult> {
    constructor(readonly params: ExecuteParams<ListOrdersAsk>) {
        super()
    }
}
