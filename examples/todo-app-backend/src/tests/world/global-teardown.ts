/**
 * The jest globalTeardown of the test world (default export, Jest API): disposes exactly what globalSetup created and
 * verifies by observation that nothing of the run survives: the fakes host is told to shut down, the run's database is
 * dropped (and seen to be gone), the upload directory and the state file are deleted, and the stack is stopped only when this
 * run started it: a warm stack stays up.
 */
import "tsconfig-paths/register"
import { rmSync } from "node:fs"
import { databaseExists, dropDatabase } from "./database.client"
import { resetInfra } from "./infra.client"
import { stopStack } from "./stack.client"
import { TestWorldError, TestWorldErrorCode } from "./test-world.error"
import { readWorldState, removeWorldState } from "./test-world-state.service"

/** Disposes the shared infrastructure of the run. */
export default async function globalTeardown(): Promise<void> {
    const state = readWorldState()
    try {
        try {
            await fetch(`${state.controlUrl}/control/shutdown`, { method: "POST", signal: AbortSignal.timeout(10_000) })
        } finally {
            await resetInfra(state.stack)
            await dropDatabase(state.stack, state.databaseName)
            rmSync(state.uploadDir, { recursive: true, force: true })
            removeWorldState()
        }
        if (await databaseExists(state.stack, state.databaseName)) {
            throw new TestWorldError({
                code: TestWorldErrorCode.InfrastructureFailed,
                params: { detail: `the database ${state.databaseName} survived the teardown` },
            })
        }
    } finally {
        if (state.ownsStack) stopStack()
    }
}
