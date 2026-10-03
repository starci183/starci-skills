import type { Clock } from "./clock.port"

/** The production clock: the one place that reads the ambient system time. It has no dependencies, so the DI container builds it without a decorator and main.ts builds it directly before the container exists. */
export class SystemClockService implements Clock {
    /** The current instant of the host clock. */
    now(): Date {
        return new Date()
    }
}
