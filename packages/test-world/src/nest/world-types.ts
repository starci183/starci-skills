/**
 * The spec-facing API of the world, frozen: what `useTestWorld(...)` answers. Names and shapes here are the contract every
 * repository's specs are written against.
 */
import type { DynamicModule, INestApplicationContext, Type } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import type { BucketNames, ConnectionNames, RegisterableModule, SiblingServiceDeclaration, StacksDeclaration } from "../config/types"
import type { WorldWiring } from "../config/wiring"
import type { FakeClient, FakeDefinition } from "../fakes/framework/contracts"
import type { ClusterClient, ProxyToxics } from "../stack/contracts"
import type { TestApi, TestCaller, TestHttp } from "./api"

/** How `waitFor` polls. */
export interface WaitForOptions {
    /** The deadline in milliseconds (default 30000). */
    readonly timeoutMs?: number
    /** The pause between two checks in milliseconds (default 250). */
    readonly intervalMs?: number
}

/** A capability module of a `{ modules }` world, built from the wiring of the run (the databases and fakes it needs). */
export type ModuleFactory = (wiring: WorldWiring) => DynamicModule

/** What a spec may say about an app it boots: nothing (`true`), or a per-spec override kept for specs written before the declaration moved into `test-world.config.ts`. */
export interface AppOverride {
    /** Ignored when equal to the declared module; the declaration is the composition root. */
    readonly module?: unknown
    /** Ignored: `listen` is declared once per app. */
    readonly listen?: boolean
}

/** An apps world: real apps of the declaration booted in process, by name. */
export interface AppsWorldSpec<TName extends string = string> {
    /** The apps to boot: names, or an object keyed by name. */
    readonly apps: ReadonlyArray<TName> | { readonly [K in TName]?: true | AppOverride }
    /** The jest timeout of every hook and step of the spec, in milliseconds. */
    readonly testTimeoutMs?: number
}

/** A modules world: only these capability modules, over the platform base of the declaration. */
export interface ModulesWorldSpec {
    /** The capability modules, each built from the wiring of the run. */
    readonly modules: ReadonlyArray<ModuleFactory>
    /** The jest timeout of every hook and step of the spec, in milliseconds. */
    readonly testTimeoutMs?: number
}

/** What a spec asks the world for. */
export type WorldSpec<TName extends string = string> = AppsWorldSpec<TName> | ModulesWorldSpec

/** One booted app. */
export interface AppHandle {
    /** The name in the declaration. */
    readonly name: string
    /** Its GraphQL, REST and raw doors; an app without a listener (a worker) has none and asking is a world failure. */
    readonly api: TestApi
    /** The loopback base URL, or null when the app has no listener. */
    readonly url: string | null
    /** Stops this app and boots it again in the same world (same typed options, port, database and stack): proves state survives a process restart. */
    restart(): Promise<void>
}

/**
 * The failure-injection handle of one infrastructure service, behind toxiproxy (per run: it never touches another repository).
 * `latency`, `cut` and `during` take the run's outage lock exclusively before they act and keep it until `restore` (or the
 * world stops), so no other spec file of the run runs a test while the outage is in force.
 */
export interface InfraHandle extends ProxyToxics {
    /** Cuts the service, runs `during` while it is down, then restores it: the outage a deployment sees when a host crashes and comes back. */
    during<T>(during: () => Promise<T>): Promise<T>
}

/** Redis adds a read of its own keys. */
export interface RedisInfraHandle extends InfraHandle {
    /** The number of keys in the repository's own Redis DB. */
    size(): Promise<number>
}

/** Keycloak adds a realm knob: rotating a client's secret. */
export interface KeycloakInfraHandle extends InfraHandle {
    /** Changes the secret of a client of the repository realm on the real Keycloak and answers the new value; an app holding the old one is stale. */
    rotateClientSecret(client: string): Promise<string>
}

/** The infrastructure handles of the world; a service the declaration does not run throws `NotDeclared`. */
export interface WorldInfra {
    readonly postgresql: InfraHandle
    readonly redis: RedisInfraHandle
    readonly minio: InfraHandle
    readonly qdrant: InfraHandle
    readonly kafka: InfraHandle
    readonly keycloak: KeycloakInfraHandle
}

/** The admin handle of the repository's realm in the real Keycloak. */
export interface WorldKeycloak {
    /** Registers a user and answers its person id (the token `sub`). */
    person(email: string, password: string): Promise<string>
    /** The access token of a registered person (password grant of the realm's public client). */
    token(email: string, password: string): Promise<string>
    /** Changes the secret of a client of the realm and answers the new value. */
    rotateClientSecret(client: string): Promise<string>
}

/** One run-isolated S3 (MinIO) bucket a stack declares: everything an S3 client needs, with scoped credentials. */
export interface WorldBucket {
    /** `http://host:port` (through toxiproxy). */
    readonly endpoint: string
    /** The region to sign with. */
    readonly region: string
    /** The stored bucket name: prefixed per repository (`<namespace>-<name>`). */
    readonly bucket: string
    readonly accessKeyId: string
    readonly secretAccessKey: string
    /** MinIO needs path-style addressing. */
    readonly forcePathStyle: true
}

/** A sibling service container. */
export interface ServiceHandle {
    /** A REST client of the service. */
    readonly api: TestHttp
    readonly url: string
}

/** A person registered and signed in through the public doors of the repository. */
export interface SignedInPerson {
    /** The email the person signs in with. */
    readonly email: string
    /** The password the person signs in with. */
    readonly password: string
    /** The person id the session belongs to. */
    readonly personId: string
    /** The bearer token of the session. */
    readonly sessionToken: string
    /** A caller of the first listening app that carries the session. */
    readonly caller: TestCaller
}

/** The command and query buses of a `{ modules }` world (`@nestjs/cqrs`). */
export interface WorldCommandBus {
    execute<TResult = unknown>(command: object): Promise<TResult>
}
/** What runs inside `world.withRequest`: the request-scoped doors of a modules world. */
export interface WorldRequestScope {
    /** The request object the request-scoped providers see through `@Inject(REQUEST)`; it carries the values the spec passed. */
    readonly request: Readonly<Record<string, unknown>>
    /** Executes a command in this request scope. */
    readonly commandBus: WorldCommandBus
    /** Executes a query in this request scope. */
    readonly queryBus: WorldQueryBus
    /** Resolves a request-scoped provider in this request scope. */
    resolve<TProvider>(token: Type<TProvider>): Promise<TProvider>
}

/** The query bus of a `{ modules }` world. */
export interface WorldQueryBus {
    execute<TResult = unknown>(query: object): Promise<TResult>
}

/** The fake handles by their `fakes` key, typed by each definition's client. */
export type FakeHandles<TFakes> = { readonly [K in keyof TFakes]: TFakes[K] extends FakeDefinition<infer TClient> ? TClient : FakeClient }

/** The handle a spec holds. Infrastructure coordinates hidden, every door and reader typed. */
export interface TestWorld<
    TApps extends Readonly<Record<string, RegisterableModule<never>>>,
    TFakes,
    TSiblings extends Readonly<Record<string, SiblingServiceDeclaration>>,
    TStacks extends StacksDeclaration,
> {
    /** The booted apps by name; asking for one the spec did not declare is a world failure. */
    readonly apps: { readonly [K in keyof TApps]: AppHandle }
    /** The shared `EntityManager` of each connection; read persisted state with `query(CONSTANT, params)`. */
    readonly db: Readonly<Record<ConnectionNames<TStacks>, EntityManager>>
    /** The network-edge fakes of the SaaS we do not operate. */
    readonly fake: FakeHandles<TFakes>
    /** Failure injection per infrastructure service: `latency`, `cut`, `restore`, `during`. */
    readonly infra: WorldInfra
    /** The repository realm of the real Keycloak. */
    readonly keycloak: WorldKeycloak
    /** The run-isolated buckets declared in `stacks.minio.buckets`, by logical name. */
    readonly buckets: Readonly<Record<BucketNames<TStacks>, WorldBucket>>
    /** The k3d cluster: pods and namespaces of this repository only. */
    readonly cluster: ClusterClient
    /** Our own services from other repositories. */
    readonly services: { readonly [K in keyof TSiblings]: ServiceHandle }
    /** A REST client of any URL. */
    http(url: string): TestHttp
    /** Polls `check` until it answers something truthy or the deadline passes; the failure names `label` and the last observation. */
    waitFor<T>(label: string, check: () => Promise<T | null | undefined>, options?: WaitForOptions): Promise<T>
    /** Polls `observe` until `ready` accepts what it saw, and answers that observation. */
    waitUntil<T>(label: string, observe: () => Promise<T>, ready: (observed: T) => boolean, options?: WaitForOptions): Promise<T>
    /** The command bus of a `{ modules }` world. */
    readonly commandBus: WorldCommandBus
    /** The query bus of a `{ modules }` world. */
    readonly queryBus: WorldQueryBus
    /** Runs `work` in a real Nest request scope of a `{ modules }` world; `request` (principal, locale, plan, ...) is what request-scoped providers read from `REQUEST`. */
    withRequest<T>(request: Readonly<Record<string, unknown>>, work: (scope: WorldRequestScope) => Promise<T>): Promise<T>
    /** Resolves a provider of a `{ modules }` world by its class. */
    resolve<TProvider>(token: Type<TProvider>): TProvider
    /** Registers a new person through the doors `identity` declares and signs them in. */
    signedInPerson(label: string): Promise<SignedInPerson>
    /** The origin (`scheme://host:port`) of a booted app (the first listening one by default), for a correct `Origin` header. */
    applicationOrigin(app?: string): string
    /** Registers a person through the doors `identity` declares, without signing in (`personId` is known for a Keycloak registration). */
    registerPerson(label: string): Promise<{ readonly email: string; readonly password: string; readonly personId: string | null }>
    /** A directory owned by the run (removed by the teardown), stable per name. */
    scratchDir(name: string): string
    /** Signs an existing person in through the public door. */
    signIn(email: string, password: string): Promise<{ readonly personId: string; readonly email: string; readonly password: string; readonly sessionToken: string }>
    /** A caller that carries the person's session (of the first listening app, or the named one). */
    actAs(person: { readonly sessionToken: string }, app?: string): TestCaller
    /** Cuts the database, runs `during`, restores it; `infra.postgresql.during` under the name older specs use. */
    interruptDatabase(during: () => Promise<void>): Promise<void>
    /** The root context of a `{ modules }` world. */
    readonly context: INestApplicationContext
    /** Closes everything the world booted (the `afterAll` calls it; a spec that proves shutdown calls it itself). */
    stop(): Promise<void>
}
