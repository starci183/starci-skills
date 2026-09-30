/**
 * The ONE test world. `useTestWorld({ apps })` registers `beforeAll`/`afterAll` and boots the REAL apps
 * (`AppModule.register(testOptions)` of `apps/todo`, listening on an OS-allocated loopback port, and `apps/worker`, no
 * listener) in this process, against the shared infrastructure the jest globalSetup started once (one migrated Postgres
 * container and the network-edge fakes of every third party).
 *
 * Nothing first-party is ever replaced: no provider, guard, filter or module is overridden, so signing, parsing, retries and
 * the whole request pipeline of the app run for real; the only doubles are the servers in `fakes/`, reached over the wire.
 * No sleeps: an asynchronous effect is awaited with `waitFor` against persisted state or a fake.
 */
import "reflect-metadata"
import { pollUntil } from "@tests/world/kit/poll"
import { retryUntil } from "@tests/world/kit/readiness"
import type { INestApplicationContext } from "@nestjs/common"
import { NestFactory } from "@nestjs/core"
import { randomUUID } from "node:crypto"
import { DataSource } from "typeorm"
import { killContainer, postgresAccepts, startContainer } from "./docker.client"
import { createTestApi } from "./test-api.client"
import type { TestApi } from "./test-api.client"
import { testOptions } from "./test-apps.options"
import { createTestFakes } from "./test-fake.client"
import type { TestFakes } from "./test-fake.client"
import type {
    AppsWorldSpec,
    SignedInPerson,
    TestApps,
    TestDb,
    TestOptions,
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

interface BootedApp {
    readonly context: INestApplicationContext
    readonly baseUrl: string | null
}

interface Runtime {
    readonly state: TestWorldState
    readonly contexts: ReadonlyArray<INestApplicationContext>
    readonly dataSource: DataSource
    readonly db: TestDb
    readonly fake: TestFakes
    readonly api: TestApi | null
    readonly workerBooted: boolean
}

const notDeclared = (what: string): TestWorldError =>
    new TestWorldError({
        code: TestWorldErrorCode.NotDeclared,
        params: { detail: `${what} was not declared in useTestWorld` },
    })

/** The one boot both modes use: an app that listens, or a context with no transport. */
const boot = async (module: DynamicModule, options: TestOptions, listen: boolean): Promise<BootedApp> => {
    if (!listen)
        return {
            context: await NestFactory.createApplicationContext(module, { logger: [...NEST_LOGGER] }),
            baseUrl: null,
        }
    const app = await NestFactory.create(module, { logger: [...NEST_LOGGER] })
    app.enableCors({ origin: [...options.httpSecurity.allowedOrigins] })
    await app.listen(0, "127.0.0.1")
    return { context: app, baseUrl: await app.getUrl() }
}

/** The world's own handle on the migrated database: the shared entity manager a spec reads persisted state through. */
const openDatabase = (state: TestWorldState): Promise<DataSource> =>
    new DataSource({ type: "postgres", url: state.databaseUrl, synchronize: false }).initialize()

/** Closes one context; answers the failure instead of throwing, so every context gets its turn. */
const closeContext = async (context: INestApplicationContext): Promise<unknown> => {
    try {
        await context.close()
        return null
    } catch (cause) {
        return cause
    }
}

/** The handle a spec holds: infrastructure coordinates hidden, every door and reader typed. */
export class TestWorld {
    private runtime: Runtime | null = null

    constructor(private readonly spec: AppsWorldSpec) {}

    /** Boots the world; called by the `beforeAll` that `useTestWorld` registers. */
    async start(): Promise<void> {
        const state = readWorldState()
        const options = testOptions(state)
        this.runtime = await this.startApps(this.spec, state, options)
    }

    /** Closes every booted app, last booted first; called by the `afterAll` that `useTestWorld` registers. */
    async stop(): Promise<void> {
        const contexts = this.runtime?.contexts ?? []
        const dataSource = this.runtime?.dataSource
        this.runtime = null
        const failures: Array<unknown> = []
        for (const context of [...contexts].reverse()) {
            const failure = await closeContext(context)
            if (failure !== null) failures.push(failure)
        }
        if (dataSource?.isInitialized === true) await dataSource.destroy()
        const [first] = failures
        if (first !== undefined) {
            throw new TestWorldError({
                code: TestWorldErrorCode.InfrastructureFailed,
                params: { detail: "an app context failed to close" },
                cause: first,
            })
        }
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

    /**
     * Polls `check` until it answers something truthy or the deadline passes; the failure names `label` and the last
     * observation. Use it for every asynchronous effect (an audit line, a notification, a mail, a recurrence task).
     */
    waitFor<T>(label: string, check: () => Promise<T | null | undefined>, options: WaitForOptions = {}): Promise<T> {
        return pollUntil(label, check, options.timeoutMs ?? DEFAULT_WAIT_MS, options.intervalMs ?? DEFAULT_POLL_MS)
    }

    /**
     * Polls `observe` until `ready` accepts what it saw, and answers that observation; the failure names `label` and the
     * last observation. The spec states the state it waits for as a predicate, so the step itself holds no branch.
     */
    async waitUntil<T>(
        label: string,
        observe: () => Promise<T>,
        ready: (observed: T) => boolean,
        options: WaitForOptions = {},
    ): Promise<T> {
        const seen = await this.waitFor(
            label,
            async () => {
                const observed = await observe()
                return ready(observed) ? { observed } : null
            },
            options,
        )
        return seen.observed
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
        if (this.runtime === null)
            throw new TestWorldError({
                code: TestWorldErrorCode.NotBooted,
                params: { detail: "useTestWorld has not booted yet" },
            })
        return this.runtime
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
        if (contexts.length === 0) throw notDeclared("any app")
        const dataSource = await openDatabase(state)
        return {
            state,
            contexts,
            dataSource,
            db: { primary: dataSource.manager },
            fake: createTestFakes(state.controlUrl, () => {
                if (baseUrl === null) throw notDeclared("apps.todo (the webhook target)")
                return baseUrl
            }),
            api,
            workerBooted: worker !== undefined,
        }
    }
}

/** Registers the hooks that boot and close the world around the spec and answers the handle; call it inside `describe`. */
export const useTestWorld = (spec: AppsWorldSpec): TestWorld => {
    jest.setTimeout(spec.testTimeoutMs ?? DEFAULT_TEST_TIMEOUT_MS)
    const world = new TestWorld(spec)
    beforeAll(() => world.start(), BOOT_TIMEOUT_MS)
    afterAll(() => world.stop(), STOP_TIMEOUT_MS)
    return world
}
