import type { ListOrdersAsk, OrderPage } from "@modules/domain/order"
import type { OrdersType } from "./dto/orders.type"
import type { PageArgs } from "./dto/page.args"

/** Maps the page arguments to the query request. */
export const toListOrdersRequest = (page: PageArgs): ListOrdersAsk => ({ ...page })

/** Maps the page of orders to the connection the schema answers. */
export const toOrdersType = (page: OrderPage): OrdersType => ({
    items: page.items.map((order) => ({ ...order })),
    pageInfo: { endCursor: page.endCursor, hasNextPage: page.hasNextPage },
})
