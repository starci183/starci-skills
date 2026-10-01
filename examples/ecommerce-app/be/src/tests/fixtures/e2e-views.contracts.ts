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
    /** The captured payment. */
    paymentId: string
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
    /** The captured payment. */
    paymentId: string
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
