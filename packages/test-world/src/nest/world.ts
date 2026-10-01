/**
 * The runtime behind `useTestWorld`: boots the REAL apps (`AppModule.register(options)`, options built with every URL of the
 * run) or only the named capability modules in this process, against the shared infrastructure the jest globalSetup
 * attached once. Nothing first-party is ever replaced: no provider, guard, filter or module is overridden; the only doubles
 * are the fakes of SaaS we do not operate, reached over the wire. No sleeps: an asynchronous effect is awaited with
 * `waitFor` against persisted state or a fake.
 *
 * Order of a start: reset what the previous spec file left (truncate, realm users, redis db, namespaces, fakes), reserve the
 * ports of every listening app FIRST, build the wiring, then `AppModule.register(options)` per app, listen, open the db handles.
 */
import { randomUUID } from "node:crypto"
import { Module } from "@nestjs/common"
import type { DynamicModule, INestApplicationContext, Type } from "@nestjs/common"
import { NestFactory } from "@nestjs/core"
import { DataSource } from "typeorm"
import type { EntityManager } from "typeorm"
import type { AnyTestWorldConfig, AppDeclaration, InfraName, PostgresConnectionDeclaration, PostgresStack } from "../config/types"
import { TestWorldErrorCode, worldError } from "../errors"
import { createFakeHandles } from "../fakes/framework/bridge"
import { readRunContext } from "../jest/context"
import type { RunContext } from "../jest/context"
import { createClusterClient } from "../stack/cluster/client"
import type { ClusterClient, RunInfra } from "../stack/contracts"
import { createProxyToxics } from "../stack/toxiproxy"
import type { TestApi, TestCaller, TestHttp } from "./api"
import { createTestApi } from "./graphql"
import { createTestHttp } from "./http-client"
import { createKeycloakAdmin } from "./keycloak"
import { pollUntil } from "./poll"
import { freePorts } from "./ports"
import { redisSize } from "./redis-probe"
import { buildWiring } from "./wiring"
import type { AppHandle, InfraHandle, KeycloakInfraHandle, ModulesWorldSpec, RedisInfraHandle, ServiceHandle, SignedInPerson, WaitForOptions, WorldBucket, WorldInfra, WorldKeycloak, WorldRequestScope, WorldSpec } from "./world-types"

const DEFAULT_WAIT_MS = 30_000
const DEFAULT_POLL_MS = 250
const DEFAULT_LOGGER = ["error", "warn"] as const

interface BootedApp {
    readonly name: string
    readonly context: INestApplicationContext
    readonly api: TestApi | null
    readonly url: string | null
}

interface Runtime {
    readonly context: RunContext
    readonly apps: Array<BootedApp>
    readonly wiring: ReturnType<typeof buildWiring>
    readonly ports: Readonly<Record<string, number>>
    readonly root: INestApplicationContext | null
    readonly dataSources: ReadonlyArray<DataSource>
    readonly db: Readonly<Record<string, EntityManager>>
}

@Module({})
/** The root of a modules world: the platform base plus the capability modules the spec asked for. */
class TestModulesRoot {
    /** Composes the root from its imports. */
    static register(imports: ReadonlyArray<DynamicModule>): DynamicModule {
        return { module: TestModulesRoot, imports: [...imports] }
    }
}

const notDeclared = (what: string) => worldError(TestWorldErrorCode.NotDeclared, `${what} was not declared in useTestWorld / test-world.config.ts`)

const isModulesSpec = (spec: WorldSpec): spec is ModulesWorldSpec => "modules" in spec

const appNamesOf = (spec: WorldSpec): ReadonlyArray<string> => {
    if (isModulesSpec(spec)) return []
    return Array.isArray(spec.apps) ? [...spec.apps] : Object.keys(spec.apps)
}

const postgresDeclaration = (declaration: AnyTestWorldConfig): PostgresStack | null => {
    const entry = declaration.stacks.postgresql
    return entry !== undefined && typeof entry === "object" && entry !== null && "connections" in entry ? (entry as PostgresStack) : null
}

/** What a test of the library substitutes. */
export interface WorldDependencies {
    /** Replaces the per-spec reset of the shared stack (truncate, realm users, redis db, namespaces, fakes). */
    readonly resetRun?: (context: RunContext) => Promise<void>
}

/** The handle a spec holds; `useTestWorld` builds one per spec file. */
export class World {
    private runtime: Runtime | null = null

    constructor(
        private readonly declaration: AnyTestWorldConfig,
        private readonly spec: WorldSpec,
        private readonly dependencies: WorldDependencies = {},
    ) {}

    /** Boots the world; called by the `beforeAll` that `useTestWorld` registers. */
    async start(): Promise<void> {
        const context = readRunContext()
        await this.resetRun(context)
        const declared = this.declaration.apps as Readonly<Record<string, AppDeclaration<never>>>
        const wanted = appNamesOf(this.spec)
        for (const name of wanted) if (declared[name] === undefined) throw notDeclared(`apps.${name}`)
        // Declared order is boot order: an api first, so a worker finds its first messages only after the api can serve.
        const names = Object.keys(declared).filter((name) => wanted.includes(name))
        const listening = names.filter((name) => declared[name]?.listen !== false)
        const ports = await freePorts(listening.length)
        const appPorts = Object.fromEntries(listening.map((name, index) => [name, ports[index] ?? 0]))
        const wiring = buildWiring(context, { appPorts })
        const dataSources = await this.openDatabases(wiring.db)
        const db = Object.fromEntries(dataSources.map(({ name, dataSource }) => [name, dataSource.manager]))
        const booted: Array<BootedApp> = []
        try {
            for (const name of names) booted.push(await this.boot(name, declared[name] as AppDeclaration<never>, wiring, appPorts[name] ?? null))
            const root = isModulesSpec(this.spec) ? await this.bootModules(this.spec, wiring) : null
            this.runtime = { context, apps: booted, wiring, ports: appPorts, root, dataSources: dataSources.map((entry) => entry.dataSource), db }
        } catch (cause) {
            for (const app of [...booted].reverse()) await app.context.close().catch(() => undefined)
            await Promise.all(dataSources.map((entry) => entry.dataSource.destroy().catch(() => undefined)))
            throw cause
        }
    }

    /** Closes every booted app, last booted first, and the db handles; called by the `afterAll` that `useTestWorld` registers. */
    async stop(): Promise<void> {
        const runtime = this.runtime
        this.runtime = null
        if (runtime === null) return
        await this.restoreInfra(runtime.context)
        const failures: Array<unknown> = []
        const contexts = [...(runtime.root === null ? [] : [runtime.root]), ...[...runtime.apps].reverse().map((app) => app.context)]
        for (const context of contexts) {
            try {
                await context.close()
            } catch (cause) {
                failures.push(cause)
            }
        }
        for (const dataSource of runtime.dataSources) if (dataSource.isInitialized) await dataSource.destroy()
        const [first] = failures
        if (first !== undefined) throw worldError(TestWorldErrorCode.InfrastructureFailed, "an app context failed to close", first)
    }

    /** The booted apps by name. */
    get apps(): Readonly<Record<string, AppHandle>> {
        const runtime = this.booted()
        const handles: Record<string, AppHandle> = {}
        for (const name of Object.keys(this.declaration.apps)) {
            Object.defineProperty(handles, name, {
                enumerable: true,
                get: (): AppHandle => {
                    const app = runtime.apps.find((candidate) => candidate.name === name)
                    if (app === undefined) throw notDeclared(`apps.${name}`)
                    return {
                        name,
                        url: app.url,
                        restart: () => this.restartApp(name),
                        get api(): TestApi {
                            if (app.api === null) throw worldError(TestWorldErrorCode.NotDeclared, `apps.${name} has no listener, so it has no api`)
                            return app.api
                        },
                    }
                },
            })
        }
        return handles
    }

    /** The origin (`scheme://host:port`) of a booted app, for the `Origin` header of CSRF-checked routes; the first listening app when none is named. */
    applicationOrigin(app?: string): string {
        return new URL(this.listeningApi(app).baseUrl).origin
    }

    /** Stops one app and boots it again in the same world: same typed options, same port, same database and stack. */
    async restartApp(name: string): Promise<void> {
        const runtime = this.booted()
        const index = runtime.apps.findIndex((candidate) => candidate.name === name)
        const previous = runtime.apps[index]
        const decl = (this.declaration.apps as Readonly<Record<string, AppDeclaration<never>>>)[name]
        if (previous === undefined || decl === undefined) throw notDeclared(`apps.${name}`)
        await previous.context.close()
        runtime.apps[index] = await this.boot(name, decl, runtime.wiring, runtime.ports[name] ?? null)
    }

    /** The shared entity manager of each connection. */
    get db(): Readonly<Record<string, EntityManager>> {
        const { db } = this.booted()
        const handles: Record<string, EntityManager> = {}
        for (const connection of this.declaredConnections()) {
            Object.defineProperty(handles, connection.name, {
                enumerable: true,
                get: () => {
                    const manager = db[connection.name]
                    if (manager === undefined) throw notDeclared(`db.${connection.name}`)
                    return manager
                },
            })
        }
        return handles
    }

    /** The fakes of the SaaS we do not operate, reached over the control channel. */
    get fake(): Record<string, unknown> {
        const { context } = this.booted()
        return createFakeHandles(this.declaration.fakes ?? {}, context.fakes.controlUrl, (app) => this.webhookTarget(app))
    }

    /** Failure injection per infrastructure service. */
    get infra(): WorldInfra {
        const { infra } = this.booted().context
        const handle = (service: InfraName, proxy: string | undefined, directPort: number | undefined, extra?: (h: InfraHandle) => object): InfraHandle => {
            if (proxy === undefined || directPort === undefined) throw notDeclared(`infra.${service}`)
            const toxics = createProxyToxics(infra.toxiproxyApi, proxy)
            const base: InfraHandle = {
                ...toxics,
                during: async <T>(during: () => Promise<T>): Promise<T> => {
                    await toxics.cut()
                    try {
                        return await during()
                    } finally {
                        await toxics.restore()
                    }
                },
            }
            return { ...base, ...(extra?.(base) ?? {}) }
        }
        const redis = infra.redis
        return {
            get postgresql() {
                return handle("postgresql", infra.postgresql?.proxy, infra.postgresql?.directPort)
            },
            get redis(): RedisInfraHandle {
                return handle("redis", redis?.proxy, redis?.directPort, () => ({ size: () => redisSize(redis?.directPort ?? 0, redis?.db ?? 0) })) as RedisInfraHandle
            },
            get minio() {
                return handle("minio", infra.minio?.proxy, infra.minio?.directPort)
            },
            get qdrant() {
                return handle("qdrant", infra.qdrant?.proxy, infra.qdrant?.directPort)
            },
            get kafka() {
                return handle("kafka", infra.kafka?.proxy, infra.kafka?.directPort)
            },
            get keycloak(): KeycloakInfraHandle {
                const run = infra.keycloak
                return handle("keycloak", run?.proxy, run?.directPort, () => ({
                    rotateClientSecret: (client: string) => {
                        if (run === undefined) throw notDeclared("infra.keycloak")
                        return createKeycloakAdmin(run).rotateClientSecret(client)
                    },
                })) as KeycloakInfraHandle
            },
        }
    }

    /** The repository realm of the real Keycloak. */
    get keycloak(): WorldKeycloak {
        const { keycloak } = this.booted().context.infra
        if (keycloak === undefined) throw notDeclared("stacks.keycloak")
        return createKeycloakAdmin(keycloak)
    }

    /** The run-isolated buckets of the declared MinIO. */
    get buckets(): Readonly<Record<string, WorldBucket>> {
        const { minio } = this.booted().context.infra
        if (minio === undefined) throw notDeclared("stacks.minio")
        const handles: Record<string, WorldBucket> = {}
        for (const [name, bucket] of Object.entries(minio.buckets)) {
            handles[name] = {
                endpoint: `http://${minio.host}:${minio.port}`,
                region: "us-east-1",
                bucket,
                accessKeyId: minio.accessKey,
                secretAccessKey: minio.secretKey,
                forcePathStyle: true,
            }
        }
        return handles
    }

    /** The cluster. */
    get cluster(): ClusterClient {
        const { cluster } = this.booted().context.infra
        if (cluster === undefined) throw notDeclared("k3d (set k3d.enable)")
        return createClusterClient(cluster)
    }

    /** The sibling services. */
    get services(): Readonly<Record<string, ServiceHandle>> {
        const { context } = this.booted()
        return Object.fromEntries(Object.entries(context.services).map(([name, service]) => [name, { url: service.url, api: createTestHttp(service.url) }]))
    }

    /** A REST client of any URL. */
    http(url: string): TestHttp {
        return createTestHttp(url)
    }

    /** Polls `check` until it answers something truthy or the deadline passes. */
    waitFor<T>(label: string, check: () => Promise<T | null | undefined>, options: WaitForOptions = {}): Promise<T> {
        return pollUntil(label, check, options.timeoutMs ?? DEFAULT_WAIT_MS, options.intervalMs ?? DEFAULT_POLL_MS)
    }

    /** Polls `observe` until `ready` accepts what it saw, and answers that observation. */
    async waitUntil<T>(label: string, observe: () => Promise<T>, ready: (observed: T) => boolean, options: WaitForOptions = {}): Promise<T> {
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

    /** The root context of a modules world. */
    get context(): INestApplicationContext {
        const { root } = this.booted()
        if (root === null) throw notDeclared("modules (an apps world has no module root)")
        return root
    }

    /** The command bus of a modules world. */
    get commandBus(): { execute(command: object): Promise<unknown> } {
        return this.bus("CommandBus")
    }

    /** The query bus of a modules world. */
    get queryBus(): { execute(query: object): Promise<unknown> } {
        return this.bus("QueryBus")
    }

    /**
     * Runs `work` inside a REAL Nest request scope of a modules world: one cqrs `AsyncContext` (a ContextId plus the registered
     * request), carrying `request` (`principal`, `locale`, `plan`, ... as the spec built them) as the request object. Request-scoped
     * providers and handlers (`@Inject(REQUEST)`) resolve exactly as they do in the app; `scope.commandBus/queryBus` execute in it.
     */
    async withRequest<T>(request: Readonly<Record<string, unknown>>, work: (scope: WorldRequestScope) => Promise<T>): Promise<T> {
        const root = this.context
        // @nestjs/cqrs is the repository's own dependency; the library never imports it statically.
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { AsyncContext } = require("@nestjs/cqrs") as { AsyncContext: new () => { id: unknown } }
        const scoped = new AsyncContext()
        Object.assign(scoped, request)
        const registrar = root as unknown as { registerRequestByContextId(request: object, contextId: unknown): void }
        registrar.registerRequestByContextId(scoped, scoped.id)
        const busOf = (name: "CommandBus" | "QueryBus") => {
            const bus = this.bus(name) as unknown as { execute(command: object, context?: unknown): Promise<unknown> }
            return { execute: <TResult = unknown>(message: object) => bus.execute(message, scoped) as Promise<TResult> }
        }
        return work({
            request: scoped,
            commandBus: busOf("CommandBus"),
            queryBus: busOf("QueryBus"),
            resolve: <TProvider>(token: Type<TProvider>) => (root as unknown as { resolve(t: Type<TProvider>, id: unknown, o: object): Promise<TProvider> }).resolve(token, scoped.id, { strict: false }),
        })
    }

    /** Resolves a provider of a modules world by its class. */
    resolve<TProvider>(token: Type<TProvider>): TProvider {
        return this.context.get(token, { strict: false })
    }

    /** Cuts the database, runs `during`, restores it. */
    interruptDatabase(during: () => Promise<void>): Promise<void> {
        return this.infra.postgresql.during(during)
    }

    /** A caller that carries the person's session. */
    actAs(person: { readonly sessionToken: string }, app?: string): TestCaller {
        return this.listeningApi(app).as(person.sessionToken)
    }

    /** Signs an existing person in through the public door. */
    async signIn(email: string, password: string): Promise<{ personId: string; email: string; password: string; sessionToken: string }> {
        const identity = this.declaration.identity
        if (identity === undefined) throw notDeclared("identity")
        const session = await identity.signIn(this.identityWorld(), { email, password })
        return { personId: session.personId, email, password, sessionToken: session.sessionToken }
    }

    /** Registers a person through the doors `identity` declares, without signing in. */
    async registerPerson(label: string): Promise<{ email: string; password: string; personId: string | null }> {
        const identity = this.declaration.identity
        if (identity === undefined) throw notDeclared("identity")
        const email = `${label}-${randomUUID()}@${identity.emailDomain ?? "e2e.test"}`
        const password = `pw-${randomUUID()}`
        let personId: string | null = null
        if (identity.register === "keycloak") personId = await this.keycloak.person(email, password)
        else if (identity.register !== undefined) await identity.register(this.identityWorld(), { email, password })
        return { email, password, personId }
    }

    /** A directory owned by the run (removed by the teardown), stable per name. */
    scratchDir(name: string): string {
        return buildWiring(this.booted().context).directory(name)
    }

    /** Registers a new person through the doors `identity` declares and signs them in. */
    async signedInPerson(label: string): Promise<SignedInPerson> {
        const identity = this.declaration.identity
        if (identity === undefined) throw notDeclared("identity")
        const email = `${label}-${randomUUID()}@${identity.emailDomain ?? "e2e.test"}`
        const password = `pw-${randomUUID()}`
        const credentials = { email, password }
        if (identity.register === "keycloak") await this.keycloak.person(email, password)
        else if (identity.register !== undefined) await identity.register(this.identityWorld(), credentials)
        const session = await identity.signIn(this.identityWorld(), credentials)
        return { email, password, personId: session.personId, sessionToken: session.sessionToken, caller: this.listeningApi().as(session.sessionToken) }
    }

    private identityWorld() {
        return { apps: this.apps as Readonly<Record<string, { readonly api: TestApi }>> }
    }

    private listeningApi(name?: string): TestApi {
        const runtime = this.booted()
        const app = name === undefined ? runtime.apps.find((candidate) => candidate.api !== null) : runtime.apps.find((candidate) => candidate.name === name)
        if (app?.api === undefined || app.api === null) throw notDeclared(name === undefined ? "a listening app" : `apps.${name} (with a listener)`)
        return app.api
    }

    private webhookTarget(app?: string): string {
        const url = this.listeningApi(app).baseUrl
        return url
    }

    private bus(name: "CommandBus" | "QueryBus"): { execute(command: object): Promise<unknown> } {
        const root = this.context
        // @nestjs/cqrs is the repository's own dependency; the library never imports it statically.
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const cqrs = require("@nestjs/cqrs") as Record<string, Type<{ execute(command: object): Promise<unknown> }>>
        const token = cqrs[name]
        if (token === undefined) throw worldError(TestWorldErrorCode.NotDeclared, `@nestjs/cqrs does not export ${name}`)
        return root.get(token, { strict: false })
    }

    private booted(): Runtime {
        if (this.runtime === null) throw worldError(TestWorldErrorCode.NotBooted, "useTestWorld has not booted yet (call it inside describe, and use the world inside tests and hooks)")
        return this.runtime
    }

    private declaredConnections(): ReadonlyArray<PostgresConnectionDeclaration> {
        return postgresDeclaration(this.declaration)?.connections ?? []
    }

    private async resetRun(context: RunContext): Promise<void> {
        if (this.dependencies.resetRun !== undefined) {
            await this.dependencies.resetRun(context)
            return
        }
        const { stack } = await import("../stack")
        await stack.reset({ namespace: context.namespace, infra: context.infra, keepTables: context.keepTables })
        const response = await fetch(`${context.fakes.controlUrl}/reset`, { method: "POST", signal: AbortSignal.timeout(30_000) })
        if (response.status !== 200) throw worldError(TestWorldErrorCode.FakeControlFailed, `resetting the fakes answered ${response.status}`)
    }

    private async restoreInfra(context: RunContext): Promise<void> {
        const { infra } = context
        const proxies = [infra.postgresql, infra.redis, infra.minio, infra.qdrant, infra.keycloak].flatMap((entry) => (entry === undefined ? [] : [entry.proxy]))
        await Promise.all(proxies.map((proxy) => createProxyToxics(infra.toxiproxyApi, proxy).restore().catch(() => undefined)))
    }

    private async openDatabases(wired: Readonly<Record<string, { readonly url: string }>>): Promise<ReadonlyArray<{ name: string; dataSource: DataSource }>> {
        const opened: Array<{ name: string; dataSource: DataSource }> = []
        for (const connection of this.declaredConnections()) {
            const wiredDb = wired[connection.name]
            if (wiredDb === undefined) continue
            const dataSource = new DataSource({
                type: "postgres",
                name: connection.name,
                url: wiredDb.url,
                entities: [...(connection.entities ?? [])] as Array<Function>,
                synchronize: false,
            })
            await dataSource.initialize()
            opened.push({ name: connection.name, dataSource })
        }
        return opened
    }

    private async boot(name: string, decl: AppDeclaration<never>, wiring: ReturnType<typeof buildWiring>, port: number | null): Promise<BootedApp> {
        const options = (decl.options as (w: typeof wiring) => never)(wiring)
        const module = (decl.module as unknown as { register(o: unknown): DynamicModule }).register(options)
        const logger = [...(this.declaration.logger ?? DEFAULT_LOGGER)]
        if (port === null) {
            return { name, context: await NestFactory.createApplicationContext(module, { logger }), api: null, url: null }
        }
        const app = await NestFactory.create(module, { logger })
        await decl.configure?.(app, options)
        await app.listen(port, "127.0.0.1")
        const baseUrl = `http://127.0.0.1:${port}`
        const identity = this.declaration.identity
        const api = createTestApi({
            baseUrl,
            operations: decl.operations ?? {},
            graphqlPath: decl.graphqlPath ?? "/graphql",
            signIn: async (email, password) => {
                if (identity === undefined) throw notDeclared("identity")
                return identity.signIn(this.identityWorld(), { email, password })
            },
        })
        return { name, context: app, api, url: baseUrl }
    }

    private async bootModules(spec: ModulesWorldSpec, wiring: ReturnType<typeof buildWiring>): Promise<INestApplicationContext> {
        const base = this.declaration.modules
        if (base === undefined) throw notDeclared("modules (declare `modules.base` in test-world.config.ts)")
        const logger = [...(this.declaration.logger ?? DEFAULT_LOGGER)]
        return NestFactory.createApplicationContext(TestModulesRoot.register([...base.base(wiring), ...spec.modules.map((factory) => factory(wiring))]), { logger })
    }
}

/** The infra of a run context, for tests of the library. */
export type RunInfraOf = RunInfra
