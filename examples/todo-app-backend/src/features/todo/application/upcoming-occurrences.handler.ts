import { QueryHandler } from "@nestjs/cqrs"
import { OccurrenceService, RecurErrorCode, RuleService, addDays, datesForRule, localDateInZone } from "@modules/domain/recur"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ok, refused } from "@modules/platform/primitives"
import type { UpcomingOccurrencesResult } from "./upcoming-occurrences.contracts"
import { UpcomingOccurrencesQuery } from "./upcoming-occurrences.query"

/** How many days ahead the preview looks when the request names none. */
const DEFAULT_PREVIEW_DAYS = 14

@QueryHandler(UpcomingOccurrencesQuery)
/**
 * The materialised occurrences of a rule of the caller come from the store; the preview of the dates the rule will fire
 * on next is computed live from the rule, never read from a row, because a scheduled occurrence is not a row. An ended
 * rule has no preview, only its history.
 */
export class UpcomingOccurrencesHandler extends ICQRSHandler<UpcomingOccurrencesQuery, UpcomingOccurrencesResult> {
    constructor(
        @InjectLogger() logger: Logger,
        @InjectClock() private readonly clock: Clock,
        private readonly rules: RuleService,
        private readonly occurrences: OccurrenceService,
    ) {
        super(logger)
    }

    protected override async process(query: UpcomingOccurrencesQuery): Promise<UpcomingOccurrencesResult> {
        const { request, principal } = query.params
        const rule = await this.rules.find({ id: request.ruleId })
        if (!rule) return refused(RecurErrorCode.RuleNotFound)
        if (rule.owner !== principal.id) return refused(RecurErrorCode.RuleForbidden)
        const stored = await this.occurrences.listByRule({ ruleId: rule.id })
        const materialised = stored.map((occurrence) => ({
            occurrenceId: occurrence.id,
            localDate: occurrence.localDate,
            dueAtUtc: occurrence.dueAtUtc.toISOString(),
            status: occurrence.status,
        }))
        if (rule.endedAt !== null) return ok({ ruleId: rule.id, materialised, previewDates: [] })
        const today = localDateInZone(rule.timeZone, this.clock.now())
        const previewDates = datesForRule(
            { frequency: rule.frequency, n: rule.n, dayOfMonth: rule.dayOfMonth, startDate: rule.startDate },
            today,
            addDays(today, (request.previewDays ?? DEFAULT_PREVIEW_DAYS) - 1),
        )
        return ok({ ruleId: rule.id, materialised, previewDates })
    }
}
