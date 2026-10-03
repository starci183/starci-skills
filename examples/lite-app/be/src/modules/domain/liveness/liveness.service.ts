import { Injectable } from "@nestjs/common"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import type { LivenessReport } from "./liveness.contracts"

const MS_PER_SECOND = 1000

@Injectable()
/** The liveness of this process: it answers ok with when it started and how long it has been up, read from the Clock. */
export class LivenessService {
    private readonly startedAt: Date

    constructor(@InjectClock() private readonly clock: Clock) {
        this.startedAt = clock.now()
    }

    /** The report of one probe; it reads no dependency, so an outage elsewhere never restarts the process. */
    check(): Promise<LivenessReport> {
        const uptime = this.clock.now().getTime() - this.startedAt.getTime()
        return Promise.resolve({
            status: "ok",
            startedAt: this.startedAt.toISOString(),
            uptimeSeconds: Math.floor(uptime / MS_PER_SECOND),
        })
    }
}
