import { TestWorldErrorCode, worldError } from "../errors"

const OBSERVATION_LIMIT = 700

/** Waits `ms` milliseconds: the one timer of the library, used only inside its own poll and retry loops. */
export const pause = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * The state-poller every journey shares: a flow waits for a STATE, never a duration. `probe` answers the observed value
 * once the state it watches has arrived, or a falsy value while it has not; the first truthy observation is returned, and
 * the failure at the deadline names `label` and the last observation.
 */
export const pollUntil = async <T>(label: string, probe: () => Promise<T | null | undefined>, timeoutMs = 20_000, intervalMs = 250): Promise<T> => {
    const deadline = Date.now() + timeoutMs
    for (;;) {
        const observed = await probe()
        if (observed) return observed
        if (Date.now() > deadline) {
            throw worldError(
                TestWorldErrorCode.TimedOut,
                `timed out after ${timeoutMs}ms waiting for ${label}; last observation: ${JSON.stringify(observed ?? null).slice(0, OBSERVATION_LIMIT)}`,
            )
        }
        await pause(intervalMs)
    }
}
