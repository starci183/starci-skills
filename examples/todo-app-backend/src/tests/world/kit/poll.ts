import { TestWorldError, TestWorldErrorCode } from "../test-world.error"
import { worldClock } from "./world-clock"

const OBSERVATION_LIMIT = 700

/** Waits `ms` milliseconds: the one timer of the test world, used only inside its poll and retry loops. */
export const pause = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * The state-poller every journey shares: a flow waits for a STATE, never a duration, so the test
 * names what it waited for and the timeout names what never arrived. `probe` answers the observed
 * value once the state it watches has arrived, or a falsy value while it has not; pollUntil returns
 * that first truthy observation or throws with the last one attached to the failure.
 */
export async function pollUntil<T>(
    label: string,
    probe: () => Promise<T | null | undefined>,
    timeoutMs = 20_000,
    intervalMs = 250,
): Promise<T> {
    const deadline = worldClock.now().getTime() + timeoutMs
    for (;;) {
        const observed = await probe()
        if (observed) return observed
        if (worldClock.now().getTime() > deadline) {
            throw new TestWorldError({
                code: TestWorldErrorCode.TimedOut,
                params: { detail: `timed out after ${timeoutMs}ms waiting for ${label}; last observation: ${JSON.stringify(observed ?? null).slice(0, OBSERVATION_LIMIT)}` },
            })
        }
        await pause(intervalMs)
    }
}
