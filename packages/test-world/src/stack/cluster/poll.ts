/** Time, injectable so polls are testable without waiting. */
export interface Clock {
    pause(ms: number): Promise<void>
    now(): number
}

/** The real clock. */
export const realClock: Clock = {
    pause: (ms) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
    now: () => Date.now(),
}

/** Calls `check` until it answers a value (not null/undefined) or `timeoutMs` passed; the check always runs at least once. Answers null at the deadline. */
export const pollUntil = async <T>(clock: Clock, timeoutMs: number, intervalMs: number, check: () => Promise<T | null | undefined>): Promise<T | null> => {
    const deadline = clock.now() + timeoutMs
    for (;;) {
        const value = await check()
        if (value !== null && value !== undefined) return value
        if (clock.now() >= deadline) return null
        await clock.pause(intervalMs)
    }
}
