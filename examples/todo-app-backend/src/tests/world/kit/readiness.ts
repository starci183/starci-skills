import { TestWorldError, TestWorldErrorCode } from "../test-world.error"
import { pause } from "./poll"
import { worldClock } from "./world-clock"

/** One readiness probe outcome: what was waited for and how long it took. */
export interface ReadinessResult {
    readonly label: string
    readonly waitedMs: number
}

/** What one attempt of a probe came to: ready, or not ready with the failure the probe raised (null when it only answered false). */
interface ProbeAttempt {
    readonly ready: boolean
    readonly failure: unknown
}

const attempt = async (probe: () => Promise<boolean>): Promise<ProbeAttempt> => {
    try {
        return { ready: await probe(), failure: null }
    } catch (cause) {
        return { ready: false, failure: cause }
    }
}

/**
 * Polls a readiness probe until it answers true or the deadline hits. The failure of the LAST attempt is the cause of the
 * timeout, so "postgres never came up" arrives with the daemon's own error attached. The returned ReadinessResult lets a
 * caller record the observed wait.
 */
export async function retryUntil(label: string, deadlineMs: number, probe: () => Promise<boolean>, intervalMs = 1_000): Promise<ReadinessResult> {
    const startedAt = worldClock.now().getTime()
    let failure: unknown = null
    while (worldClock.now().getTime() - startedAt < deadlineMs) {
        const answer = await attempt(probe)
        if (answer.ready) return { label, waitedMs: worldClock.now().getTime() - startedAt }
        failure = answer.failure
        await pause(intervalMs)
    }
    throw new TestWorldError({
        code: TestWorldErrorCode.TimedOut,
        params: { detail: `readiness timeout after ${deadlineMs}ms for ${label}` },
        cause: failure,
    })
}
