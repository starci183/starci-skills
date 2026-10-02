import { IDENTITY_API_DOCUMENTS } from "@modules/integrations/identity-api"
import { ORDER_API_DOCUMENTS } from "@modules/integrations/order-api"

/** The GraphQL documents the two apps answer, by the name a spec calls them with (`caller.read("cart")`). */
export const ECOMMERCE_OPERATIONS = {
    register: "mutation Register($input: RegisterInput!) { register(input: $input) { personId } }",
    signIn: "mutation SignIn($input: SignInInput!) { signIn(input: $input) { sessionToken personId } }",
    verifySession: IDENTITY_API_DOCUMENTS.verifySession,
    revokeSession: "mutation RevokeSession($input: RevokeSessionInput!) { revokeSession(input: $input) { revoked } }",
    account: "query { account { personId email hasOrders } }",
    cart: "query { cart { items { productId quantity } catalog { id name priceMinorUnits stock } } }",
    addCartItem:
        "mutation AddCartItem($input: AddCartItemInput!) { addCartItem(input: $input) { item { productId quantity } } }",
    clearCart: "mutation { clearCart { cleared } }",
    placeOrder:
        "mutation PlaceOrder($input: PlaceOrderInput!) { placeOrder(input: $input) { orderId status totalMinorUnits currency replayed } }",
    buyerStatus: ORDER_API_DOCUMENTS.buyerStatus,
    orderReceipt: "query OrderReceipt($input: OrderReceiptInput!) { orderReceipt(input: $input) { url expiresAt } }",
    orderStatusChanged:
        "subscription OrderStatusChanged($input: OrderStatusInput!) { orderStatusChanged(input: $input) { orderId status changedAt } }",
} as const
