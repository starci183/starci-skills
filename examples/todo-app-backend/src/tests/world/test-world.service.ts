/**
 * The ONE test world. `useTestWorld({ apps } | { modules })` registers `beforeAll`/`afterAll` and boots either the REAL apps
 * (`AppModule.register(testOptions)` of `apps/todo`, listening on an OS-allocated loopback port, and `apps/worker`, no
 * listener) or only the named capability modules over the platform database, in this process, against the shared
 * infrastructure the jest globalSetup started once (one migrated Postgres container and the network-edge fakes of every
 * third party). Both modes share this implementation: same options, same boot, same shutdown.
 *
 * Nothing first-party is ever replaced: no provider, guard, filter or module is overridden, so signing, parsing, retries and
 * the whole request pipeline of the app run for real; the only doubles are the servers in `fakes/`, reached over the wire.
 * No sleeps: an asynchronous effect is awaited with `waitFor` against persisted state or a fake.
 */
import "reflect-metadata"
import { pollUntil } from "@e2e-kit/platform/poll"
import { retryUntil } from "@e2e-kit/platform/readiness"
import { Module } from "@nestjs/common"
import type { DynamicModule, INestApplicationContext } from "@nestjs/common"
import { NestFactory } from "@nestjs/core"
import { CommandBus, QueryBus } from "@nestjs/cqrs"
import { getEntityManagerToken } from "@nestjs/typeorm"
import { randomUUID } from "node:crypto"
import type { Server } from "node:http"
import type { EntityManager } from "typeorm"
import { auditEntities } from "@modules/domain/audit"
import { notifyEntities } from "@modules/domain/notify"
import { planEntities } from "@modules/domain/plan"
import { recurEntities } from "@modules/domain/recur"
import { sessionEntities } from "@modules/domain/session"
import { shareEntities } from "@modules/domain/share"
import { taskEntities } from "@modules/domain/task"
import { uploadEntities } from "@modules/domain/upload"
import { ClockModule } from "@modules/platform/clock"
import { CqrsModule } from "@modules/platform/cqrs"
import { DatabaseModule, PRIMARY_CONNECTION } from "@modules/platform/database"
import { inboxEntities } from "@modules/platform/inbox"
import { leaseEntities } from "@modules/platform/lease"
import { LoggingModule } from "@modules/platform/logging"
import { outboxEntities } from "@modules/platform/outbox"
import { killContainer, postgresAccepts, startContainer } from "./docker.client"
import { createTestApi } from "./test-api.client"
import type { TestApi } from "./test-api.client"
import { testOptions } from "./test-apps.options"
import { createTestFakes } from "./test-fake.client"
import type { TestFakes } from "./test-fake.client"
import type {
    AppsWorldSpec,
    ModulesWorldSpec,
    SignedInPerson,
    TestApps,
    TestDb,
    TestModuleFactory,
    TestOptions,
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
const DATABASE_RETURN_DEADLINE_MS = 120_000
const NEST_LOGGER = ["error", "warn"] as const

/** Every entity of the connection: the modules world opens the same schema the apps use. */
const ALL_ENTITIES = [
    ...sessionEntities,
    ...taskEntities,
    ...shareEntities,
    ...planEntities,
    ...recurEntities,
    ...notifyEntities,
    ...auditEntities,
    ...uploadEntities,
    ...leaseEntities,
    ...inboxEntities,
    ...outboxEntities,
]

interface BootedApp {
    readonly context: INestApplicationContext
    readonly baseUrl: string | null
}

interface Runtime {
    readonly state: TestWorldState
    readonly contexts: ReadonlyArray<INestApplicationContext>
    readonly db: TestDb
    readonly fake: TestFakes
    readonly api: TestApi | null
    readonly workerBooted: boolean
    readonly buses: { readonly commandBus: CommandBus; readonly queryBus: QueryBus } | null
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
    new TestWorldError({ code: TestWorldErrorCode.NotDeclared, params: { detail: `${what} was not declared in useTestWorld` } })

/** The one boot both modes use: an app that listens, or a context with no transport. */
const boot = async (module: DynamicModule, options: TestOptions, listen: boolean): Promise<BootedApp> => {
    if (!listen) return { context: await NestFactory.createApplicationContext(module, { logger: [...NEST_LOGGER] }), baseUrl: null }
    const app = await NestFactory.create(module, { logger: [...NEST_LOGGER] })
    app.enableCors({ origin: [...options.httpSecurity.allowedOrigins] })
    await app.listen(0, "127.0.0.1")
    const server: Server = app.getHttpServer()
    const address = server.address()
    const port = typeof address === "object" && address !== null ? address.port : 0
    return { context: app, baseUrl: `http://127.0.0.1:${port}` }
}

const primaryOf = (context: INestApplicationContext): EntityManager =>
    context.get<EntityManager, EntityManager>(getEntityManagerToken(PRIMARY_CONNECTION), { strict: false })

const modulesRoot = (factories: ReadonlyArray<TestModuleFactory>, options: TestOptions): DynamicModule =>
    TestModulesRoot.register([
        ClockModule.register({ isGlobal: true }),
        LoggingModule.register({ isGlobal: true }),
        CqrsModule.register({ isGlobal: true }),
        DatabaseModule.register({
            isGlobal: true,
            connections: [{ ...options.database, entities: ALL_ENTITIES, migrations: [] }],
        }),
        ...factories.map((factory) => factory(options)),
    ])

/** The handle a spec holds: infrastructure coordinates hidden, every door and reader typed. */
export class TestWorld {
    private runtime: Runtime | null = null

    constructor(private readonly spec: TestWorldSpec) {}

    /** Boots the world; called by the `beforeAll` that `useTestWorld` registers. */
    async start(): Promise<void> {
        const state = readWorldState()
        const options = testOptions(state)
        this.runtime = "apps" in this.spec ? await this.startApps(this.spec, state, options) : await this.startModules(this.spec, state, options)
    }

    /** Closes every booted app, last booted first; called by the `afterAll` that `useTestWorld` registers. */
    async stop(): Promise<void> {
        const contexts = this.runtime?.contexts ?? []
        this.runtime = null
        const failures: Array<unknown> = []
        for (const context of [...contexts].reverse()) {
            try {
                await context.close()
            } catch (cause) {
                failures.push(cause)
            }
        }
        if (failures.length > 0) throw failures[0]
    }

    /** The apps of an apps world. */
    get apps(): TestApps {
        const runtime = this.booted()
        return {
            get todo() {
                if (runtime.api === null) throw notDeclared("apps.todo")
                return { api: runtime.api }
            },
            get worker() {
                if (!runtime.workerBooted) throw notDeclared("apps.worker")
                return { name: "worker" }
            },
        }
    }

    /** The shared entity manager of each connection. */
    get db(): TestDb {
        return this.booted().db
    }

    /** The fakes of the third parties, reached over the control channel. */
    get fake(): TestFakes {
        return this.booted().fake
    }

    /** The command bus of a modules world. */
    get commandBus(): CommandBus {
        return this.buses().commandBus
    }

    /** The query bus of a modules world. */
    get queryBus(): QueryBus {
        return this.buses().queryBus
    }

    /**
     * Polls `check` until it answers something truthy or the deadline passes; the failure names `label` and the last
     * observation. Use it for every asynchronous effect (an audit line, a notification, a mail, a recurrence task).
     */
    waitFor<T>(label: string, check: () => Promise<T | null | undefined>, options: WaitForOptions = {}): Promise<T> {
        return pollUntil(label, check, options.timeoutMs ?? DEFAULT_WAIT_MS, options.intervalMs ?? DEFAULT_POLL_MS)
    }

    /**
     * Kills the database container, runs `during` while it is down, then starts the same container again and waits until it
     * accepts connections: the outage a deployment sees when its database host crashes and comes back.
     */
    async interruptDatabase(during: () => Promise<void>): Promise<void> {
        const { databaseContainer, databaseUser, databaseName } = this.booted().state
        killContainer(databaseContainer)
        try {
            await during()
        } finally {
            startContainer(databaseContainer)
            await retryUntil("the database accepts connections again", DATABASE_RETURN_DEADLINE_MS, () =>
                Promise.resolve(postgresAccepts(databaseContainer, databaseUser, databaseName)),
            )
        }
    }

    /** Registers a new person at the identity provider fake and signs them in through the public door. */
    async signedInPerson(label: string): Promise<SignedInPerson> {
        const email = `${label}-${randomUUID()}@todo.dev`
        const password = `pw-${randomUUID()}`
        const personId = await this.fake.keycloak.person(email, password)
        const api = this.apps.todo.api
        const session = await api.signIn(email, password)
        return { email, password, personId, sessionToken: session.sessionToken, caller: api.as(session.sessionToken) }
    }

    private booted(): Runtime {
        if (this.runtime === null) throw new TestWorldError({ code: TestWorldErrorCode.NotBooted, params: { detail: "useTestWorld has not booted yet" } })
        return this.runtime
    }

    private buses(): { readonly commandBus: CommandBus; readonly queryBus: QueryBus } {
        const buses = this.booted().buses
        if (buses === null) throw notDeclared("the buses (a modules world only)")
        return buses
    }

    private async startApps(spec: AppsWorldSpec, state: TestWorldState, options: TestOptions): Promise<Runtime> {
        const { todo, worker } = spec.apps
        const contexts: Array<INestApplicationContext> = []
        let api: TestApi | null = null
        let baseUrl: string | null = null
        // The api boots first, so the worker finds its first messages only after the api can serve.
        if (todo !== undefined) {
            const app = await boot(todo.module.register(options), options, true)
            contexts.push(app.context)
            baseUrl = app.baseUrl
            api = baseUrl === null ? null : createTestApi(baseUrl)
        }
        if (worker !== undefined) contexts.push((await boot(worker.module.register(options), options, false)).context)
        const first = contexts[0]
        if (first === undefined) throw notDeclared("any app")
        return {
            state,
            contexts,
            db: { primary: primaryOf(first) },
            fake: createTestFakes(state.controlUrl, () => {
                if (baseUrl === null) throw notDeclared("apps.todo (the webhook target)")
                return baseUrl
            }),
            api,
            workerBooted: worker !== undefined,
            buses: null,
        }
    }

    private async startModules(spec: ModulesWorldSpec, state: TestWorldState, options: TestOptions): Promise<Runtime> {
        const app = await boot(modulesRoot(spec.modules, options), options, false)
        return {
            state,
            contexts: [app.context],
            db: { primary: primaryOf(app.context) },
            fake: createTestFakes(state.controlUrl, () => {
                throw notDeclared("apps.todo (a modules world has no api to call back)")
            }),
            api: null,
            workerBooted: false,
            buses: {
                commandBus: app.context.get(CommandBus, { strict: false }),
                queryBus: app.context.get(QueryBus, { strict: false }),
            },
        }
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
