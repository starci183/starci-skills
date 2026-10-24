import { defineOperations, query } from "@modules/platform/operations"
import type { OrderErrorCode } from "./errors/order.error"
import type { ListOrdersAsk, OrderPage } from "./order-list.contracts"

/**
 * The versioned operations the order api serves over its one operation route, declared once. A feature cannot import an app
 * and a feature's contracts hold no call, so the table is declared by the capability that owns the operations and
 * `apps/order/src/operations.ts` exports it as the app's table.
 */
export const OPERATIONS = defineOperations({
    "orders.list@1": query<
        ListOrdersAsk,
        OrderPage,
        OrderErrorCode.PageSizeInvalid | OrderErrorCode.PageCursorInvalid
    >(),
})
