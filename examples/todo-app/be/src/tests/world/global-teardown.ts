/**
 * The jest globalTeardown of the test world (default export, Jest API): disposes exactly what globalSetup created and
 * verifies by observation that nothing of the run survives: the fakes host is told to shut down, the database and Keycloak
 * containers are removed with their volumes, the upload directory and the state file are deleted.
 */
import "tsconfig-paths/register"
import { rmSync } from "node:fs"
import { containersNamed, removeContainer } from "./docker.client"
import { TestWorldError, TestWorldErrorCode } from "./test-world.error"
import { readWorldState, removeWorldState } from "./test-world-state.service"

/** Disposes the shared infrastructure of the run. */
export default async function globalTeardown(): Promise<void> {
    const state = readWorldState()
    try {
        await fetch(`${state.controlUrl}/control/shutdown`, { method: "POST", signal: AbortSignal.timeout(10_000) })
    } finally {
        removeContainer(state.databaseContainer)
        removeContainer(state.keycloakContainer)
        rmSync(state.uploadDir, { recursive: true, force: true })
        removeWorldState()
    }
    const survivors = [state.databaseContainer, state.keycloakContainer].filter(
        (name) => containersNamed(name).length > 0,
    )
    if (survivors.length > 0) {
        throw new TestWorldError({
            code: TestWorldErrorCode.InfrastructureFailed,
            params: { detail: `${survivors.join(", ")} survived the teardown` },
        })
    }
}
