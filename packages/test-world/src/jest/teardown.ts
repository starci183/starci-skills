import { rmSync } from "node:fs"
import { removeRunContext } from "./context"
import { removeSiblings } from "./siblings"
import type { SetupHandles } from "./setup"

/**
 * Disposes exactly what the setup created for this run: the fakes host, the sibling containers, this repository's databases,
 * realm, redis db, buckets, collections, topics, namespaces and proxies (the shared containers stay warm), the run
 * directory and the state file. Answers the failures it met instead of stopping at the first, so every part gets its turn.
 */
export const teardownWorld = async (handles: SetupHandles): Promise<ReadonlyArray<unknown>> => {
    const failures: Array<unknown> = []
    const attempt = async (work: () => Promise<unknown> | unknown): Promise<void> => {
        try {
            await work()
        } catch (cause) {
            failures.push(cause)
        }
    }
    const { context } = handles
    await attempt(() => handles.fakes.close())
    await attempt(() => removeSiblings(handles.siblings))
    await attempt(async () => {
        const { stack } = await import("../stack")
        await stack.detach({ namespace: context.namespace, runId: context.runId, infra: context.infra })
    })
    await attempt(() => {
        for (const directory of Object.values(context.directories)) rmSync(directory, { recursive: true, force: true })
    })
    await attempt(() => removeRunContext())
    return failures
}
