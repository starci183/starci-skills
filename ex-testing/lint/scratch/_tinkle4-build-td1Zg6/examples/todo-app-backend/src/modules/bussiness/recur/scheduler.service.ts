/** Scheduler service for the scheduler.service flow - one named step of the recur capability's behaviour. */
import {
    Injectable, OnModuleInit 
} from "@nestjs/common"
import {
    SchedulerRegistry 
} from "@nestjs/schedule"
import {
    CronJob 
} from "cron"
import {
    AppConfigService 
} from "@modules/platform/config/app-config.service"
import {
    LogEvent 
} from "@modules/platform/logging/log-events"
import {
    WinstonService 
} from "@modules/platform/logging/winston.service"
import {
    GeneratorService 
} from "./generator.service"

/**
 * integration.recur.scheduler: this product owns the generation logic entirely
 * (sds.recur.generation-engine, `GeneratorService`) - `@nestjs/schedule`'s only job is firing a callback
 * at a configured interval, in-process, inside the same NestJS application as the API (this integration
 * record's own `boundary`). The tick is also manually invokable outside any real timer -
 * `GeneratorService.runOnce`/`runForRule` are called directly by every unit test - so a live tick is
 * never the only way to observe generation working, only the only way to observe the scheduler's own
 * wiring.
 *
 * The cron job is registered dynamically (via `SchedulerRegistry`, not the `@Cron(...)` decorator)
 * because its interval comes from `AppConfigService.getRecurTickCron()`: the endpoint this integration
 * record declares is `*\/5 * * * *` (every 5 minutes) and that stays the default everywhere, but
 * `scripts/live-proof-recur.sh` sets `RECUR_TICK_CRON` to a much shorter interval so its own live run
 * can observe a real tick materialise a real occurrence without a 5-minute wait, without that override
 * ever touching the declared production interval.
 */
@Injectable()
/** Injectable service owning the recur generation tick: registers the configured cron and delegates each fire to GeneratorService. */
export class SchedulerService implements OnModuleInit {
    constructor(
    private readonly generatorService: GeneratorService,
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly config: AppConfigService,
    private readonly winstonService: WinstonService,
    ) {}

    onModuleInit(): void {
        const cronTime = this.config.getRecurTickCron()
        const job = new CronJob(cronTime,
            () => {
                // A rejecting tick (e.g. the primary database being down) must not escape as an
                // unhandled rejection - that kills the api. The tick is fire-and-forget, so the
                // failure is observed here and the next scheduled fire retries on its own.
                void this.onTick().catch((reason: unknown) => this.winstonService.log(LogEvent.RECUR_GENERATION_TICK_FAILED,
                    {
                        reason: String(reason) 
                    }))
            })
        this.schedulerRegistry.addCronJob("recur-generation-tick",
            job)
        job.start()
    }

    async onTick(): Promise<void> {
        const summary = await this.generatorService.runOnce(new Date())
        if (summary.materialised.length > 0) {
            this.winstonService.log(LogEvent.RECUR_GENERATION_TICK_MATERIALISED,
                {
                    materialised: summary.materialised.length 
                })
        }
    }
}
