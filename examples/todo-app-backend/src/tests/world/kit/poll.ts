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
    const deadline = Date.now() + timeoutMs
    let last: T | null | undefined
    for (;;) {
        last = await probe()
        if (last) return last
        if (Date.now() > deadline) {
            throw new Error(
                `timed out after ${timeoutMs}ms waiting for ${label}; last observation: ${JSON.stringify(last ?? null).slice(0,
                    700)}`,
            )
        }
        await new Promise((resolve) => setTimeout(resolve,
            intervalMs))
    }
}

/**
 * A bounded observation window for flows whose expected outcome is stillness - an ended rule that
 * must materialise nothing further, an event that must stay suppressed. There is no condition to
 * poll for when the assertion is "nothing happened", so this is the one wait that IS the state under
 * observation: it lets the world's own schedulers run for durationMs while later assertions check
 * that nothing changed.
 */
export async function holdFor(durationMs: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve,
        durationMs))
}
