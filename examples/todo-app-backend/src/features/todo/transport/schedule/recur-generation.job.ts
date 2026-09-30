import { Injectable } from "@nestjs/common"
import type { CommandBus } from "@nestjs/cqrs"
import { InjectRecurOptions } from "@modules/domain/recur"
import type { RecurOptions } from "@modules/domain/recur"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { CronSchedule, ScheduledJob } from "@modules/platform/scheduling"
import { GenerateRecurrencesCommand } from "../../application/generate-recurrences.command"

@Injectable()
/** The recurrence generation tick: on the configured cron it asks for the due occurrences of every rule to be materialised. */
export class RecurGenerationJob implements ScheduledJob {
    /** The job name, also the name of the lease that keeps one replica per tick. */
    readonly name = "recur.generation"

    /** The cron of the tick, from the recur options. */
    readonly schedule: CronSchedule

    constructor(
        @InjectCommandBus() private readonly commandBus: CommandBus,
        @InjectRecurOptions() options: RecurOptions,
    ) {
        this.schedule = { cron: options.tickCron }
    }

    /** Dispatches one generation command for the tick at `at`. */
    async run(at: Date): Promise<void> {
        await this.commandBus.execute(new GenerateRecurrencesCommand({ request: { at } }))
    }
}
