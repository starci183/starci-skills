import type { DynamicModule } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import type { Secret } from "@modules/platform/config"
import type { AppModule as IdentityApp } from "../../../apps/identity/src/app.module"
import type { AppModule as OrderApp } from "../../../apps/order/src/app.module"
import type { RedisFakeService } from "./fakes/redis/redis-fake.service"
import type { TestApi } from "./test-api.client"

/** The typed options of the identity api, as `AppModule.register` takes them. */
export type IdentityAppOptions = Parameters<typeof IdentityApp.register>[0]

/** The typed options of the order api, as `AppModule.register` takes them. */
export type OrderAppOptions = Parameters<typeof OrderApp.register>[0]

/** The composition root of an app: its static `register` builds the root module from typed options. */
export interface TestAppModule<TOptions> {
    /** Builds the root module. */
    register(options: TOptions): DynamicModule
}

/** One app the spec boots: its real composition root. */
export interface TestAppSpec<TOptions> {
    /** The real `AppModule` of `apps/<app>`; the world calls its `register` with the typed options it wired. */
    readonly module: TestAppModule<TOptions>
}

/** The applications of an apps world, by name. */
export interface TestAppSpecs {
    /** The identity api. */
    readonly identity: TestAppSpec<IdentityAppOptions>
    /** The order api. */
    readonly order: TestAppSpec<OrderAppOptions>
}

/** An apps world: the identity api and the order api booted in process, calling each other over real GraphQL. */
export interface AppsWorldSpec {
    /** The applications to boot. */
    readonly apps: TestAppSpecs
    /** The jest timeout of every hook and step of the spec, in milliseconds. */
    readonly testTimeoutMs?: number
}

/** What a capability module of a modules world is registered with: the URL of each database of the run. */
export interface TestWiring {
    /** The URL of the identity database. */
    readonly identityDatabaseUrl: Secret
    /** The URL of the order database. */
    readonly orderDatabaseUrl: Secret
}

/**
 * How the world registers a capability module: as the app root does, global. The world passes it to the module a contract
 * spec builds, so the spec never writes `isGlobal` itself (registration is composition, and the world is the composition root).
 */
export interface ModuleRegistration {
    /** Always global: the capability is consumed through its injectors. */
    readonly isGlobal: true
}

/** Builds one capability module from the wiring of the run. */
export type TestModuleFactory = (wiring: TestWiring) => DynamicModule

/** A modules world: only these capability modules, over the platform database, on the same shared infrastructure. */
export interface ModulesWorldSpec {
    /** The capability modules, each registered with the wiring of the run. */
    readonly modules: ReadonlyArray<TestModuleFactory>
    /** The jest timeout of every hook and step of the spec, in milliseconds. */
    readonly testTimeoutMs?: number
}

/** What a spec asks the world for. */
export type TestWorldSpec = AppsWorldSpec | ModulesWorldSpec

/** The database handles of the world: one shared entity manager per connection. */
export interface TestDb {
    /** The identity database. */
    readonly identity: EntityManager
    /** The order database. */
    readonly order: EntityManager
}

/** One booted app. */
export interface TestAppHandle {
    /** Its GraphQL door and probes. */
    readonly api: TestApi
}

/** The apps of an apps world; asking for a world without apps is a failure. */
export interface TestApps {
    /** The identity api. */
    readonly identity: TestAppHandle
    /** The order api. */
    readonly order: TestAppHandle
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
    /** The password the person registered with. */
    readonly password: string
    /** The live bearer token. */
    readonly sessionToken: string
}

/** How `waitFor` polls. */
export interface WaitForOptions {
    /** The deadline in milliseconds. */
    readonly timeoutMs?: number
    /** The pause between two checks in milliseconds. */
    readonly intervalMs?: number
}

/** The databases an outage can take down. */
export type TestConnection = "identity" | "order"
