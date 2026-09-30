import { CommandHandler } from "@nestjs/cqrs"
import { RuleService } from "@modules/domain/recur"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
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
        private readonly rules: RuleService,
    ) {
        super(logger)
    }

    protected override async process(command: EndRecurrenceCommand): Promise<EndRecurrenceResult> {
        const { request, principal } = command.params
        return this.rules.end({ id: request.ruleId, actorId: principal.id, endedAt: request.endedAt })
    }
}
