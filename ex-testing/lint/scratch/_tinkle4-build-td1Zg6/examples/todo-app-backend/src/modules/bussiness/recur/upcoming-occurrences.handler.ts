import {
    Injectable 
} from "@nestjs/common"
import {
    QueryHandler 
} from "@nestjs/cqrs"
import {
    AbstractQueryHandler 
} from "@modules/platform/cqrs/abstract-handler"
import {
    RecurRuleForbiddenException 
} from "@modules/shared/exceptions/errors/recur/rule-forbidden"

import {
    RuleService 
} from "./rule.service"
import {
    OccurrenceService 
} from "./occurrence.service"
import {
    addDays, datesForRule 
} from "./calendar.util"
import {
    localDateInZone 
} from "./zone.util"
import {
    UpcomingOccurrencesQuery, UpcomingOccurrencesQueryResult 
} from "./upcoming-occurrences.query"

const DEFAULT_PREVIEW_DAYS = 14

/**
 * fr.recur.see-upcoming: materialised occurrences are read from the store; the preview of dates the
 * rule will next fire on is computed live from the rule's own shape (`calendar.util.datesForRule`),
 * never read from a stored row - "scheduled" is not a row (sds.recur.occurrence-lifecycle). An ended
 * rule's preview is always empty, only its history remains.
 */
@Injectable()
@QueryHandler(UpcomingOccurrencesQuery)
/** Decorated CQRS query handler; the bus dispatches to it and process() does the work (the abstract base keeps execute() a template). */
export class UpcomingOccurrencesHandler extends AbstractQueryHandler<UpcomingOccurrencesQuery, UpcomingOccurrencesQueryResult> {
    constructor(
    private readonly ruleService: RuleService,
    private readonly occurrenceService: OccurrenceService,
    ) {
        super()
    }

    protected override async process(query: UpcomingOccurrencesQuery): Promise<UpcomingOccurrencesQueryResult> {
        const { params } = query
        const rule = await this.ruleService.findById(params.ruleId)
        if (rule.owner !== params.actorId) {
            throw new RecurRuleForbiddenException({
                ruleId: params.ruleId, actorId: params.actorId 
            })
        }

        const occurrences = await this.occurrenceService.listByRule(params.ruleId)
        const materialised = occurrences.map(occurrence => ({
            occurrenceId: occurrence.id,
            localDate: occurrence.localDate,
            dueAtUtc: occurrence.dueAtUtc.toISOString(),
            status: occurrence.status,
        }))

        let previewDates: Array<string> = []
        if (rule.endedAt === null) {
            const today = localDateInZone(rule.timeZone,
                new Date())
            const horizon = addDays(today,
                (params.previewDays ?? DEFAULT_PREVIEW_DAYS) - 1)
            previewDates = datesForRule(
                {
                    frequency: rule.frequency, n: rule.n, dayOfMonth: rule.dayOfMonth, startDate: rule.startDate 
                },
                today,
                horizon,
            )
        }

        return {
            ruleId: rule.id, materialised, previewDates 
        }
    }
}
