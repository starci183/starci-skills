import type { DynamicModule } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import type { TodoAppOptions } from "../../../apps/todo/src/todo.options"
import type { WorkerAppOptions } from "../../../apps/worker/src/worker.options"
import type { TestApi, TestCaller } from "./test-api.client"

/**
 * Every typed option the test world hands to the real apps: the todo api
 * options plus the worker tick options, all pointing at the shared infrastructure of the run (the migrated database, the
 * real Keycloak, the network-edge fakes of the external providers, the run-owned upload directory).
 */
export interface TestOptions extends TodoAppOptions, Pick<WorkerAppOptions, "scheduling" | "messaging"> {}

/** A real app module: the composition root of `apps/<name>`, `AppModule.register(options)`. */
export interface TestAppModule<Options> {
    /** Builds the app from its typed options. */
    register(options: Options): DynamicModule
}

/** The todo api: a real app that listens on an OS-allocated loopback port. */
export interface TodoAppSpec {
    /** `AppModule` of `apps/todo`. */
    readonly module: TestAppModule<TodoAppOptions>
    /** The api always listens: it is the transport a spec enters through. */
    readonly listen: true
}

/** The worker: a real app without a listener; its jobs tick and its consumers poll. */
export interface WorkerAppSpec {
    /** `AppModule` of `apps/worker`. */
    readonly module: TestAppModule<WorkerAppOptions>
    /** The worker never listens. */
    readonly listen?: false
}

/** Which apps an apps world boots. */
export interface AppsToBoot {
    /** The todo api. */
    readonly todo?: TodoAppSpec
    /** The worker. */
    readonly worker?: WorkerAppSpec
}

/** An apps world: real apps booted in process through their own `AppModule.register(testOptions)`. */
export interface AppsWorldSpec {
    /** Which apps to boot. */
    readonly apps: AppsToBoot
    /** The jest timeout of every hook and step of the spec, in milliseconds. */
    readonly testTimeoutMs?: number
}

/** The database handles of the world: one shared entity manager per connection. */
export interface TestDb {
    /** The shared `EntityManager` of the `primary` connection; read persisted state with `query(CONSTANT, params)`. */
    readonly primary: EntityManager
}

/** The handle of the booted todo api. */
export interface TodoAppHandle {
    /** The transport client of the api. */
    readonly api: TestApi
}

/** The handle of the booted worker: no transport, nothing to call. */
export interface WorkerAppHandle {
    /** The name of the app. */
    readonly name: string
}

/** The apps of an apps world; asking for one the spec did not declare is a world failure. */
export interface TestApps {
    /** The todo api. */
    readonly todo: TodoAppHandle
    /** The worker: no transport, nothing to call. */
    readonly worker: WorkerAppHandle
}

/** A person registered in the run's Keycloak realm and signed in through the public door. */
export interface SignedInPerson {
    /** The email the person signs in with. */
    readonly email: string
    /** The password the person signs in with. */
    readonly password: string
    /** The person id: the subject the identity provider vouches for. */
    readonly personId: string
    /** The bearer token of the session the sign-in granted. */
    readonly sessionToken: string
    /** A caller that carries the session. */
    readonly caller: TestCaller
}

/** A real service of the stack the world runs (its container), with the outage a spec drives on it. */
export interface TestInfraService {
    /** Takes the service down: its container is killed and every connection to it drops, as when its host crashes. */
    cut(): void
    /** Starts the same container again (same port, same data) and waits until the service answers. */
    restore(): Promise<void>
}

/** The real Keycloak of the run, with the realm the stack imports. */
export interface TestKeycloak extends TestInfraService {
    /** Registers a person in the realm and answers the person id: the `sub` the realm's tokens carry. */
    person(email: string, password: string): Promise<string>
}

/** The services of the repository's own stack the world runs real; only external providers are faked. */
export interface TestInfra {
    /** The identity provider. */
    readonly keycloak: TestKeycloak
}

/** How `waitFor` polls. */
export interface WaitForOptions {
    /** The deadline in milliseconds; the default suits an asynchronous effect that needs the worker. */
    readonly timeoutMs?: number
    /** The pause between two checks in milliseconds. */
    readonly intervalMs?: number
}

/**
 * How the world registers a capability module: as the app root does, global. The world passes it to the module a contract
 * spec builds, so the spec never writes `isGlobal` itself (registration is composition, and the world is the composition root).
 */
export interface ModuleRegistration {
    /** Always global: the capability is consumed through its injectors. */
    readonly isGlobal: true
}
