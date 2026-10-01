import { Injectable } from "@nestjs/common"
import type { CommandBus } from "@nestjs/cqrs"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { CronSchedule, ScheduledJob } from "@modules/platform/scheduling"
import { GenerateRecurrencesCommand } from "../../application/generate-recurrences.command"

@Injectable()
/** The recurrence generation tick: every minute it asks for the due occurrences to be materialised; the handler keeps the configured cadence. */
export class RecurGenerationJob implements ScheduledJob {
    /** The job name, also the name of the lease that keeps one replica per tick. */
    readonly name = "recur.generation"

    /** Every minute, the finest cadence the recur options can choose. */
    readonly schedule: CronSchedule = { cron: "* * * * *" }

    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Dispatches one generation command for the tick at `at`. */
    async run(at: Date): Promise<void> {
        await this.commandBus.execute(new GenerateRecurrencesCommand({ request: { at } }))
    }
}
