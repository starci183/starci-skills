import { Injectable } from "@nestjs/common"
import type { CancelDeadline, DeadlineCallback, DeadlineScheduler } from "./deadline.port"

@Injectable()
/** The native cancellable timer used to bound dependency responses. */
export class DeadlineSchedulerService implements DeadlineScheduler {
    /** Bounds a dependency response and always cancels its response timer. */
    async run<T>(operation: Promise<T>, timeoutMs: number): Promise<T> {
        let cancel: (() => void) | undefined
        const deadline = new Promise<never>((_resolve, reject) => {
            cancel = this.schedule(reject, timeoutMs)
        })
        try {
            return await Promise.race([operation, deadline])
        } finally {
            cancel?.()
        }
    }

    /** Schedules one response deadline and returns an idempotent cancellation. */
    schedule(callback: DeadlineCallback, delay: number): CancelDeadline {
        const timer = setTimeout(callback, delay)
        return () => clearTimeout(timer)
    }
}
