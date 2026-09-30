import { randomUUID } from "node:crypto"
import { Injectable } from "@nestjs/common"
import { AuditAction, toAuditAppendMessage } from "@modules/domain/audit"
import { CapGuardPolicy } from "@modules/domain/plan"
import { TaskService } from "@modules/domain/task"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager, LIST_ROWS_MAX } from "@modules/platform/database"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { InjectOutbox } from "@modules/platform/outbox"
import type { Outbox } from "@modules/platform/outbox"
import { ok, refused } from "@modules/platform/primitives"
import type { Outcome } from "@modules/platform/primitives"
import type { EntityManager } from "typeorm"
import { addDays, datesForRule } from "./calendar.policy"
import { RecurErrorCode } from "./errors/recur.error"
import { OccurrenceService } from "./occurrence.service"
import type {
    CollectDueParams,
    DueOccurrence,
    GenerateParams,
    GenerationSummary,
    RuleView,
    UpcomingParams,
    UpcomingSummary,
} from "./recur.contracts"
import { RecurLogEvent } from "./recur.log-events"
import { RuleService } from "./rule.service"
import { localDateInZone, resolveRuleInstant } from "./zone.policy"

/** How many days ahead the preview looks when the request names none. */
const DEFAULT_PREVIEW_DAYS = 14

@Injectable()
/**
 * Works out which occurrences the rules owe and materialises them, and previews the dates a rule fires on next. It walks
 * the dates of a rule from its start date up to today in the zone of the rule, every time, instead of tracking a cursor:
 * a missed window is simply part of the range every run covers, and the unique window key makes covering it twice free.
 * Ending a rule caps the walk at the day it ended. Each occurrence gets its task from the same plan cap as a manual
 * create and the same audit line, and the occurrence row takes the id of the task and is written in the same transaction,
 * so an occurrence whose task was refused (over the plan cap) has no row and is owed again at the next tick: a refused
 * create defers the occurrence, it does not fail the generation.
 */
export class GeneratorService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        @InjectOutbox() private readonly outbox: Outbox,
        @InjectLogger() private readonly logger: Logger,
        private readonly rules: RuleService,
        private readonly occurrences: OccurrenceService,
        private readonly tasks: TaskService,
        private readonly capGuard: CapGuardPolicy,
    ) {}

    /** Materialises the occurrences the rules owe at the tick instant, at most LIST_ROWS_MAX; the rest wait for the next tick. */
    async generate(params: GenerateParams): Promise<GenerationSummary> {
        const due = await this.collectDue({ now: params.at, limit: LIST_ROWS_MAX })
        let materialised = 0
        let deferred = 0
        for (const occurrence of due) {
            if (await this.materialiseDue(occurrence)) materialised += 1
            else deferred += 1
        }
        if (materialised > 0) this.logger.info(RecurLogEvent.GenerationMaterialised, { materialised, deferred })
        return { materialised, deferred }
    }

    /**
     * The materialised occurrences of a rule of the caller come from the store; the preview of the dates the rule will
     * fire on next is computed live from the rule, never read from a row, because a scheduled occurrence is not a row.
     * An ended rule has no preview, only its history.
     */
    async upcoming(
        params: UpcomingParams,
    ): Promise<Outcome<UpcomingSummary, RecurErrorCode.RuleNotFound | RecurErrorCode.RuleForbidden>> {
        const rule = await this.rules.find({ id: params.ruleId })
        if (!rule) return refused(RecurErrorCode.RuleNotFound)
        if (rule.owner !== params.actorId) return refused(RecurErrorCode.RuleForbidden)
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
            addDays(today, (params.previewDays ?? DEFAULT_PREVIEW_DAYS) - 1),
        )
        return ok({ ruleId: rule.id, materialised, previewDates })
    }

    /** True when the task and the occurrence row were written, false when the task was refused and the occurrence stays owed. */
    private async materialiseDue(occurrence: DueOccurrence): Promise<boolean> {
        const owned = await this.tasks.listOwnedBy({ ownerId: occurrence.ownerId })
        const verdict = await this.capGuard.check({
            personId: occurrence.ownerId,
            activeTaskCount: owned.filter((task) => !task.complete).length,
        })
        if (!verdict.allowed) return false
        const at = this.clock.now()
        return this.entityManager.transaction(async (manager) => {
            const created = await this.tasks.create({ manager, ownerId: occurrence.ownerId, title: occurrence.title })
            if (created.kind === "refused") return false
            await this.outbox.enqueue(
                manager,
                toAuditAppendMessage({
                    eventId: randomUUID(),
                    actorId: occurrence.ownerId,
                    action: AuditAction.TaskCreated,
                    target: created.value.id,
                    at,
                }),
            )
            await this.occurrences.materialise({
                manager,
                id: created.value.id,
                ruleId: occurrence.ruleId,
                windowKey: occurrence.windowKey,
                localDate: occurrence.localDate,
                dueAtUtc: occurrence.dueAtUtc,
            })
            return true
        })
    }

    private async collectDue(params: CollectDueParams): Promise<Array<DueOccurrence>> {
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
        const existing = await this.occurrences.existingWindowKeys({ windowKeys: dates.map((localDate) => `${rule.id}:${localDate}`) })
        return dates
            .filter((localDate) => !existing.has(`${rule.id}:${localDate}`))
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
