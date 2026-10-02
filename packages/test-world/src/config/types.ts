/**
 * The declaration a repository writes in `src/tests/world/test-world.config.ts`: selection and overrides only. Service
 * lists and image versions come from the stack definition (`.starcistacks/<env>`), never from here.
 */
import type { DynamicModule, INestApplication, INestApplicationContext } from "@nestjs/common"
import type { FakeDefinition } from "../fakes/framework/contracts"
import type { WorldWiring } from "./wiring"

/** The infrastructure services the shared stack runs; the keys of `stacks`. */
export const INFRA_SERVICES = ["postgresql", "redis", "minio", "qdrant", "kafka", "keycloak"] as const

/** One infrastructure service of the shared stack. */
export type InfraName = (typeof INFRA_SERVICES)[number]

/** A service the world does not run because a protocol fake stands in for it (stateless compute needing special hardware). */
export interface FakedService {
    /** The name of an entry of `fakes` that answers for the service. */
    readonly fakedBy: string
    /** Why the real service cannot run here (special hardware, no self-hosted image, ...). */
    readonly reason: string
}

/**
 * One Postgres connection of the repository (one bounded context). By default it gets a database of its own; a context that
 * starts as a SCHEMA of a shared database names that database (`database`) and its `schema`: the connections that name one
 * `database` share it (each data slot still gets its own copy), each in its own schema with its own login role whose
 * `search_path` is that schema.
 */
export interface PostgresConnectionDeclaration {
    /** The connection name; `world.db.<name>` and `w.db.<name>`. */
    readonly name: string
    /** The logical database the connection lives in (default: its own `name`); connections that share one each declare a `schema`. */
    readonly database?: string
    /** The schema of the context inside its database (default: `public` of a database of its own). */
    readonly schema?: string
    /** The entity classes the shared `EntityManager` of this connection maps; raw `query` needs none. */
    readonly entities?: ReadonlyArray<unknown>
    /** SQL files (relative to the app root) applied after the migrate step, in order. */
    readonly seeds?: ReadonlyArray<string>
    /** Extensions created in the database before the migrate step (`vector`, `pgcrypto`, ...). */
    readonly extensions?: ReadonlyArray<string>
    /** Tables the per-spec reset keeps although the spec run may have written them (default: migration ledgers and every table seeded by the migrate step). */
    readonly keep?: ReadonlyArray<string>
}

/** The `stacks` entry of Postgres. */
export interface PostgresStack {
    /** The connections; each gets its own database in the shared container of the image. */
    readonly connections: ReadonlyArray<PostgresConnectionDeclaration>
    /** Overrides the image the stack definition names (rarely needed). */
    readonly image?: string
}

/** The `stacks` entry of Keycloak. */
export interface KeycloakStack {
    /** Path (relative to the app root) of the realm import JSON; the realm is imported per repository under a prefixed name. */
    readonly realm: string
    /** The public client that allows the password grant; default is the first client of the realm file that enables direct access grants. */
    readonly clientId?: string
    /** Overrides the image the stack definition names. */
    readonly image?: string
}

/** The `stacks` entry of a service that needs no more than to be selected. */
export interface PlainStack {
    /** Overrides the image the stack definition names. */
    readonly image?: string
}

/** The `stacks` entry of MinIO. */
export interface MinioStack extends PlainStack {
    /** Bucket names (logical) created for the repository, each stored as `<prefix>-<name>`. */
    readonly buckets?: ReadonlyArray<string>
}

/** The `stacks` entry of Kafka. */
export interface KafkaStack extends PlainStack {
    /** Topic names (logical) created for the repository, each stored as `<prefix>.<name>`. */
    readonly topics?: ReadonlyArray<string>
}

/** The `stacks` block. Known services take their spec; any name may instead be faked with a declared reason. */
export interface StacksDeclaration {
    readonly postgresql?: PostgresStack | FakedService
    readonly keycloak?: KeycloakStack | FakedService
    readonly redis?: PlainStack | FakedService
    readonly minio?: MinioStack | FakedService
    readonly qdrant?: PlainStack | FakedService
    readonly kafka?: KafkaStack | FakedService
    readonly [service: string]: unknown
}

/** The `k3d` block: a real cluster with a local registry, for repositories whose code creates cluster resources. */
export interface K3dDeclaration {
    /** Whether the world starts (or attaches to) the shared cluster. */
    readonly enable: boolean
    /** Images the repository builds itself: logical name to Dockerfile path (relative to the app root); tagged `src-<content hash>`. */
    readonly images?: Readonly<Record<string, string>>
}

/** A sibling service of the product: our own image from another repository, pinned by the stack definition. */
export interface SiblingServiceDeclaration {
    /** The image; when absent it is read from the stack definition (`services.<name>.image` of its compose file). */
    readonly image?: string
    /** The port the container listens on; default: the first `EXPOSE` or 8080. */
    readonly port?: number
    /** Environment of the container, built from the wiring (URLs of the infrastructure it needs). */
    readonly env?: (wiring: WorldWiring) => Readonly<Record<string, string>>
    /** The path polled until the service answers 2xx; default `/health/ready`. */
    readonly health?: string
}

/** A composition root of an app: `AppModule.register(options)` builds the Nest module from typed options. */
export interface RegisterableModule<TOptions> {
    register(options: TOptions): DynamicModule
}

/** The typed options of a module, as its `register` takes them. */
export type OptionsOf<TModule extends RegisterableModule<never>> = TModule extends RegisterableModule<infer TOptions> ? TOptions : never

/** One real app the world boots in this process. */
export interface AppDeclaration<TModule extends RegisterableModule<never> = RegisterableModule<never>, TWiring = WorldWiring> {
    /** The real `AppModule` of `apps/<name>`. */
    readonly module: TModule
    /** Builds the typed options from the wiring; every URL (database, fakes, keycloak, the other apps) is on `w`. */
    readonly options: (wiring: TWiring) => OptionsOf<TModule>
    /** Whether the app listens on an OS-reserved loopback port (default true). A worker has no listener. */
    readonly listen?: boolean
    /**
     * Whether the app is created with Nest's `rawBody` (default false), as its `main.ts` does when it verifies signed webhooks
     * over the exact body (`request.rawBody`).
     */
    readonly rawBody?: boolean
    /** What `main.ts` does after `NestFactory.create` and before `listen` (CORS, pipes, prefixes). */
    readonly configure?: (app: INestApplication, options: OptionsOf<TModule>) => void | Promise<void>
    /** GraphQL documents by the name a spec uses (`caller.graphql("createTask", vars)`); a document string is always accepted too. */
    readonly operations?: Readonly<Record<string, string>>
    /** The GraphQL path (default `/graphql`). */
    readonly graphqlPath?: string
}

/** The `migrate` block: `apps/migrate` runs once per run inside the globalSetup, over the run's databases. */
export interface MigrateDeclaration<TOptions = never, TWiring = WorldWiring> {
    /** The migrate entry: the module namespace of `apps/migrate/src/main` (exports `bootstrap`), a bare bootstrap function, or a Nest `AppModule` with `register`. */
    readonly module: MigrateEntry<TOptions>
    /** The typed options of the migrate app, from the wiring (databases of the run). */
    readonly options: (wiring: TWiring) => TOptions
}

/** What the world can run as the migrate step. */
export type MigrateEntry<TOptions> =
    | { readonly bootstrap: (options: TOptions) => Promise<unknown> }
    | ((options: TOptions) => Promise<unknown>)
    | RegisterableModule<TOptions>

/** The result of a person signing in through the public door of the repository. */
export interface SignedInIdentity {
    /** The person id the session belongs to. */
    readonly personId: string
    /** The bearer token of the session. */
    readonly sessionToken: string
}

/** A person's credentials. */
export interface PersonCredentials {
    /** The email. */
    readonly email: string
    /** The password. */
    readonly password: string
}

/** How `world.signedInPerson` registers and signs a person in: the repository knows its own doors. */
export interface IdentityDeclaration {
    /** The domain of generated emails (default `e2e.test`). */
    readonly emailDomain?: string
    /**
     * Registers the person. `"keycloak"` creates the user in the repository's realm through the admin API (the real
     * identity provider); a function registers through a public door of the app under test (`world.apps.<name>.api`).
     */
    readonly register?: "keycloak" | ((world: IdentityWorld, credentials: PersonCredentials) => Promise<void>)
    /** Signs the registered person in through the public door and answers the session. */
    readonly signIn: (world: IdentityWorld, credentials: PersonCredentials) => Promise<SignedInIdentity>
}

/** The slice of the world an identity hook may use. */
export interface IdentityWorld {
    /** The booted apps by name (`.api` of each). */
    readonly apps: Readonly<Record<string, { readonly api: import("../nest/api").TestApi }>>
}

/** Nest modules mode: the platform base every `{ modules }` spec is registered over. */
export interface ModulesDeclaration {
    /** The base modules (clock, logging, database with the run's connections, ...) built from the wiring. */
    readonly base: (wiring: WorldWiring) => ReadonlyArray<DynamicModule>
}

/** The `sandbox` block: the modules every provider sandbox client is booted with (the repository's outbound HTTP port, clock, logging). */
export interface SandboxDeclaration {
    /** Modules registered beside the integration module under test. */
    readonly base: () => ReadonlyArray<DynamicModule>
}

/** The connection names declared in `stacks.postgresql.connections`, as literals when the declaration keeps them. */
export type ConnectionNames<TStacks extends StacksDeclaration> = TStacks["postgresql"] extends PostgresStack
    ? TStacks["postgresql"]["connections"][number]["name"]
    : string

/** The bucket names declared in `stacks.minio.buckets`, as literals when the declaration keeps them. */
export type BucketNames<TStacks extends StacksDeclaration> = TStacks["minio"] extends { readonly buckets: ReadonlyArray<infer N> } ? N & string : string

/** The wiring an options builder sees, typed by the names this declaration declares (so `w.db.primary` is never possibly undefined). */
export type WiringOf<TApps, TFakes, TSiblings, TStacks extends StacksDeclaration> = WorldWiring<
    keyof TApps & string,
    ConnectionNames<TStacks>,
    keyof TFakes & string,
    keyof TSiblings & string
>

/** The whole declaration of a repository; the type parameters are inferred from the literal so every spec-facing name is typed. */
export interface TestWorldConfig<
    TApps extends Readonly<Record<string, RegisterableModule<never>>> = Readonly<Record<string, RegisterableModule<never>>>,
    TFakes extends Readonly<Record<string, FakeDefinition>> = Readonly<Record<string, FakeDefinition>>,
    TSiblings extends Readonly<Record<string, SiblingServiceDeclaration>> = Readonly<Record<string, SiblingServiceDeclaration>>,
    TStacks extends StacksDeclaration = StacksDeclaration,
    TMigrate = never,
> {
    /** The stack definition directory, relative to the app root (`.starcistacks/dev`, never under be/); service list and image versions come from its compose files. */
    readonly stack: string
    /** Selection and overrides of the infrastructure services. */
    readonly stacks: TStacks
    /** The cluster. */
    readonly k3d?: K3dDeclaration
    /** Our own services from other repositories. */
    readonly services?: TSiblings
    /** SaaS we do not operate, faked at the network edge; repo-specific fakes live in `src/tests/world/fakes/`. */
    readonly fakes?: TFakes
    /** The real apps a spec may boot by name. */
    readonly apps: { readonly [K in keyof TApps]: AppDeclaration<TApps[K], WiringOf<TApps, TFakes, TSiblings, TStacks>> }
    /** The migrate app, run once per run. */
    readonly migrate: MigrateDeclaration<TMigrate, WiringOf<TApps, TFakes, TSiblings, TStacks>>
    /** How persons register and sign in. */
    readonly identity?: IdentityDeclaration
    /** The base of `{ modules }` specs. */
    readonly modules?: ModulesDeclaration
    /** The contract layer (`useSandbox`): the base modules of a provider sandbox client. */
    readonly sandbox?: SandboxDeclaration
    /** The app root every declared path is relative to; default the directory of the app's hfs.json found from the jest rootDir (the rootDir itself or its parent). */
    readonly root?: string
    /**
     * The most data slots a run provisions (default 2): world spec files run up to `min(--maxWorkers, workers)` at once, each
     * slot a complete set of databases, realm, Redis DB, buckets, fakes and proxies. Size it from the host's headroom.
     */
    readonly workers?: number
    /** Nest logger levels of the booted apps (default `["error", "warn"]`). */
    readonly logger?: ReadonlyArray<"log" | "error" | "warn" | "debug" | "verbose" | "fatal">
}

/** The declaration with every type parameter erased: what the runtime reads. */
export type AnyTestWorldConfig = TestWorldConfig<
    Readonly<Record<string, RegisterableModule<never>>>,
    Readonly<Record<string, FakeDefinition>>,
    Readonly<Record<string, SiblingServiceDeclaration>>,
    StacksDeclaration,
    never
>

/** A booted context, for the `{ modules }` mode. */
export type BootedContext = INestApplicationContext
