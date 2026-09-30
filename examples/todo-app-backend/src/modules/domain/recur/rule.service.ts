import { randomUUID } from "node:crypto"
import { Injectable } from "@nestjs/common"
import { InjectPrimaryEntityManager, LIST_ROWS_MAX } from "@modules/platform/database"
import { ok, refused } from "@modules/platform/primitives"
import type { Outcome } from "@modules/platform/primitives"
import { MoreThan } from "typeorm"
import type { EntityManager } from "typeorm"
import { shapeProblemOf } from "./calendar.policy"
import { RecurErrorCode } from "./errors/recur.error"
import { RuleEntity } from "./persistence/entities/rule.entity"
import { toRuleView } from "./persistence/rule.rows"
import type {
    CreateRuleParams,
    EditRuleParams,
    EndRuleParams,
    FindRuleParams,
    ListRulesParams,
    RuleLookupResult,
    RuleView,
} from "./recur.contracts"

@Injectable()
/**
 * The recurrence rules: the owner is bound at creation and never rewritten, the shape of the fields must fit the
 * frequency, only the owner may edit or end a rule, and ending sets endedAt and never deletes anything.
 */
export class RuleService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** Creates a rule owned by the caller, or refuses fields that do not fit the frequency. */
    async create(params: CreateRuleParams): Promise<Outcome<RuleView, RecurErrorCode.RuleInvalid>> {
        const problem = shapeProblemOf(params.frequency, params.n, params.dayOfMonth)
        if (problem) return refused(RecurErrorCode.RuleInvalid, { reason: problem })
        const saved = await params.manager.save(RuleEntity, {
            id: randomUUID(),
            owner: params.ownerId,
            title: params.title,
            frequency: params.frequency,
            n: params.n,
            dayOfMonth: params.dayOfMonth,
            timeZone: params.timeZone,
            time: params.time,
            startDate: params.startDate,
            endedAt: null,
        })
        return ok(toRuleView(saved))
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

    /** Changes the fields of a rule of the owner; an occurrence already materialised is never rewritten. */
    async edit(
        params: EditRuleParams,
    ): Promise<Outcome<RuleView, RecurErrorCode.RuleNotFound | RecurErrorCode.RuleForbidden | RecurErrorCode.RuleInvalid>> {
        const row = await params.manager.findOneBy(RuleEntity, { id: params.id })
        if (!row) return refused(RecurErrorCode.RuleNotFound)
        if (row.owner !== params.actorId) return refused(RecurErrorCode.RuleForbidden)
        const { patch } = params
        const frequency = patch.frequency ?? row.frequency
        const n = patch.n !== undefined ? patch.n : row.n
        const dayOfMonth = patch.dayOfMonth !== undefined ? patch.dayOfMonth : row.dayOfMonth
        const problem = shapeProblemOf(frequency, n, dayOfMonth)
        if (problem) return refused(RecurErrorCode.RuleInvalid, { reason: problem })
        const saved = await params.manager.save(RuleEntity, {
            ...row,
            frequency,
            n,
            dayOfMonth,
            timeZone: patch.timeZone ?? row.timeZone,
            time: patch.time ?? row.time,
        })
        return ok(toRuleView(saved))
    }

    /** Ends a rule of the owner on the local date: sets endedAt, never deletes the row. */
    async end(params: EndRuleParams): Promise<Outcome<RuleView, RecurErrorCode.RuleNotFound | RecurErrorCode.RuleForbidden>> {
        const row = await params.manager.findOneBy(RuleEntity, { id: params.id })
        if (!row) return refused(RecurErrorCode.RuleNotFound)
        if (row.owner !== params.actorId) return refused(RecurErrorCode.RuleForbidden)
        const saved = await params.manager.save(RuleEntity, { ...row, endedAt: params.endedAt })
        return ok(toRuleView(saved))
    }
}
