import { strict as assert } from "node:assert"
import { randomUUID } from "node:crypto"
import type { DynamicModule } from "@nestjs/common"
import { Test } from "@nestjs/testing"
import { DataSource } from "typeorm"
import type { EntityManager } from "typeorm"
import { createE2EGraphqlTransport } from "@starci-examples/e2e-kit/src/integrations/graphql/e2e-graphql-transport"
import type { GraphqlCallOptions, GraphqlObserved } from "@starci-examples/e2e-kit/src/integrations/graphql/graphql-envelope"
import { freePorts } from "@starci-examples/e2e-kit/src/platform/free-ports"
import { pollUntil } from "@starci-examples/e2e-kit/src/platform/poll"
import { accountEntities } from "@modules/domain/account"
import { cartEntities } from "@modules/domain/cart"
import { catalogEntities } from "@modules/domain/catalog"
import { orderEntities } from "@modules/domain/order"
import { paymentEntities } from "@modules/domain/payment"
import { EnvSource, Secret } from "@modules/platform/config"
import { IDENTITY_CONNECTION, ORDER_CONNECTION } from "@modules/platform/database"
import type { DatabaseConnectionOptions } from "@modules/platform/database"
import type { IdentityAppOptions } from "../../../apps/identity/src/identity.options"
import type { OrderAppOptions } from "../../../apps/order/src/order.options"
import type { RegisterData, SignInData } from "../fixtures/e2e-views.contracts"
import { RedisFakeService } from "./fakes/redis/redis-fake.service"

/** The operations the two apps answer, by the key a spec names them with. */
const DOCUMENTS = {
    register: "mutation Register($input: RegisterInput!) { register(request: $input) { personId } }",
    signIn: "mutation SignIn($input: SignInInput!) { signIn(request: $input) { sessionToken personId } }",
    verifySession: "query VerifySession($input: VerifySessionInput!) { verifySession(request: $input) { personId } }",
    revokeSession: "mutation RevokeSession($input: RevokeSessionInput!) { revokeSession(request: $input) { revoked } }",
    account: "query { account { personId email hasOrders } }",
    cart: "query { cart { items { productId quantity } catalog { id name priceMinorUnits stock } } }",
    addCartItem: "mutation AddCartItem($input: AddCartItemInput!) { addCartItem(request: $input) { item { productId quantity } } }",
    clearCart: "mutation { clearCart { cleared } }",
    placeOrder:
        "mutation PlaceOrder($input: PlaceOrderInput!) { placeOrder(request: $input) { orderId status totalMinorUnits currency paymentId replayed } }",
    buyerStatus: "query { buyerStatus { personId hasOrders } }",
}

/** The GraphQL door of one booted app: every call answers the observed envelope, so a refusal is data a spec asserts. */
export interface TestApi {
    /** Sends a query; `document` is a key of the operation registry or a document string. */
    read<TData>(document: string, options?: GraphqlCallOptions): Promise<GraphqlObserved<TData>>
    /** Sends a mutation. */
    mutate<TData>(document: string, options?: GraphqlCallOptions): Promise<GraphqlObserved<TData>>
}

/** The composition root of an app: its static `register` builds the root module from typed options. */
export interface TestAppModule<TOptions> {
    /** Builds the root module. */
    register(options: TOptions): DynamicModule
}

/** One app the spec boots: its real composition root and whether it listens. */
export interface TestAppSpec<TOptions> {
    /** The real `AppModule` of `apps/<app>`; the world calls its `register` with the typed options it wired. */
    readonly module: TestAppModule<TOptions>
    /** False boots the app without an HTTP listener; the default is true, which every app another app calls needs. */
    readonly listen?: boolean
}

/** The applications of the world, by name; the identity api and the order api call each other over real GraphQL. */
export interface TestApps {
    /** The identity api. */
    readonly identity: TestAppSpec<IdentityAppOptions>
    /** The order api. */
    readonly order: TestAppSpec<OrderAppOptions>
}

/** What a spec passes to `useTestWorld`. */
export interface TestWorldSpec {
    /** The applications to boot. */
    readonly apps: TestApps
}

/** One booted app. */
export interface TestAppHandle {
    /** The loopback base URL the app answers on. */
    readonly url: string
    /** Its GraphQL door. */
    readonly api: TestApi
}

/** The booted apps by name. */
export interface TestAppHandles {
    /** The identity api. */
    readonly identity: TestAppHandle
    /** The order api. */
    readonly order: TestAppHandle
}

/** The shared EntityManager of every database of the run, for out-of-band reads of persisted state. */
export interface TestDatabases {
    /** The identity database. */
    readonly identity: EntityManager
    /** The order database. */
    readonly order: EntityManager
}

/** The network fakes of the external services the apps call; first-party apps run for real. */
export interface TestFakes {
    /** The Redis provider behind the cache integration. */
    readonly redis: RedisFakeService
}

/** A person a spec registered and signed in. */
export interface TestSession {
    /** The person id. */
    readonly personId: string
    /** The email the person registered with. */
    readonly email: string
    /** The live bearer token. */
    readonly sessionToken: string
}

/** Test-account lifecycle through the public doors of the identity app. */
export interface TestAuth {
    /** Registers a person with a unique email and signs them in. */
    registerBuyer(tag: string, password: string): Promise<TestSession>
    /** Signs an existing person in. */
    signIn(email: string, password: string): Promise<TestSession>
}

/** What `useTestWorld` hands a spec; every member is readable once the world booted, that is inside `it` and hooks. */
export interface TestWorld {
    /** The booted apps by name. */
    readonly apps: TestAppHandles
    /** The databases of the run. */
    readonly db: TestDatabases
    /** The network fakes of external services. */
    readonly fake: TestFakes
    /** Test-account lifecycle. */
    readonly auth: TestAuth
    /** Polls `probe` until it answers a truthy value or the deadline passes; a flow waits for a state, never for a duration. */
    waitFor<TValue>(label: string, probe: () => Promise<TValue | null | undefined>): Promise<TValue>
}

interface Running {
    readonly world: TestWorld
    close(): Promise<void>
}

const transport = createE2EGraphqlTransport({ documents: DOCUMENTS })

const apiOf = (url: string): TestApi => ({
    read: (document, options) => transport.call(url, "query", document, options),
    mutate: (document, options) => transport.call(url, "mutate", document, options),
})

const authOf = (identity: TestApi): TestAuth => {
    const signIn = async (email: string, password: string): Promise<TestSession> => {
        const response = await identity.mutate<SignInData>("signIn", { variables: { input: { email, password } } })
        assert(response.data !== null, `signIn for ${email} answered ${response.errorCode}`)
        return { personId: response.data.signIn.personId, email, sessionToken: response.data.signIn.sessionToken }
    }
    return {
        signIn,
        registerBuyer: async (tag, password) => {
            const email = `e2e-${tag}-${randomUUID()}@ecommerce.dev`
            const registered = await identity.mutate<RegisterData>("register", { variables: { input: { email, password } } })
            assert(registered.data !== null, `register for ${email} answered ${registered.errorCode}`)
            return signIn(email, password)
        },
    }
}

const openDatabase = async (name: string, url: string, entities: DatabaseConnectionOptions["entities"]): Promise<DataSource> => {
    const dataSource = new DataSource({ type: "postgres", name, url, entities: [...entities], synchronize: false })
    await dataSource.initialize()
    return dataSource
}

const boot = async (spec: TestWorldSpec): Promise<Running> => {
    const env = EnvSource.fromProcess()
    const identityUrl = env.secret("TEST_WORLD_IDENTITY_DB_URL")
    const orderUrl = env.secret("TEST_WORLD_ORDER_DB_URL")
    const redis = await RedisFakeService.start()
    const [identityPort, orderPort] = await freePorts(2)
    assert(identityPort !== undefined && orderPort !== undefined, "no free loopback ports")
    const identityBase = `http://127.0.0.1:${identityPort}`
    const orderBase = `http://127.0.0.1:${orderPort}`
    const allowedOrigins = ["http://localhost:4069"]
    const rateLimit = { windowMs: 60_000, defaultLimit: 100_000, strictLimit: 100_000 }
    const identityModule = await Test.createTestingModule({
        imports: [
            spec.apps.identity.module.register({
                port: identityPort,
                database: { name: IDENTITY_CONNECTION, url: identityUrl },
                cache: { url: new Secret(redis.url) },
                orderApi: { url: orderBase, timeoutMs: 5000 },
                httpSecurity: { allowedOrigins, rateLimit },
            }),
        ],
    }).compile()
    const orderModule = await Test.createTestingModule({
        imports: [
            spec.apps.order.module.register({
                port: orderPort,
                database: { name: ORDER_CONNECTION, url: orderUrl },
                identityApi: { url: identityBase, timeoutMs: 5000 },
                httpSecurity: { allowedOrigins, rateLimit },
            }),
        ],
    }).compile()
    const identityApp = identityModule.createNestApplication()
    const orderApp = orderModule.createNestApplication()
    if (spec.apps.identity.listen !== false) await identityApp.listen(identityPort, "127.0.0.1")
    if (spec.apps.order.listen !== false) await orderApp.listen(orderPort, "127.0.0.1")
    const identityDb = await openDatabase(IDENTITY_CONNECTION, identityUrl.reveal(), accountEntities)
    const orderDb = await openDatabase(ORDER_CONNECTION, orderUrl.reveal(), [
        ...catalogEntities,
        ...cartEntities,
        ...orderEntities,
        ...paymentEntities,
    ])
    const identityApi = apiOf(identityBase)
    const world: TestWorld = {
        apps: { identity: { url: identityBase, api: identityApi }, order: { url: orderBase, api: apiOf(orderBase) } },
        db: { identity: identityDb.manager, order: orderDb.manager },
        fake: { redis },
        auth: authOf(identityApi),
        waitFor: (label, probe) => pollUntil(label, probe),
    }
    return {
        world,
        close: async () => {
            await Promise.all([identityApp.close(), orderApp.close()])
            await Promise.all([identityDb.destroy(), orderDb.destroy()])
            await redis.stop()
        },
    }
}

/**
 * The one test world of an e2e spec: boots the REAL apps of `spec` (identity and order, wired to each other through
 * typed options) in this process against the run's Postgres databases, with Redis answered by a network fake, and closes
 * them after the spec. Nothing is overridden in the DI container. Call it once at the top of a spec file.
 */
export const useTestWorld = (spec: TestWorldSpec): TestWorld => {
    let running: Running | undefined
    const live = (): TestWorld => {
        assert(running !== undefined, "the test world is not booted yet: read it inside a hook or an it")
        return running.world
    }
    beforeAll(async () => {
        running = await boot(spec)
    })
    afterAll(async () => {
        await running?.close()
    })
    return {
        apps: {
            get identity() {
                return live().apps.identity
            },
            get order() {
                return live().apps.order
            },
        },
        db: {
            get identity() {
                return live().db.identity
            },
            get order() {
                return live().db.order
            },
        },
        fake: {
            get redis() {
                return live().fake.redis
            },
        },
        auth: {
            registerBuyer: (tag, password) => live().auth.registerBuyer(tag, password),
            signIn: (email, password) => live().auth.signIn(email, password),
        },
        waitFor: (label, probe) => live().waitFor(label, probe),
    }
}
