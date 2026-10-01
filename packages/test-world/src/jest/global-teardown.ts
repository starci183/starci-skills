/**
 * The jest globalTeardown of the test world (default export, Jest API): disposes exactly what the globalSetup created.
 * `src/tests/world/global-teardown.ts` re-exports it as a one-liner. Shared containers of the stack stay warm.
 */
import { TestWorldErrorCode, worldError } from "../errors"
import { setupHandles } from "./global-setup"
import { teardownWorld } from "./teardown"

/** The globalTeardown. */
export default async function globalTeardown(): Promise<void> {
    const handles = setupHandles()
    if (handles === null) return
    const failures = await teardownWorld(handles)
    ;(globalThis as Record<symbol, unknown>)[Symbol.for("@starci/test-world/setup-handles")] = undefined
    const [first] = failures
    if (first !== undefined) throw worldError(TestWorldErrorCode.InfrastructureFailed, `the teardown failed in ${failures.length} place(s)`, first)
}
