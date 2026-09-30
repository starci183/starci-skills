import type { DynamicModule } from "@nestjs/common"
import type { CommandBus, QueryBus } from "@nestjs/cqrs"
import type { EntityManager } from "typeorm"
import type { TodoAppOptions } from "../../../apps/todo/src/todo.options"
import type { WorkerAppOptions } from "../../../apps/worker/src/worker.options"
import type { TestApi, TestCaller } from "./test-api.client"

/**
 * Every typed option the test world hands to the real apps and to the capability modules of a modules world: the todo api
 * options plus the worker tick options, all pointing at the shared infrastructure of the run (the migrated database, the
 * network-edge fakes, the run-owned upload directory).
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

/** An apps world: real apps booted in process through their own `AppModule.register(testOptions)`. */
export interface AppsWorldSpec {
    /** Which apps to boot. */
    readonly apps: { readonly todo?: TodoAppSpec; readonly worker?: WorkerAppSpec }
    /** The jest timeout of every hook and step of the spec, in milliseconds. */
    readonly testTimeoutMs?: number
}

/** Builds one capability module from the options of the run. */
export type TestModuleFactory = (options: TestOptions) => DynamicModule

/** A modules world: only these capability modules, over the platform database, on the same shared infrastructure. */
export interface ModulesWorldSpec {
    /** The capability modules (and the handler modules they need), each registered with the options of the run. */
    readonly modules: ReadonlyArray<TestModuleFactory>
    /** The jest timeout of every hook and step of the spec, in milliseconds. */
    readonly testTimeoutMs?: number
}

/** What a spec asks the world for. */
export type TestWorldSpec = AppsWorldSpec | ModulesWorldSpec

/** The database handles of the world: one shared entity manager per connection. */
export interface TestDb {
    /** The shared `EntityManager` of the `primary` connection; read persisted state with `query(CONSTANT, params)`. */
    readonly primary: EntityManager
}

/** The apps of an apps world; asking for one the spec did not declare is a world failure. */
export interface TestApps {
    /** The todo api. */
    readonly todo: { readonly api: TestApi }
    /** The worker: no transport, nothing to call. */
    readonly worker: { readonly name: string }
}

/** A person known to the identity provider fake and signed in through the public door. */
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

/** How `waitFor` polls. */
export interface WaitForOptions {
    /** The deadline in milliseconds; the default suits an asynchronous effect that needs the worker. */
    readonly timeoutMs?: number
    /** The pause between two checks in milliseconds. */
    readonly intervalMs?: number
}

/** The buses of a modules world. */
export interface TestBuses {
    /** The command bus of the booted modules. */
    readonly commandBus: CommandBus
    /** The query bus of the booted modules. */
    readonly queryBus: QueryBus
}
