import { CommandHandler } from "@nestjs/cqrs"
import type { CommandBus } from "@nestjs/cqrs"
import { GeneratorService, OccurrenceService, RecurLogEvent } from "@modules/domain/recur"
import { ICQRSHandler, InjectCommandBus } from "@modules/platform/cqrs"
import { InjectPrimaryEntityManager, LIST_ROWS_MAX } from "@modules/platform/database"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { EntityManager } from "typeorm"
import { CreateTaskCommand } from "./create-task.command"
import { GenerateRecurrencesCommand } from "./generate-recurrences.command"
import type { GenerateRecurrencesResult } from "./generate-recurrences.contracts"

@CommandHandler(GenerateRecurrencesCommand)
/**
 * Materialises the occurrences the rules owe at the tick instant. Each task is created by dispatching CreateTaskCommand
 * as the owner of the rule, the one place that creates a task, so the plan cap and the audit line apply exactly as for a
 * manual create; this handler dispatches instead of calling a service because it must reuse that whole operation. The
 * occurrence row takes the id of the task and is written after it, so an occurrence whose task was refused (over the
 * plan cap) has no row and is owed again at the next tick: a refused create defers the occurrence, it does not fail
 * the generation.
 */
export class GenerateRecurrencesHandler extends ICQRSHandler<GenerateRecurrencesCommand, GenerateRecurrencesResult> {
    private readonly recurLogger: Logger

    constructor(
        @InjectLogger() logger: Logger,
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectCommandBus() private readonly commandBus: CommandBus,
        private readonly generator: GeneratorService,
        private readonly occurrences: OccurrenceService,
    ) {
        super(logger)
        this.recurLogger = logger
    }

    protected override async process(command: GenerateRecurrencesCommand): Promise<GenerateRecurrencesResult> {
        const due = await this.generator.collectDue({ now: command.params.request.at, limit: LIST_ROWS_MAX })
        let materialised = 0
        let deferred = 0
        for (const occurrence of due) {
            const created = await this.commandBus.execute(
                new CreateTaskCommand({
                    request: { title: occurrence.title },
                    principal: { id: occurrence.ownerId, roles: ["member"] },
                }),
            )
            if (created.kind === "refused") {
                deferred += 1
                continue
            }
            await this.entityManager.transaction((manager) =>
                this.occurrences.materialise({
                    manager,
                    id: created.value.taskId,
                    ruleId: occurrence.ruleId,
                    windowKey: occurrence.windowKey,
                    localDate: occurrence.localDate,
                    dueAtUtc: occurrence.dueAtUtc,
                }),
            )
            materialised += 1
        }
        if (materialised > 0) this.recurLogger.info(RecurLogEvent.GenerationMaterialised, { materialised, deferred })
        return { materialised, deferred }
    }
}
