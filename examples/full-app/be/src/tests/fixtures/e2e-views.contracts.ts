/** The response shapes the public doors answer with, as the specs read them. */

/** A catalog product as the cart query answers it. */
export interface CatalogProductView {
    /** The SKU. */
    id: string
    /** The display name. */
    name: string
    /** The unit price in minor units. */
    priceMinorUnits: number
    /** How many units can still be sold. */
    stock: number
}

/** One cart line. */
export interface CartLineView {
    /** The SKU. */
    productId: string
    /** How many units. */
    quantity: number
}

/** The cart with the catalog it prices against. */
export interface CartView {
    /** The lines the caller holds. */
    items: Array<CartLineView>
    /** The products on sale. */
    catalog: Array<CatalogProductView>
}

/** The cart query data. */
export interface CartData {
    /** The `cart` field. */
    cart: CartView
}

/** A confirmed order as placeOrder answers it. */
export interface PlacedOrderView {
    /** The order id. */
    orderId: string
    /** The lifecycle state. */
    status: string
    /** The order total in minor units. */
    totalMinorUnits: number
    /** The currency. */
    currency: string
    /** True when the answer replays an earlier confirmation. */
    replayed: boolean
}

/** The placeOrder mutation data. */
export interface PlaceOrderData {
    /** The `placeOrder` field. */
    placeOrder: PlacedOrderView
}

/** A download link of an order's receipt. */
export interface OrderReceiptView {
    /** The presigned download URL. */
    url: string
    /** When the link stops working, ISO 8601. */
    expiresAt: string
}

/** The orderReceipt query data. */
export interface OrderReceiptData {
    /** The `orderReceipt` field. */
    orderReceipt: OrderReceiptView
}

/** One order as the orders list shows it. */
export interface OrderSummaryView {
    /** The order id. */
    orderId: string
    /** The lifecycle state. */
    status: string
    /** The order total in minor units. */
    totalMinorUnits: number
    /** The currency. */
    currency: string
    /** When the order was placed. */
    placedAt: string
}

/** Where a paginated list stands. */
export interface PageInfoView {
    /** The cursor to continue from; null for an empty page. */
    endCursor: string | null
    /** True when more items follow. */
    hasNextPage: boolean
}

/** One page of orders as the connection answers it. */
export interface OrderConnectionView {
    /** The orders of the page. */
    items: Array<OrderSummaryView>
    /** The cursor and whether a next page exists. */
    pageInfo: PageInfoView
}

/** The orders query data. */
export interface OrdersData {
    /** The `orders` field. */
    orders: OrderConnectionView
}

/** One page as the operation route answers it. */
export interface OrdersListPageView {
    /** The orders of the page. */
    items: Array<OrderSummaryView>
    /** The cursor to continue from; null for an empty page. */
    endCursor: string | null
    /** True when more items follow. */
    hasNextPage: boolean
}

/** The success half of an operation outcome. */
export interface OrdersListOkView {
    /** The discriminant. */
    kind: "ok"
    /** The page. */
    value: OrdersListPageView
}

/** The refusal half of an operation outcome. */
export interface OrdersListRefusedView {
    /** The discriminant. */
    kind: "refused"
    /** The declared refusal code. */
    code: string
}

/** The reply of the `orders.list@1` operation route: a page, or a declared refusal. */
export interface OrdersListReply {
    /** The operation answered. */
    operation: string
    /** The id the caller sent. */
    requestId: string
    /** The success value or the refusal. */
    outcome: OrdersListOkView | OrdersListRefusedView
}

/** One push of an order's status, as the subscription delivers it. */
export interface OrderStatusChangedView {
    /** The order. */
    orderId: string
    /** The state the order is in now. */
    status: string
    /** When the order entered that state, ISO 8601. */
    changedAt: string
}

/** The orderStatusChanged subscription data of one frame. */
export interface OrderStatusChangedData {
    /** The `orderStatusChanged` field. */
    orderStatusChanged: OrderStatusChangedView
}

/** The receipt document a download link answers. */
export interface ReceiptDocumentView {
    /** The order. */
    orderId: string
    /** The buyer. */
    personId: string
    /** The bought lines. */
    lines: Array<{ productId: string; quantity: number; unitPriceMinorUnits: number }>
    /** The total in minor units. */
    totalMinorUnits: number
}

/** The outcome of clearCart. */
export interface ClearedCartView {
    /** True when the cart was emptied. */
    cleared: boolean
}

/** The clearCart mutation data. */
export interface ClearCartData {
    /** The `clearCart` field. */
    clearCart: ClearedCartView
}

/** The account of the caller as the account query answers it. */
export interface AccountView {
    /** The person id. */
    personId: string
    /** The email. */
    email: string
    /** Whether the person has confirmed orders. */
    hasOrders: boolean
}

/** The account query data. */
export interface AccountData {
    /** The `account` field. */
    account: AccountView
}

/** Whether a person has confirmed orders, as buyerStatus answers it. */
export interface BuyerStatusView {
    /** The person id. */
    personId: string
    /** True when at least one order is confirmed. */
    hasOrders: boolean
}

/** The buyerStatus query data. */
export interface BuyerStatusData {
    /** The `buyerStatus` field. */
    buyerStatus: BuyerStatusView
}

/** The person register answers with. */
export interface RegisteredView {
    /** The person id. */
    personId: string
}

/** The register mutation data. */
export interface RegisterData {
    /** The `register` field. */
    register: RegisteredView
}

/** The session signIn answers with. */
export interface SignedInView {
    /** The opaque bearer token. */
    sessionToken: string
    /** The person id. */
    personId: string
}

/** The signIn mutation data. */
export interface SignInData {
    /** The `signIn` field. */
    signIn: SignedInView
}

/** The person verifySession answers with. */
export interface VerifiedView {
    /** The person id. */
    personId: string
}

/** The verifySession query data. */
export interface VerifySessionData {
    /** The `verifySession` field. */
    verifySession: VerifiedView
}

/** The data of the `verifyServiceSession` query, the service door the order and billing services call with their own key. */
export interface VerifyServiceSessionData {
    /** The `verifyServiceSession` field. */
    verifyServiceSession: VerifiedView
}

/** The outcome of revokeSession. */
export interface RevokedView {
    /** True when the session ended. */
    revoked: boolean
}

/** The revokeSession mutation data. */
export interface RevokeSessionData {
    /** The `revokeSession` field. */
    revokeSession: RevokedView
}
