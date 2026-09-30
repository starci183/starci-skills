import { CommandHandler } from "@nestjs/cqrs"
import { OccurrenceService, RuleService } from "@modules/domain/recur"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ok } from "@modules/platform/primitives"
import type { EntityManager } from "typeorm"
import { EndRecurrenceCommand } from "./end-recurrence.command"
import type { EndRecurrenceResult } from "./end-recurrence.contracts"

@CommandHandler(EndRecurrenceCommand)
/**
 * Ends a rule of the caller and orphans the occurrences of it dated on or after that day that are still materialised, in
 * one transaction. Completed and skipped occurrences stay as they are and nothing is ever deleted.
 */
export class EndRecurrenceHandler extends ICQRSHandler<EndRecurrenceCommand, EndRecurrenceResult> {
    constructor(
        @InjectLogger() logger: Logger,
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly rules: RuleService,
        private readonly occurrences: OccurrenceService,
    ) {
        super(logger)
    }

    protected override async process(command: EndRecurrenceCommand): Promise<EndRecurrenceResult> {
        const { request, principal } = command.params
        return this.entityManager.transaction(async (manager) => {
            const ended = await this.rules.end({ manager, id: request.ruleId, actorId: principal.id, endedAt: request.endedAt })
            if (ended.kind === "refused") return ended
            const orphanedCount = await this.occurrences.orphanEnded({
                manager,
                ruleId: ended.value.id,
                endedAt: request.endedAt,
            })
            return ok({ ruleId: ended.value.id, endedAt: request.endedAt, orphanedCount })
        })
    }
}
