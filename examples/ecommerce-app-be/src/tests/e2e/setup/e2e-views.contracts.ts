/** The response shapes the public doors answer with, as the specs read them. */

/** A catalog product as the cart query answers it. */
export interface ProductView {
    id: string
    name: string
    priceMinorUnits: number
    stock: number
}

/** One cart line. */
export interface CartLineView {
    productId: string
    quantity: number
}

/** The cart query data. */
export interface CartData {
    cart: { items: Array<CartLineView>; catalog: Array<ProductView> }
}

/** The placeOrder mutation data. */
export interface PlaceOrderData {
    placeOrder: {
        orderId: string
        status: string
        totalMinorUnits: number
        currency: string
        paymentId: string
        replayed: boolean
    }
}

/** The clearCart mutation data. */
export interface ClearCartData {
    clearCart: { cleared: boolean }
}

/** The account query data. */
export interface AccountData {
    account: { personId: string; email: string; hasOrders: boolean }
}

/** The buyerStatus query data. */
export interface BuyerStatusData {
    buyerStatus: { personId: string; hasOrders: boolean }
}

/** The register mutation data. */
export interface RegisterData {
    register: { personId: string }
}

/** The signIn mutation data. */
export interface SignInData {
    signIn: { sessionToken: string; personId: string }
}

/** The verifySession query data. */
export interface VerifySessionData {
    verifySession: { personId: string }
}

/** The revokeSession mutation data. */
export interface RevokeSessionData {
    revokeSession: { revoked: boolean }
}
