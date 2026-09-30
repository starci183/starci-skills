import type { DynamicModule } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import type { GraphqlCallOptions, GraphqlObserved } from "@starci-examples/e2e-kit/src/integrations/graphql/graphql-envelope"
import type { MemoryCacheClient } from "@tests/fixtures/memory-cache.client"
import type { IdentityAppOptions } from "../../../../apps/identity/src/identity.options"
import type { OrderAppOptions } from "../../../../apps/order/src/order.options"

/** The environment keys the e2e global setup publishes and the world reads: the URL of each database of the run. */
export const E2E_DATABASE_ENV = {
    identity: "E2E_IDENTITY_DB_URL",
    order: "E2E_ORDER_DB_URL",
}

/** The GraphQL door of one booted app: every call answers the observed envelope, so a refusal is data a spec asserts. */
export interface E2eApi {
    /** Sends a query; `document` is a key of the operation registry or a document string. */
    read<TData>(document: string, options?: GraphqlCallOptions): Promise<GraphqlObserved<TData>>
    /** Sends a mutation. */
    mutate<TData>(document: string, options?: GraphqlCallOptions): Promise<GraphqlObserved<TData>>
}

/** One app the spec boots: its real composition root and whether it listens. */
export interface E2eAppSpec<TOptions> {
    /** The real `AppModule` of `apps/<app>`; the world calls its `register` with the typed options it wired. */
    readonly module: { register(options: TOptions): DynamicModule }
    /** False boots the app without an HTTP listener; the default is true, which every app another app calls needs. */
    readonly listen?: boolean
}

/** What a spec passes to `useE2eWorld`: the apps of the world, each with its real module. */
export interface E2eWorldSpec {
    /** The identity api. */
    readonly identity: E2eAppSpec<IdentityAppOptions>
    /** The order api; it verifies every session against the identity api over real GraphQL. */
    readonly order: E2eAppSpec<OrderAppOptions>
}

/** One booted app. */
export interface E2eAppHandle {
    /** The loopback base URL the app answers on. */
    readonly url: string
    /** Its GraphQL door. */
    readonly api: E2eApi
}

/** The shared EntityManager of every database of the run, for out-of-band reads of persisted state. */
export interface E2eDatabases {
    /** The identity database. */
    readonly identity: EntityManager
    /** The order database. */
    readonly order: EntityManager
}

/** The doubles of the external services the apps call; first-party apps and modules are never faked. */
export interface E2eFakes {
    /** The cache integration: the sessions the identity app issues live here. */
    readonly cache: MemoryCacheClient
}

/** A person a spec registered and signed in. */
export interface E2eSession {
    /** The person id. */
    readonly personId: string
    /** The email the person registered with. */
    readonly email: string
    /** The live bearer token. */
    readonly sessionToken: string
}

/** Test-account lifecycle through the public doors of the identity app. */
export interface E2eAuth {
    /** Registers a person with a unique email and signs them in. */
    registerBuyer(tag: string, password: string): Promise<E2eSession>
    /** Signs an existing person in. */
    signIn(email: string, password: string): Promise<E2eSession>
}

/** What `useE2eWorld` hands a spec; every member is readable once the world booted, that is inside `it` and hooks. */
export interface E2eWorld {
    /** The booted apps by name. */
    readonly apps: { readonly identity: E2eAppHandle; readonly order: E2eAppHandle }
    /** The databases of the run. */
    readonly db: E2eDatabases
    /** The doubles of external services. */
    readonly fake: E2eFakes
    /** Test-account lifecycle. */
    readonly auth: E2eAuth
    /** Polls `probe` until it answers a truthy value or the deadline passes; a flow waits for a state, never for a duration. */
    waitFor<TValue>(label: string, probe: () => Promise<TValue | null | undefined>): Promise<TValue>
}
