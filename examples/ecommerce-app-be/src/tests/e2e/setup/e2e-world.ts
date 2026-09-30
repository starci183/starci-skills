import { createE2EHttpClient } from "@e2e-kit/integrations/http/e2e-http-client"
import type { E2EHttpClient } from "@e2e-kit/integrations/http/e2e-http-client"
import { EnvSource } from "@modules/platform/config"
import { E2EAuth } from "./e2e-auth.service"
import { E2EDatabase } from "./e2e-database.service"
import { E2EGraphql } from "./e2e-graphql.client"
import { E2EStack } from "./e2e-stack.service"
import type { E2EServiceName } from "./e2e-stack.service"

/** Everything a flow spec needs: the run-owned stack and the doors, readers and helpers bound to it. */
export interface E2EWorld {
    /** The run-owned compose stack and the two api processes. */
    readonly stack: E2EStack
    /** Out-of-band reads of the persisted state. */
    readonly database: E2EDatabase
    /** GraphQL clients per service and bearer. */
    readonly graphql: E2EGraphql
    /** Test-account lifecycle. */
    readonly auth: E2EAuth
    /** A plain HTTP client for the probe doors (/health). */
    http(service: E2EServiceName): E2EHttpClient
    /** Closes the database connections and disposes the stack, verifying by observation that nothing of the run survives. */
    close(): Promise<void>
}

/**
 * Stands the run-owned stack up and hands back the world. `specId` is hashed into the compose project name so parallel
 * specs never share a stack. The apis are the compiled real entrypoints: the real AppModule configured through the
 * environment, with real Postgres and Redis, real migrations and the dev seeds.
 */
export const bootE2eWorld = async (specId: string): Promise<E2EWorld> => {
    const stack = new E2EStack(specId, EnvSource.fromProcess())
    await stack.boot()
    const database = await E2EDatabase.open(stack)
    const graphql = new E2EGraphql(stack)
    return {
        stack,
        database,
        graphql,
        auth: new E2EAuth(graphql, database),
        http: (service) => createE2EHttpClient({ baseUrl: stack.endpoint(service).baseUrl }),
        close: async () => {
            await database.close()
            stack.close()
        },
    }
}
