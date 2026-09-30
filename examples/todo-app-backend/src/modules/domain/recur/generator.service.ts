import { Injectable } from "@nestjs/common"
import { LIST_ROWS_MAX } from "@modules/platform/database"
import { datesForRule } from "./calendar.policy"
import { OccurrenceService } from "./occurrence.service"
import type { CollectDueParams, DueOccurrence, RuleView } from "./recur.contracts"
import { RuleService } from "./rule.service"
import { localDateInZone, resolveRuleInstant } from "./zone.policy"

@Injectable()
/**
 * Works out which occurrences the rules owe and have not materialised yet. It walks the dates of a rule from its start
 * date up to today in the zone of the rule, every time, instead of tracking a cursor: a missed window is simply part of
 * the range every run covers, and the unique window key makes covering it twice free. Ending a rule caps the walk at the
 * day it ended. The generator writes nothing: the handler that owns the tick creates each task and then materialises it.
 */
export class GeneratorService {
    constructor(
        private readonly rules: RuleService,
        private readonly occurrences: OccurrenceService,
    ) {}

    /** The occurrences that are due at the tick instant across all rules, at most `limit`; the rest wait for the next tick. */
    async collectDue(params: CollectDueParams): Promise<Array<DueOccurrence>> {
        const due: Array<DueOccurrence> = []
        let after: string | null = null
        for (;;) {
            const batch: Array<RuleView> = await this.rules.listBatch({ after })
            for (const rule of batch) {
                if (due.length >= params.limit) return due
                due.push(...(await this.dueOf(rule, params.now, params.limit - due.length)))
            }
            const last = batch[batch.length - 1]
            if (last === undefined || batch.length < LIST_ROWS_MAX) return due
            after = last.id
        }
    }

    private async dueOf(rule: RuleView, now: Date, room: number): Promise<Array<DueOccurrence>> {
        const today = localDateInZone(rule.timeZone, now)
        const horizon = rule.endedAt !== null && rule.endedAt < today ? rule.endedAt : today
        const dates = datesForRule(
            { frequency: rule.frequency, n: rule.n, dayOfMonth: rule.dayOfMonth, startDate: rule.startDate },
            rule.startDate,
            horizon,
        )
        const windowKeys = dates.map((localDate) => `${rule.id}:${localDate}`)
        const existing = await this.occurrences.existingWindowKeys({ windowKeys })
        return dates
            .filter((_localDate, index) => !existing.has(windowKeys[index] ?? ""))
            .slice(0, room)
            .map((localDate) => ({
                ruleId: rule.id,
                ownerId: rule.owner,
                title: rule.title,
                windowKey: `${rule.id}:${localDate}`,
                localDate,
                dueAtUtc: resolveRuleInstant(rule.timeZone, localDate, rule.time).instant,
            }))
    }
}
