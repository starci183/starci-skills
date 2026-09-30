/**
 * The jest globalTeardown of the test world (default export, Jest API): disposes exactly what globalSetup created and
 * verifies by observation that nothing of the run survives: both databases are dropped (and seen to be gone), the run's
 * Redis database is emptied and the state file is deleted; the stack is stopped only when this run started it, a warm stack
 * stays up.
 */
import "tsconfig-paths/register"
import { flushCache } from "./cache.client"
import { databaseExists, dropDatabase } from "./database.client"
import { resetInfra } from "./infra.client"
import { stopStack } from "./stack.client"
import { TestWorldError, TestWorldErrorCode } from "./test-world.error"
import { readWorldState, removeWorldState } from "./test-world-state.service"

/** Disposes the shared infrastructure of the run. */
export default async function globalTeardown(): Promise<void> {
    const state = readWorldState()
    const databases = [state.identity.database, state.order.database]
    try {
        try {
            await resetInfra(state.stack)
            await flushCache(state.stack, state.runId)
            for (const database of databases) await dropDatabase(state.stack, database)
        } finally {
            removeWorldState()
        }
        const survivors: Array<string> = []
        for (const database of databases) if (await databaseExists(state.stack, database)) survivors.push(database)
        if (survivors.length > 0) {
            throw new TestWorldError({
                code: TestWorldErrorCode.InfrastructureFailed,
                params: { detail: `${survivors.join(", ")} survived the teardown` },
            })
        }
    } finally {
        if (state.ownsStack) stopStack()
    }
}
