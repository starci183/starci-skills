import { removeRunState } from "./context"
import { disposeSlot } from "./setup"
import type { SetupHandles } from "./setup"

/**
 * Disposes exactly what the setup created for this run, slot by slot: the fakes host, the sibling containers, the slot's
 * databases, realm, redis db, buckets, collections, topics, namespaces and proxies (the shared containers stay warm), the
 * slot's run directory; then the state file. Answers the failures it met instead of stopping at the first, so every slot and
 * every part gets its turn.
 */
export const teardownWorld = async (handles: SetupHandles): Promise<ReadonlyArray<unknown>> => {
    const failures: Array<unknown> = []
    for (const slot of handles.slots) failures.push(...(await disposeSlot(slot)))
    try {
        removeRunState()
    } catch (cause) {
        failures.push(cause)
    }
    return failures
}
