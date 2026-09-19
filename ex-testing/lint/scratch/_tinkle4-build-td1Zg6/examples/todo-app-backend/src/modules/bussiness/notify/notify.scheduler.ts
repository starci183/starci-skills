import {
    Injectable, OnModuleDestroy, OnModuleInit 
} from "@nestjs/common"
import {
    LogEvent 
} from "@modules/platform/logging/log-events"
import {
    WinstonService 
} from "@modules/platform/logging/winston.service"
import {
    NotifyService 
} from "./notify.service"

const TICK_MS = 5_000

/**
 * nfr.notify.delivery.latency: the real wall-clock timer that closes a digest window and retries a
 * backed-off delivery. sds.notify.delivery-lifecycle's t-dispatch is triggered
 * `on: window-closed-or-immediate`; this is the "closed" half, driven by an actual interval rather than
 * by another `admit()` call happening to occur after the deadline. No unit spec in this module
 * constructs this class: every behaviour spec calls `NotifyService.runDueJobs` directly with an explicit
 * `now`, so correctness never depends on real elapsed time - this class is wiring, proven by
 * `notify.scheduler.spec.ts` only for start/stop, not for timing.
 */
@Injectable()
/** Scheduler owning the notify capability's wall-clock tick; the work each tick performs lives in the injected service. */
export class NotifyScheduler implements OnModuleInit, OnModuleDestroy {
    private timer: NodeJS.Timeout | undefined

    constructor(
        private readonly notify: NotifyService,
        private readonly winston: WinstonService,
    ) {}

    onModuleInit(): void {
        this.timer = setInterval(() => {
            // A rejecting tick (e.g. the primary database being down) must not escape as an
            // unhandled rejection - that kills the api. The tick is fire-and-forget, so the
            // failure is observed here and the next interval retries on its own.
            void this.notify.runDueJobs(new Date()).catch((reason: unknown) => this.winston.log(LogEvent.NOTIFY_DISPATCH_TICK_FAILED,
                {
                    reason: String(reason) 
                }))
        },
        TICK_MS)
    }

    onModuleDestroy(): void {
        if (this.timer) {
            clearInterval(this.timer)
            this.timer = undefined
        }
    }
}
