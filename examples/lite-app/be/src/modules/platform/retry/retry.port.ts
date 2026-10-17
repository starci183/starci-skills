/** The work to run when a scheduled timer expires. */
export type TimerCallback = () => void

/** Cancels a callback that has not run yet. */
export type CancelTimer = () => void

/** Schedules bounded work without exposing the ambient host timers to consumers. */
export interface Timer {
    /** Schedules a callback and returns the function that cancels it. */
    schedule(callback: TimerCallback, delayMs: number): CancelTimer
}
