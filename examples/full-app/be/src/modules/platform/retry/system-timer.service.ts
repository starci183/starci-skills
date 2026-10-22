import type { CancelTimer, Timer, TimerCallback } from "./retry.port"

/** The production timer: owns scheduling and cancellation through the host timer API. */
export class SystemTimerService implements Timer {
    /** Runs the callback after its delay unless the returned function cancels it. */
    schedule(callback: TimerCallback, delayMs: number): CancelTimer {
        const handle = setTimeout(callback, delayMs)
        return () => clearTimeout(handle)
    }
}
