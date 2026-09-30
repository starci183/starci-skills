import { createE2EGraphqlTransport } from "@e2e-kit/integrations/graphql/e2e-graphql-transport"
import type { GraphqlCallOptions, GraphqlObserved } from "@e2e-kit/integrations/graphql/graphql-envelope"
import type { E2EStack, E2EServiceName } from "./e2e-stack.service"

/**
 * The public transport contract and nothing else: every user-facing call is one GraphQL operation to a service single
 * /graphql door. These are the operations the resolvers under src/features/{identity,checkout}/transport/graphql
 * register: the identity service answers register, signIn, verifySession, revokeSession and account; the order service
 * answers cart, addCartItem, clearCart, placeOrder and buyerStatus.
 */
export const GRAPHQL_DOCUMENTS = {
    register: "mutation Register($input: RegisterInput!) { register(input: $input) { personId } }",
    signIn: "mutation SignIn($input: SignInInput!) { signIn(input: $input) { sessionToken personId } }",
    verifySession: "query VerifySession($input: VerifySessionInput!) { verifySession(input: $input) { personId } }",
    revokeSession: "mutation RevokeSession($input: RevokeSessionInput!) { revokeSession(input: $input) { revoked } }",
    account: "query { account { personId email hasOrders } }",
    cart: "query { cart { items { productId quantity } catalog { id name priceMinorUnits stock } } }",
    addCartItem: "mutation AddCartItem($input: AddCartItemInput!) { addCartItem(input: $input) { item { productId quantity } } }",
    clearCart: "mutation { clearCart { cleared } }",
    placeOrder:
        "mutation PlaceOrder($input: PlaceOrderInput!) { placeOrder(input: $input) { orderId status totalMinorUnits currency paymentId replayed } }",
    buyerStatus: "query { buyerStatus { personId hasOrders } }",
}

/** The GraphQL handle a spec drives: reads and mutations answer an observed envelope, so a refusal is data a spec asserts. */
export interface E2EGraphqlHandle {
    /** Sends a query: `document` is a key of GRAPHQL_DOCUMENTS or a document string. */
    read<TData>(document: string, options?: GraphqlCallOptions): Promise<GraphqlObserved<TData>>
    /** Sends a mutation. */
    mutate<TData>(document: string, options?: GraphqlCallOptions): Promise<GraphqlObserved<TData>>
}

/** One GraphQL client per (service, bearer) pair, bound to the ports this run allocated. */
export class E2EGraphql {
    private readonly transport = createE2EGraphqlTransport({ documents: GRAPHQL_DOCUMENTS })

    constructor(private readonly stack: E2EStack) {}

    /** A client bound to one spawned api, optionally carrying a bearer token; omitting it makes every call anonymous. */
    client(service: E2EServiceName, bearerToken?: string): E2EGraphqlHandle {
        const { baseUrl } = this.stack.endpoint(service)
        return {
            read: (document, callOptions) => this.transport.call(baseUrl, "query", document, { ...callOptions, token: bearerToken }),
            mutate: (document, callOptions) => this.transport.call(baseUrl, "mutate", document, { ...callOptions, token: bearerToken }),
        }
    }
}
