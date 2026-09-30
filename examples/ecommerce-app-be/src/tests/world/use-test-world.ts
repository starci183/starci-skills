/**
 * The ONE test world. `useTestWorld({ apps } | { modules })` registers `beforeAll`/`afterAll` and boots either the REAL apps
 * (`AppModule.register(testOptions)` of `apps/identity` and `apps/order`, each listening on an OS-allocated loopback port and
 * wired to the other through typed options) or only the named capability modules over the platform database, in this
 * process, against the shared infrastructure the jest globalSetup started once (the stack, one migrated database per
 * connection). Both modes share this implementation: same options, same boot, same shutdown.
 *
 * Nothing first-party is ever replaced: no provider, guard, filter or module is overridden, and nothing is faked: Postgres
 * and Redis are the real services of the repository's own stack (`.starcistacks/dev`), each behind a toxiproxy proxy, a
 * dependency is failed on purpose through `world.infra.<service>` (latency, cut, restore), never by killing it. No sleeps: an
 * asynchronous effect is awaited with `waitFor` against persisted state.
 */
import "reflect-metadata"
import { strict as assert } from "node:assert"
import { randomUUID } from "node:crypto"
import { Module } from "@nestjs/common"
import type { DynamicModule, INestApplicationContext, Type } from "@nestjs/common"
import { NestFactory } from "@nestjs/core"
import { DataSource } from "typeorm"
import { freePorts } from "@tests/world/kit/free-ports"
import { pollUntil } from "@tests/world/kit/poll"
import { accountEntities } from "@modules/domain/account"
import { cartEntities } from "@modules/domain/cart"
import { catalogEntities } from "@modules/domain/catalog"
import { orderEntities } from "@modules/domain/order"
import { paymentEntities } from "@modules/domain/payment"
import { ClockModule } from "@modules/platform/clock"
import { Secret } from "@modules/platform/config"
import { DatabaseModule, IDENTITY_CONNECTION, ORDER_CONNECTION } from "@modules/platform/database"
import type { DatabaseConnectionOptions } from "@modules/platform/database"
import { LoggingModule } from "@modules/platform/logging"
import type { RegisterData, SignInData } from "../fixtures/e2e-views.contracts"
import { cacheSize } from "./cache.client"
import { createInfraControl, resetInfra } from "./infra.client"
import { createTestApi } from "./test-api.client"
import type { TestApi } from "./test-api.client"
import type {
    AppsWorldSpec,
    ModulesWorldSpec,
    TestApps,
    TestCache,
    TestDb,
    TestInfra,
    TestSession,
    TestWiring,
    TestWorldSpec,
    WaitForOptions,
} from "./test-world.contracts"
import { TestWorldError, TestWorldErrorCode } from "./test-world.error"
import { readWorldState } from "./test-world-state.service"
import type { TestWorldState } from "./test-world-state.service"

const BOOT_TIMEOUT_MS = 240_000
const STOP_TIMEOUT_MS = 60_000
const DEFAULT_TEST_TIMEOUT_MS = 120_000
const DEFAULT_WAIT_MS = 30_000
const DEFAULT_POLL_MS = 250
const RATE_LIMIT_HIGH = 100_000
const CALL_DEADLINE_MS = 5000
const NEST_LOGGER = ["error", "warn"] as const

const IDENTITY_ENTITIES: DatabaseConnectionOptions["entities"] = accountEntities
const ORDER_ENTITIES: DatabaseConnectionOptions["entities"] = [
    ...catalogEntities,
    ...cartEntities,
    ...orderEntities,
    ...paymentEntities,
]

interface Runtime {
    readonly state: TestWorldState
    readonly contexts: ReadonlyArray<INestApplicationContext>
    readonly dataSources: ReadonlyArray<DataSource>
    readonly db: TestDb
    readonly infra: TestInfra
    readonly apis: { readonly identity: TestApi; readonly order: TestApi } | null
    readonly root: INestApplicationContext | null
}

@Module({})
/** The root of a modules world: the platform base plus the capability modules the spec asked for. */
class TestModulesRoot {
    /** Composes the root from its imports. */
    static register(imports: ReadonlyArray<DynamicModule>): DynamicModule {
        return { module: TestModulesRoot, imports: [...imports] }
    }
}

const notDeclared = (what: string): TestWorldError =>
    new TestWorldError({
        code: TestWorldErrorCode.NotDeclared,
        params: { detail: `${what} was not declared in useTestWorld` },
    })

const openDatabase = async (
    name: string,
    url: string,
    entities: DatabaseConnectionOptions["entities"],
): Promise<DataSource> => {
    const dataSource = new DataSource({ type: "postgres", name, url, entities: [...entities], synchronize: false })
    await dataSource.initialize()
    return dataSource
}

/** The handle a spec holds: infrastructure coordinates hidden, every door and reader typed. */
export class TestWorld {
    private runtime: Runtime | null = null

    constructor(private readonly spec: TestWorldSpec) {}

    /** Boots the world; called by the `beforeAll` that `useTestWorld` registers. */
    async start(): Promise<void> {
        const state = readWorldState()
        await resetInfra(state.stack)
        const identityDb = await openDatabase(IDENTITY_CONNECTION, state.identity.directUrl, IDENTITY_ENTITIES)
        const orderDb = await openDatabase(ORDER_CONNECTION, state.order.directUrl, ORDER_ENTITIES)
        const base = {
            state,
            dataSources: [identityDb, orderDb],
            db: { identity: identityDb.manager, order: orderDb.manager },
            infra: {
                postgres: createInfraControl(state.stack, "postgres"),
                redis: createInfraControl(state.stack, "redis"),
            },
        }
        this.runtime =
            "apps" in this.spec ? await this.startApps(this.spec, base) : await this.startModules(this.spec, base)
    }

    /** Closes every booted app, last booted first, then the readers, and puts every proxy back to normal; called by the `afterAll` of `useTestWorld`. */
    async stop(): Promise<void> {
        const runtime = this.runtime
        this.runtime = null
        if (runtime === null) return
        const closed = await Promise.allSettled([...runtime.contexts].reverse().map((context) => context.close()))
        await Promise.all(runtime.dataSources.map((dataSource) => dataSource.destroy()))
        await resetInfra(runtime.state.stack)
        const failed = closed.find((result) => result.status === "rejected")
        if (failed?.status === "rejected") {
            throw new TestWorldError({
                code: TestWorldErrorCode.InfrastructureFailed,
                params: { detail: "an app did not close" },
                cause: failed.reason,
            })
        }
    }

    /** The apps of an apps world. */
    get apps(): TestApps {
        const { apis } = this.booted()
        return {
            get identity() {
                if (apis === null) throw notDeclared("apps.identity")
                return { api: apis.identity }
            },
            get order() {
                if (apis === null) throw notDeclared("apps.order")
                return { api: apis.order }
            },
        }
    }

    /** The shared entity manager of each connection. */
    get db(): TestDb {
        return this.booted().db
    }

    /** The real services of the stack, each with `latency(ms)`, `cut()` and `restore()`. */
    get infra(): TestInfra {
        return this.booted().infra
    }

    /** What the world reads from the real Redis of the stack. */
    get cache(): TestCache {
        const { state } = this.booted()
        return { size: () => cacheSize(state.stack, state.runId) }
    }

    /** Resolves a provider of a modules world by its class. */
    resolve<TProvider>(token: Type<TProvider>): TProvider {
        const { root } = this.booted()
        if (root === null) throw notDeclared("modules (an apps world has no module root)")
        return root.get(token, { strict: false })
    }

    /**
     * Polls `check` until it answers something truthy or the deadline passes; the failure names `label` and the last
     * observation. Use it for every asynchronous effect.
     */
    waitFor<TValue>(
        label: string,
        check: () => Promise<TValue | null | undefined>,
        options: WaitForOptions = {},
    ): Promise<TValue> {
        return pollUntil(label, check, options.timeoutMs ?? DEFAULT_WAIT_MS, options.intervalMs ?? DEFAULT_POLL_MS)
    }

    /** Registers a new person through the public door of the identity app and signs them in. */
    async signedInPerson(label: string): Promise<TestSession> {
        const { identity } = this.apps
        const email = `e2e-${label}-${randomUUID()}@ecommerce.dev`
        const password = `pw-${randomUUID()}`
        const registered = await identity.api.mutate<RegisterData>("register", {
            variables: { input: { email, password } },
        })
        assert(registered.data !== null, `register for ${email} answered ${registered.errorCode}`)
        return this.signIn(email, password)
    }

    /** Signs an existing person in through the public door of the identity app. */
    async signIn(email: string, password: string): Promise<TestSession> {
        const signedIn = await this.apps.identity.api.mutate<SignInData>("signIn", {
            variables: { input: { email, password } },
        })
        assert(signedIn.data !== null, `signIn for ${email} answered ${signedIn.errorCode}`)
        return {
            personId: signedIn.data.signIn.personId,
            email,
            password,
            sessionToken: signedIn.data.signIn.sessionToken,
        }
    }

    private booted(): Runtime {
        if (this.runtime === null)
            throw new TestWorldError({
                code: TestWorldErrorCode.NotBooted,
                params: { detail: "useTestWorld has not booted yet" },
            })
        return this.runtime
    }

    private async startApps(spec: AppsWorldSpec, base: Omit<Runtime, "contexts" | "apis" | "root">): Promise<Runtime> {
        const { state } = base
        const [identityPort = 0, orderPort = 0] = await freePorts(2)
        const identityUrl = `http://127.0.0.1:${identityPort}`
        const orderUrl = `http://127.0.0.1:${orderPort}`
        const allowedOrigins = ["http://localhost:4069"]
        const rateLimit = { windowMs: 60_000, defaultLimit: RATE_LIMIT_HIGH, strictLimit: RATE_LIMIT_HIGH }
        const identityApp = await NestFactory.create(
            spec.apps.identity.module.register({
                port: identityPort,
                database: { name: IDENTITY_CONNECTION, url: new Secret(state.identity.url) },
                cache: { url: new Secret(state.cacheUrl) },
                orderApi: { url: orderUrl, timeoutMs: CALL_DEADLINE_MS },
                httpSecurity: { allowedOrigins, rateLimit },
            }),
            { logger: [...NEST_LOGGER] },
        )
        const orderApp = await NestFactory.create(
            spec.apps.order.module.register({
                port: orderPort,
                database: { name: ORDER_CONNECTION, url: new Secret(state.order.url) },
                identityApi: { url: identityUrl, timeoutMs: CALL_DEADLINE_MS },
                httpSecurity: { allowedOrigins, rateLimit },
            }),
            { logger: [...NEST_LOGGER] },
        )
        await identityApp.listen(identityPort, "127.0.0.1")
        await orderApp.listen(orderPort, "127.0.0.1")
        assert(
            portOf(identityApp) === identityPort && portOf(orderApp) === orderPort,
            "an app listens on another port than the one it was given",
        )
        return {
            ...base,
            contexts: [identityApp, orderApp],
            apis: { identity: createTestApi(identityUrl), order: createTestApi(orderUrl) },
            root: null,
        }
    }

    private async startModules(
        spec: ModulesWorldSpec,
        base: Omit<Runtime, "contexts" | "apis" | "root">,
    ): Promise<Runtime> {
        const { state } = base
        const wiring: TestWiring = {
            identityDatabaseUrl: new Secret(state.identity.url),
            orderDatabaseUrl: new Secret(state.order.url),
        }
        const root = await NestFactory.createApplicationContext(
            TestModulesRoot.register([
                ClockModule.register({ isGlobal: true }),
                LoggingModule.register({ isGlobal: true }),
                DatabaseModule.register({
                    isGlobal: true,
                    connections: [
                        {
                            name: IDENTITY_CONNECTION,
                            url: wiring.identityDatabaseUrl,
                            entities: IDENTITY_ENTITIES,
                            migrations: [],
                        },
                        {
                            name: ORDER_CONNECTION,
                            url: wiring.orderDatabaseUrl,
                            entities: ORDER_ENTITIES,
                            migrations: [],
                        },
                    ],
                }),
                ...spec.modules.map((factory) => factory(wiring)),
            ]),
            { logger: [...NEST_LOGGER] },
        )
        return { ...base, contexts: [root], apis: null, root }
    }
}

/** Registers the hooks that boot and close the world around the spec and answers the handle; call it inside `describe`. */
export const useTestWorld = (spec: TestWorldSpec): TestWorld => {
    jest.setTimeout(spec.testTimeoutMs ?? DEFAULT_TEST_TIMEOUT_MS)
    const world = new TestWorld(spec)
    beforeAll(() => world.start(), BOOT_TIMEOUT_MS)
    afterAll(() => world.stop(), STOP_TIMEOUT_MS)
    return world
}
