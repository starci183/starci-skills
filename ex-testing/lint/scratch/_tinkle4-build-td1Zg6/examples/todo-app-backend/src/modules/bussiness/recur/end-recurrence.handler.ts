import {
    Injectable 
} from "@nestjs/common"
import {
    CommandHandler 
} from "@nestjs/cqrs"
import {
    AbstractCommandHandler 
} from "@modules/platform/cqrs/abstract-handler"
import {
    RuleService 
} from "./rule.service"
import {
    OccurrenceService 
} from "./occurrence.service"
import {
    EndRecurrenceCommand, EndRecurrenceCommandResult 
} from "./end-recurrence.command"

/**
 * fr.recur.end-rule / br.recur.ending.preserves-history: sets the rule's `endedAt` and orphans every
 * occurrence of it dated on or after that day that is still `materialised`. Already-completed or
 * already-skipped occurrences are left exactly as they are, and nothing is ever deleted - `RuleService`
 * only ever writes the rule row, `OccurrenceService.orphanEndedOccurrences` only ever flips `status`.
 */
@Injectable()
@CommandHandler(EndRecurrenceCommand)
/** Decorated CQRS command handler; the bus dispatches to it and process() does the work (the abstract base keeps execute() a template). */
export class EndRecurrenceHandler extends AbstractCommandHandler<EndRecurrenceCommand, EndRecurrenceCommandResult> {
    constructor(
    private readonly ruleService: RuleService,
    private readonly occurrenceService: OccurrenceService,
    ) {
        super()
    }

    protected override async process(command: EndRecurrenceCommand): Promise<EndRecurrenceCommandResult> {
        const { params } = command
        const rule = await this.ruleService.end(params.ruleId,
            params.actorId,
            params.endedAt)
        const orphanedCount = await this.occurrenceService.orphanEndedOccurrences(rule.id,
rule.endedAt as string)
        return {
            ruleId: rule.id, endedAt: rule.endedAt as string, orphanedCount 
        }
    }
}
