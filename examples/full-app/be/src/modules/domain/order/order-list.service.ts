import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectOrderEntityManager, PAGE_SIZE_MAX } from "@modules/platform/database"
import { decodeCursor, ok, pageOf, refused } from "@modules/platform/primitives"
import { OrderErrorCode } from "./errors/order.error"
import type { ListOrdersParams, ListOrdersResult } from "./order-list.contracts"
import { InjectOrderOptions } from "./order.decorators"
import type { OrderOptions } from "./order.options"
import type { OrderListRow } from "./persistence/order.rows"
import { toOrderPosition, toOrderSummary } from "./persistence/order.rows"
import { LIST_PERSON_ORDERS } from "./persistence/order.sql"

@Injectable()
/**
 * Lists the orders of a person page by page, newest first. It trusts neither door: a page size outside 1..PAGE_SIZE_MAX and a
 * cursor it did not sign are refused here, because the REST operation door carries a typed body no pipe validates. The read
 * asks for one row more than the page, which only proves that a next page exists.
 */
export class OrderListService {
    constructor(
        @InjectOrderEntityManager() private readonly entityManager: EntityManager,
        @InjectOrderOptions() private readonly options: OrderOptions,
    ) {}

    /** One page of the orders of a person; a repeat of the same cursor answers the same page unless an order was placed meanwhile. */
    async list(params: ListOrdersParams): Promise<ListOrdersResult> {
        if (!Number.isInteger(params.first) || params.first < 1 || params.first > PAGE_SIZE_MAX) {
            return refused(OrderErrorCode.PageSizeInvalid, { max: PAGE_SIZE_MAX })
        }
        const key = this.options.pageCursorKey.reveal()
        const token = params.after ?? null
        const after = token === null ? null : decodeCursor(token, key)
        if (token !== null && after === null) return refused(OrderErrorCode.PageCursorInvalid)
        const rows: Array<OrderListRow> = await this.entityManager.query(LIST_PERSON_ORDERS, [
            params.personId,
            after?.sortValue ?? null,
            after?.id ?? null,
            params.first + 1,
        ])
        return ok(pageOf(rows, { first: params.first, key, positionOf: toOrderPosition, itemOf: toOrderSummary }))
    }
}
