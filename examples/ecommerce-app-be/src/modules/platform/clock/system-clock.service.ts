import { Injectable } from "@nestjs/common"
import type { Clock } from "./clock.port"

@Injectable()
/** The production clock: the one place that reads the ambient system time. */
export class SystemClock implements Clock {
    /** The current instant of the host clock. */
    now(): Date {
        return new Date()
    }
}
