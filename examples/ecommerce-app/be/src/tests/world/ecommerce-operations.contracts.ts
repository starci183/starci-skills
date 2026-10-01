/** The GraphQL documents the two apps answer, by the name a spec calls them with (`caller.read("cart")`). */
export const ECOMMERCE_OPERATIONS = {
    register: "mutation Register($input: RegisterInput!) { register(input: $input) { personId } }",
    signIn: "mutation SignIn($input: SignInInput!) { signIn(input: $input) { sessionToken personId } }",
    verifySession: "query VerifySession($input: VerifySessionInput!) { verifySession(input: $input) { personId } }",
    revokeSession: "mutation RevokeSession($input: RevokeSessionInput!) { revokeSession(input: $input) { revoked } }",
    account: "query { account { personId email hasOrders } }",
    cart: "query { cart { items { productId quantity } catalog { id name priceMinorUnits stock } } }",
    addCartItem:
        "mutation AddCartItem($input: AddCartItemInput!) { addCartItem(input: $input) { item { productId quantity } } }",
    clearCart: "mutation { clearCart { cleared } }",
    placeOrder:
        "mutation PlaceOrder($input: PlaceOrderInput!) { placeOrder(input: $input) { orderId status totalMinorUnits currency paymentId replayed } }",
    buyerStatus: "query { buyerStatus { personId hasOrders } }",
} as const
