import { Injectable } from "@nestjs/common"
import { InjectPrimaryEntityManager, LIST_ROWS_MAX } from "@modules/platform/database"
import { InjectIds } from "@modules/platform/ids"
import type { Ids } from "@modules/platform/ids"
import { ok, refused } from "@modules/platform/primitives"
import type { Outcome } from "@modules/platform/primitives"
import { MoreThan } from "typeorm"
import type { EntityManager } from "typeorm"
import { shapeProblemOf } from "./calendar.policy"
import { RecurErrorCode } from "./errors/recur.error"
import { RuleEntity } from "./persistence/entities/rule.entity"
import { OccurrenceService } from "./occurrence.service"
import { toRuleView } from "./persistence/rule.rows"
import type {
    CreateRuleParams,
    EditRuleParams,
    EndRuleParams,
    FindRuleParams,
    ListRulesParams,
    RuleEdited,
    RuleEnded,
    RuleLookupResult,
    RuleMade,
    RuleView,
} from "./recur.contracts"

@Injectable()
/**
 * The recurrence rules: the owner is bound at creation and never rewritten, the shape of the fields must fit the
 * frequency, only the owner may edit or end a rule, and ending sets endedAt and never deletes anything. Every write runs
 * in one transaction.
 */
export class RuleService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectIds() private readonly ids: Ids,
        private readonly occurrences: OccurrenceService,
    ) {}

    /** Creates a rule owned by the caller in one transaction, or refuses fields that do not fit the frequency. */
    async create(params: CreateRuleParams): Promise<Outcome<RuleMade, RecurErrorCode.RuleInvalid>> {
        const problem = shapeProblemOf(params.frequency, params.n, params.dayOfMonth)
        if (problem) return refused(RecurErrorCode.RuleInvalid, { reason: problem })
        const saved = await this.entityManager.transaction((manager) =>
            manager.save(RuleEntity, {
                id: this.ids.next(),
                owner: params.ownerId,
                title: params.title,
                frequency: params.frequency,
                n: params.n,
                dayOfMonth: params.dayOfMonth,
                timeZone: params.timeZone,
                time: params.time,
                startDate: params.startDate,
                endedAt: null,
            }),
        )
        return ok({
            ruleId: saved.id,
            title: saved.title,
            frequency: saved.frequency,
            timeZone: saved.timeZone,
            time: saved.time,
            startDate: saved.startDate,
        })
    }

    /** The rule with this id, or null. */
    async find(params: FindRuleParams): Promise<RuleLookupResult> {
        const row = await this.entityManager.findOneBy(RuleEntity, { id: params.id })
        if (row === null) return null
        return toRuleView(row)
    }

    /** The next batch of rules in id order, at most LIST_ROWS_MAX; a batch shorter than that is the last one. */
    async listBatch(params: ListRulesParams): Promise<Array<RuleView>> {
        const rows = await this.entityManager.find(RuleEntity, {
            where: params.after === null ? {} : { id: MoreThan(params.after) },
            order: { id: "ASC" },
            take: LIST_ROWS_MAX,
        })
        return rows.map(toRuleView)
    }

    /** Changes the fields of a rule of the owner in one transaction; an occurrence already materialised is never rewritten. */
    edit(
        params: EditRuleParams,
    ): Promise<Outcome<RuleEdited, RecurErrorCode.RuleNotFound | RecurErrorCode.RuleForbidden | RecurErrorCode.RuleInvalid>> {
        return this.entityManager.transaction(async (manager) => {
            const row = await manager.findOneBy(RuleEntity, { id: params.id })
            if (!row) return refused(RecurErrorCode.RuleNotFound)
            if (row.owner !== params.actorId) return refused(RecurErrorCode.RuleForbidden)
            const { patch } = params
            const frequency = patch.frequency ?? row.frequency
            const n = patch.n !== undefined ? patch.n : row.n
            const dayOfMonth = patch.dayOfMonth !== undefined ? patch.dayOfMonth : row.dayOfMonth
            const problem = shapeProblemOf(frequency, n, dayOfMonth)
            if (problem) return refused(RecurErrorCode.RuleInvalid, { reason: problem })
            const saved = await manager.save(RuleEntity, {
                ...row,
                frequency,
                n,
                dayOfMonth,
                timeZone: patch.timeZone ?? row.timeZone,
                time: patch.time ?? row.time,
            })
            return ok({ ruleId: saved.id, frequency: saved.frequency, timeZone: saved.timeZone, time: saved.time })
        })
    }

    /**
     * Ends a rule of the owner on the local date and orphans its occurrences dated on or after it that are still
     * materialised, in one transaction: sets endedAt, never deletes a row.
     */
    end(params: EndRuleParams): Promise<Outcome<RuleEnded, RecurErrorCode.RuleNotFound | RecurErrorCode.RuleForbidden>> {
        return this.entityManager.transaction(async (manager) => {
            const row = await manager.findOneBy(RuleEntity, { id: params.id })
            if (!row) return refused(RecurErrorCode.RuleNotFound)
            if (row.owner !== params.actorId) return refused(RecurErrorCode.RuleForbidden)
            const saved = await manager.save(RuleEntity, { ...row, endedAt: params.endedAt })
            const orphanedCount = await this.occurrences.orphanEnded({ manager, ruleId: saved.id, endedAt: params.endedAt })
            return ok({ ruleId: saved.id, endedAt: params.endedAt, orphanedCount })
        })
    }
}
