import {
    E2EAuthService, E2ESession 
} from "@tests/infra/bussiness/accounts/e2e-auth.service"
import {
    E2EGraphqlClient, E2EGraphqlService 
} from "@tests/infra/integrations/graphql/e2e-graphql.service"

/** Shared view types for the order-lifecycle lane: the response shapes the public doors answer with. */
export interface ProductView {
  id: string;
  name: string;
  priceMinorUnits: number;
  stock: number;
}

/** One cart line as the cart query answers it. */
export interface CartLineView {
  productId: string;
  quantity: number;
}

/** The cart query's answer: the buyer's items plus the full catalog snapshot it priced against. */
export interface CartPayload {
  items: Array<CartLineView>;
  catalog: Array<ProductView>;
}

/** The cart query's data envelope. */
export interface CartData { cart: CartPayload }

/** The placeOrder mutation's confirmation answer: ids, the captured total, and the replay flag. */
export interface PlaceOrderPayload {
  orderId: string;
  status: "confirmed";
  totalMinorUnits: number;
  currency: "USD";
  paymentId: string;
  replayed: boolean;
}

/** The placeOrder mutation's data envelope. */
export interface PlaceOrderData { placeOrder: PlaceOrderPayload }

/** The addCartItem mutation's payload: the merged cart line. */
export interface AddCartItemPayload { item: CartLineView }

/** The addCartItem mutation's data envelope. */
export interface AddCartItemData { addCartItem: AddCartItemPayload }

/** The account query's payload: the person joined with live buyer status. */
export interface AccountPayload { personId: string; email: string; hasOrders: boolean }

/** The account query's data envelope. */
export interface AccountData { account: AccountPayload }

/** A `SELECT COUNT(*)::int AS count` row for out-of-band persisted-state assertions. */
export interface CountRow {
  count: number;
}

/** The named-refusal body a machine REST door can still answer (401 SESSION_INVALID). */
export interface RefusalView {
  code?: string;
  reason?: string;
  productId?: string;
}

/** A per-buyer GraphQL door client: every operation it sends carries this session's bearer. */
export function buyerClient(graphql: E2EGraphqlService, sessionToken: string): E2EGraphqlClient {
    return graphql.client("order",
        {
            bearerToken: sessionToken 
        })
}

/** A fresh person per journey: unique email, registered and signed in through the public GraphQL doors. */
export async function registerBuyer(auth: E2EAuthService, tag: string, password: string): Promise<E2ESession> {
    const email = `e2e-${tag}-${Date.now()}-${Math.random().toString(36).slice(2,
        8)}@ecommerce.dev`
    await auth.register(email,
        password)
    return auth.signIn(email,
        password)
}
