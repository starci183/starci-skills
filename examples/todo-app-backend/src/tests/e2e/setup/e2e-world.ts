import { createE2EHttpClient } from "@e2e-kit/integrations/http/e2e-http-client"
import type { E2EHttpClient } from "@e2e-kit/integrations/http/e2e-http-client"
import { EnvSource } from "@modules/platform/config"
import { E2EAuth } from "./e2e-auth.service"
import { E2EDatabase } from "./e2e-database.service"
import { E2EGraphql } from "./e2e-graphql.client"
import { E2EStack } from "./e2e-stack.service"

/** Everything a flow spec needs: the run-owned stack and the doors, readers and helpers bound to it. */
export interface E2EWorld {
    /** The run-owned compose stack, the payment gateway stand-in, the api and the worker. */
    readonly stack: E2EStack
    /** Out-of-band reads of the persisted state. */
    readonly database: E2EDatabase
    /** GraphQL clients per bearer. */
    readonly graphql: E2EGraphql
    /** Sign-in and test-account lifecycle. */
    readonly auth: E2EAuth
    /** A plain HTTP client for the REST doors (/health, /metrics, /uploads, /webhooks/sepay), optionally carrying a bearer. */
    http(bearerToken?: string): E2EHttpClient
    /** Closes the database connection and disposes the stack, verifying by observation that nothing of the run survives. */
    close(): Promise<void>
}

/**
 * Stands the run-owned stack up and hands back the world. `specId` is hashed into the compose project name so parallel
 * specs never share a stack. The api and the worker are the compiled real entrypoints: the real AppModules configured
 * through the environment, with real Postgres and Keycloak, real migrations and no seed: a spec creates what it needs
 * through the public doors.
 */
export const bootE2eWorld = async (specId: string): Promise<E2EWorld> => {
    const stack = new E2EStack(specId, EnvSource.fromProcess())
    await stack.boot()
    const database = await E2EDatabase.open(stack.databaseUrl())
    const graphql = new E2EGraphql(stack)
    return {
        stack,
        database,
        graphql,
        auth: new E2EAuth(stack, graphql),
        http: (bearerToken) => createE2EHttpClient({ baseUrl: stack.baseUrl, bearerToken, timeoutMs: 15_000 }),
        close: async () => {
            await database.close()
            await stack.close()
        },
    }
}
