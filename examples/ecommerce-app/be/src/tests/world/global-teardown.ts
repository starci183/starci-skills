/**
 * The jest globalTeardown of the test world (default export, Jest API): disposes exactly what globalSetup created and
 * verifies by observation that nothing of the run survives: both database containers are removed with their volumes and
 * the state file is deleted.
 */
import "tsconfig-paths/register"
import { containersNamed, removeContainer } from "./docker.client"
import { TestWorldError, TestWorldErrorCode } from "./test-world.error"
import { readWorldState, removeWorldState } from "./test-world-state.service"

/** Disposes the shared infrastructure of the run. */
export default function globalTeardown(): void {
    const state = readWorldState()
    const containers = [state.identity.container, state.order.container]
    try {
        containers.forEach(removeContainer)
    } finally {
        removeWorldState()
    }
    const survivors = containers.filter((name) => containersNamed(name).length > 0)
    if (survivors.length > 0) {
        throw new TestWorldError({
            code: TestWorldErrorCode.InfrastructureFailed,
            params: { detail: `${survivors.join(", ")} survived the teardown` },
        })
    }
}
