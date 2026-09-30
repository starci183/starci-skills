import { CommandHandler } from "@nestjs/cqrs"
import { RuleService } from "@modules/domain/recur"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
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
        private readonly rules: RuleService,
    ) {
        super(logger)
    }

    protected override async process(command: EditRecurrenceCommand): Promise<EditRecurrenceResult> {
        return this.rules.edit({
            id: command.params.request.ruleId,
            actorId: command.params.principal.id,
            patch: {
                frequency: command.params.request.frequency,
                n: command.params.request.n,
                dayOfMonth: command.params.request.dayOfMonth,
                timeZone: command.params.request.timeZone,
                time: command.params.request.time,
            },
        })
    }
}
