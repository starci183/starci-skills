/** Public entry of the services module: the server-side readers and writers of the order and identity services. */
export { addCartItem, clearCart, readCart, type CartView } from "./cart"
export { fetchProducts, type Product } from "./catalog"
export { fetchCurrentUser, registerAccount, revokeSession, signInWithPassword, type CurrentUser } from "./identity"
export { placeOrder } from "./orders"
