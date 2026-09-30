import { CommandHandler } from "@nestjs/cqrs"
import { RuleService } from "@modules/domain/recur"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ok } from "@modules/platform/primitives"
import type { EntityManager } from "typeorm"
import { EditRecurrenceCommand } from "./edit-recurrence.command"
import type { EditRecurrenceResult } from "./edit-recurrence.contracts"

@CommandHandler(EditRecurrenceCommand)
/**
 * Changes a rule of the caller; only the owner may. Occurrences already materialised are never rewritten: the generator
 * reads the current shape of the rule the next time it walks the dates, so the occurrences not yet materialised follow
 * the new rule on their own.
 */
export class EditRecurrenceHandler extends ICQRSHandler<EditRecurrenceCommand, EditRecurrenceResult> {
    constructor(
        @InjectLogger() logger: Logger,
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly rules: RuleService,
    ) {
        super(logger)
    }

    protected override async process(command: EditRecurrenceCommand): Promise<EditRecurrenceResult> {
        const { request, principal } = command.params
        const edited = await this.entityManager.transaction((manager) =>
            this.rules.edit({
                manager,
                id: request.ruleId,
                actorId: principal.id,
                patch: {
                    frequency: request.frequency,
                    n: request.n,
                    dayOfMonth: request.dayOfMonth,
                    timeZone: request.timeZone,
                    time: request.time,
                },
            }),
        )
        if (edited.kind === "refused") return edited
        const rule = edited.value
        return ok({ ruleId: rule.id, frequency: rule.frequency, timeZone: rule.timeZone, time: rule.time })
    }
}
