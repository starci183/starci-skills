/** A callback invoked when the response deadline expires. */
export type DeadlineCallback = () => void

/** Cancels a scheduled response deadline. */
export type CancelDeadline = () => void

/** A cancellable response timer owned by the HTTP capability. */
export interface DeadlineScheduler {
    /** Runs the callback after the delay and returns its cancellation function. */
    schedule(callback: DeadlineCallback, delay: number): CancelDeadline
}
