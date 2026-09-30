/**
 * The transport client of a listening app: the same doors a real client uses. GraphQL operations go to `/graphql` with the
 * session as a bearer token; REST probes (`/health`) go through the same HTTP client. A refusal is data: every call resolves
 * with the status, the body and, for GraphQL, the declared error code.
 */
import { createE2EHttpClient } from "@tests/world/kit/e2e-http-client"
import type { E2EHttpClient, E2EResponse } from "@tests/world/kit/e2e-http-client"
import { graphqlEnvelopeOf } from "@tests/world/kit/graphql-envelope"
import { worldClock } from "@tests/world/kit/world-clock"
import type { GraphqlObserved, GraphqlWire } from "@tests/world/kit/graphql-envelope"

const CALL_TIMEOUT_MS = 20_000

/** The operations the two apps answer, by the key a spec names them with. */
const DOCUMENTS = new Map<string, string>([
    ["register", "mutation Register($input: RegisterInput!) { register(request: $input) { personId } }"],
    ["signIn", "mutation SignIn($input: SignInInput!) { signIn(request: $input) { sessionToken personId } }"],
    [
        "verifySession",
        "query VerifySession($input: VerifySessionInput!) { verifySession(request: $input) { personId } }",
    ],
    [
        "revokeSession",
        "mutation RevokeSession($input: RevokeSessionInput!) { revokeSession(request: $input) { revoked } }",
    ],
    ["account", "query { account { personId email hasOrders } }"],
    ["cart", "query { cart { items { productId quantity } catalog { id name priceMinorUnits stock } } }"],
    [
        "addCartItem",
        "mutation AddCartItem($input: AddCartItemInput!) { addCartItem(request: $input) { item { productId quantity } } }",
    ],
    ["clearCart", "mutation { clearCart { cleared } }"],
    [
        "placeOrder",
        "mutation PlaceOrder($input: PlaceOrderInput!) { placeOrder(request: $input) { orderId status totalMinorUnits currency paymentId replayed } }",
    ],
    ["buyerStatus", "query { buyerStatus { personId hasOrders } }"],
])

/** The knobs of one GraphQL call: the operation's variables. */
export interface GraphqlCallOptions {
    /** The variables of the operation. */
    readonly variables?: Record<string, unknown>
}

/** The GraphQL door of one booted app: every call answers the observed envelope, so a refusal is data a spec asserts. */
export interface TestApi {
    /** The loopback base URL the app listens on. */
    readonly baseUrl: string
    /** Sends a query; `document` is a key of the operation registry or a document string. */
    read<TData>(document: string, options?: GraphqlCallOptions): Promise<GraphqlObserved<TData>>
    /** Sends a mutation. */
    mutate<TData>(document: string, options?: GraphqlCallOptions): Promise<GraphqlObserved<TData>>
    /** A REST GET, for the probes. */
    get<TBody>(path: string): Promise<E2EResponse<TBody>>
    /** The same door with every call riding on `token`; without a token every call is anonymous. */
    bearing(token?: string): TestApi
}

const send = async <TData>(
    http: E2EHttpClient,
    document: string,
    variables?: Record<string, unknown>,
): Promise<GraphqlObserved<TData>> => {
    const startedAt = worldClock.now().getTime()
    const response = await http.post<GraphqlWire<TData> | string>("/graphql", {
        query: DOCUMENTS.get(document) ?? document,
        variables: variables ?? {},
    })
    return graphqlEnvelopeOf<TData>(response.status, response.body, startedAt)
}

/** Builds the api client of the app listening at `baseUrl`, optionally riding on a bearer token. */
export const createTestApi = (baseUrl: string, token?: string): TestApi => {
    const http = createE2EHttpClient({ baseUrl, bearerToken: token, timeoutMs: CALL_TIMEOUT_MS })
    return {
        baseUrl,
        read: (document, options) => send(http, document, options?.variables),
        mutate: (document, options) => send(http, document, options?.variables),
        get: (path) => http.get(path),
        bearing: (bearer) => createTestApi(baseUrl, bearer),
    }
}
