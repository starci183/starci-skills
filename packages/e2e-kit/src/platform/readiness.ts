/** One readiness probe outcome: what was waited for and how long it took. */
export interface ReadinessResult {
  readonly label: string;
  readonly waitedMs: number;
}

/**
 * Waits inside a retry loop - never in a flow step; specs assert, the stack waits. Kept
 * exported because the loops below need it, not because a spec should call it.
 */
export const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve,
    ms))

/**
 * Polls a readiness probe until it answers true or the deadline hits. Every attempt failure
 * is captured and the LAST one names the timeout, so "postgres never came up" arrives with
 * the daemon's own error text attached. The returned ReadinessResult lets a stack service
 * record the observed boot order and per-service wait times.
 */
export async function retryUntil(
    label: string,
    deadlineMs: number,
    probe: () => Promise<boolean>,
    intervalMs = 1_000,
): Promise<ReadinessResult> {
    const startedAt = Date.now()
    let lastError = "no attempt recorded"
    while (Date.now() - startedAt < deadlineMs) {
        try {
            if (await probe()) {
                return {
                    label, waitedMs: Date.now() - startedAt 
                }
            }
        } catch (error) {
            const err = error as { stderr?: string; message?: string }
            lastError = String(err?.stderr ?? err?.message ?? error).trim().split("\n").pop() ?? lastError
        }
        await sleep(intervalMs)
    }
    throw new Error(`readiness timeout after ${deadlineMs}ms for ${label}: ${lastError}`)
}
