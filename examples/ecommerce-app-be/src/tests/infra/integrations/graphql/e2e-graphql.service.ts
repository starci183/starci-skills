import {
    createE2EGraphqlTransport,
    E2EGraphqlClient,
    E2EGraphqlClientOptions,
    E2EGraphqlTransport,
} from "@e2e-kit/integrations/graphql/e2e-graphql-transport"
import {
    Injectable 
} from "@nestjs/common"
import {
    E2EServiceName, E2EStackService 
} from "../../platform/stack/e2e-stack.service"

/**
 * The public transport contract, and nothing else. Every user-facing call is one GraphQL
 * operation over HTTP to a service's single /graphql door with a {query, variables} body - the
 * canonical home for the JSON API the retired REST doors used to answer. Only the justified
 * machine/probe REST doors (/health, /internal/*) still ride the axios client. No spec imports a
 * service class, a repository or an entity; preconditions are created by the public operations
 * that create them.
 *
 * These are the operations the resolvers under src/features/{identity,checkout}/graphql
 * actually register: the identity service answers register/signIn/account, the order service
 * answers cart/addCartItem/clearCart/placeOrder.
 */
export const GRAPHQL_DOCUMENTS = {
    register: "mutation Register($input: RegisterInput!) { register(input: $input) { personId } }",
    signIn: "mutation SignIn($input: SignInInput!) { signIn(input: $input) { sessionToken personId } }",
    account: "query Account($personId: ID!) { account(personId: $personId) { personId email hasOrders } }",
    cart: "query { cart { items { productId quantity } catalog { id name priceMinorUnits stock } } }",
    addCartItem: "mutation AddCartItem($input: AddCartItemInput!) { addCartItem(input: $input) { item { productId quantity } } }",
    clearCart: "mutation { clearCart { cleared } }",
    placeOrder: "mutation PlaceOrder($input: PlaceOrderInput!) { placeOrder(input: $input) { orderId status totalMinorUnits currency paymentId replayed } }",
} as const

/** The registry key of a frozen GraphQL document - what a spec passes instead of a raw string. */
export type GraphqlDocumentName = keyof typeof GRAPHQL_DOCUMENTS;

/* Compat re-exports: the envelope and per-door client contracts moved to the shared @e2e-kit
 * package. Specs still importing them from this service keep resolving; the e2e spec lane owns
 * repointing at the kit paths. */
export type {
    GraphqlCallOptions, GraphqlErrorObserved, GraphqlObserved 
} from "@e2e-kit/integrations/graphql/graphql-envelope"
export type {
    E2EGraphqlClient, E2EGraphqlClientOptions 
} from "@e2e-kit/integrations/graphql/e2e-graphql-transport"

@Injectable()
/**
 * The apps' public surface is GraphQL, so the specs get a real GraphQL client, not only the raw
 * HTTP door: one ApolloClient per (service, identity) pair - this stack runs TWO apis, so the
 * client cache keys on the service's baseUrl as well as the bearer - pointed at the run-owned
 * api's /graphql endpoint. `query`/`mutate` take a DocumentNode (or a GRAPHQL_DOCUMENTS key / raw
 * document string) and answer with the same GraphqlObserved envelope todo's door produces, so
 * refusals stay assertions rather than thrown exceptions. The client mechanics live in the shared
 * @e2e-kit transport; this service only binds it to this run's endpoints and this app's registry.
 */
export class E2EGraphqlService {
    private readonly transport: E2EGraphqlTransport = createE2EGraphqlTransport({
        documents: GRAPHQL_DOCUMENTS 
    })

    constructor(private readonly stack: E2EStackService) {}

    /** A client bound to one spawned api - `identity` or `order` - optionally carrying a bearer. */
    client(service: E2EServiceName, options: E2EGraphqlClientOptions = {
    }): E2EGraphqlClient {
        return this.transport.client(this.stack.endpoint(service).baseUrl,
            options)
    }
}
