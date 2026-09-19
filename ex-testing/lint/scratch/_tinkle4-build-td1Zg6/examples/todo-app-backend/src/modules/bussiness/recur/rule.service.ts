import {
    Injectable 
} from "@nestjs/common"
import {
    randomUUID 
} from "node:crypto"
import type {
    EntityManager 
} from "typeorm"
import {
    InjectPrimaryEntityManager 
} from "@modules/platform/databases/postgresql/primary/primary.decorators"
import {
    RuleEntity 
} from "@modules/platform/databases/postgresql/primary/entities/rule.entity"
import {
    RecurRuleForbiddenException 
} from "@modules/shared/exceptions/errors/recur/rule-forbidden"
import {
    RecurRuleInvalidException 
} from "@modules/shared/exceptions/errors/recur/rule-invalid"
import {
    RecurRuleNotFoundException 
} from "@modules/shared/exceptions/errors/recur/rule-not-found"

import {
    RuleFrequency 
} from "./calendar.util"
import {
    RuleRecord 
} from "./types/rule-record"

/** Contract naming the create rule input shape bussiness/recur code and its consumers share; a second site never retypes it inline. */
export interface CreateRuleInput {
  readonly owner: string;
  readonly title: string;
  readonly frequency: RuleFrequency;
  readonly n?: number | null;
  readonly dayOfMonth?: number | null;
  readonly timeZone: string;
  readonly time: string;
  readonly startDate: string;
}

/** Contract naming the edit rule input shape bussiness/recur code and its consumers share; a second site never retypes it inline. */
export interface EditRuleInput {
  readonly frequency?: RuleFrequency;
  readonly n?: number | null;
  readonly dayOfMonth?: number | null;
  readonly timeZone?: string;
  readonly time?: string;
}

/**
 * data.recur.rule's own invariant: `dayOfMonth` is required (1-31) and only present when frequency is
 * `monthly-day`; `n` is required (a positive integer) and only present when frequency is
 * `every-n-days`. This is a shape check only - it never refuses a `dayOfMonth` that some months do not
 * have (decision.recur.impossible-date owns that, at generation time, in calendar.util.ts).
 */
function assertValidFrequencyShape(frequency: RuleFrequency, n: number | null | undefined, dayOfMonth: number | null | undefined): void {
    if (frequency === "every-n-days") {
        if (typeof n !== "number" || !Number.isInteger(n) || n <= 0) {
            throw new RecurRuleInvalidException({
                reason: "n is required and must be a positive integer for every-n-days" 
            })
        }
        if (dayOfMonth !== null && dayOfMonth !== undefined) {
            throw new RecurRuleInvalidException({
                reason: "dayOfMonth must be absent for every-n-days" 
            })
        }
    } else if (frequency === "monthly-day") {
        if (typeof dayOfMonth !== "number" || !Number.isInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31) {
            throw new RecurRuleInvalidException({
                reason: "dayOfMonth is required and must be between 1 and 31 for monthly-day" 
            })
        }
        if (n !== null && n !== undefined) {
            throw new RecurRuleInvalidException({
                reason: "n must be absent for monthly-day" 
            })
        }
    } else if (frequency === "every-weekday") {
        if (n !== null && n !== undefined) {
            throw new RecurRuleInvalidException({
                reason: "n must be absent for every-weekday" 
            })
        }
        if (dayOfMonth !== null && dayOfMonth !== undefined) {
            throw new RecurRuleInvalidException({
                reason: "dayOfMonth must be absent for every-weekday" 
            })
        }
    } else {
        throw new RecurRuleInvalidException({
            reason: `unknown frequency: ${String(frequency)}` 
        })
    }
}

/**
 * data.recur.rule: owner is bound at creation and never rewritten; endedAt, once set, is never cleared.
 * Persistence only through `@InjectPrimaryEntityManager()`, matching every other capability in this
 * codebase - no repository files, no `@InjectRepository`.
 */
@Injectable()
/** Injectable service owning the rule logic the recur capability exposes; wired by the capability's own module. */
export class RuleService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    async create(input: CreateRuleInput): Promise<RuleRecord> {
        assertValidFrequencyShape(input.frequency,
            input.n ?? null,
            input.dayOfMonth ?? null)
        const saved = await this.entityManager.save(RuleEntity,
            {
                id: randomUUID(),
                owner: input.owner,
                title: input.title,
                frequency: input.frequency,
                n: input.n ?? null,
                dayOfMonth: input.dayOfMonth ?? null,
                timeZone: input.timeZone,
                time: input.time,
                startDate: input.startDate,
                endedAt: null,
            })
        return toRecord(saved)
    }

    async findById(id: string): Promise<RuleRecord> {
        const row = await this.entityManager.findOneBy(RuleEntity,
            {
                id 
            })
        if (!row) {
            throw new RecurRuleNotFoundException({
                ruleId: id 
            })
        }
        return toRecord(row)
    }

    async listOwnedBy(owner: string): Promise<Array<RuleRecord>> {
        const rows = await this.entityManager.findBy(RuleEntity,
            {
                owner 
            })
        return rows.map(toRecord)
    }

    async listActive(): Promise<Array<RuleRecord>> {
        const rows = await this.entityManager.findBy(RuleEntity,
            {
            })
        return rows.map(toRecord)
    }

    /** fr.recur.edit-rule: only the owner may edit; an already-materialised occurrence is never rewritten
   * (the caller, not this method, is what would touch occurrence rows - this method only ever touches
   * the rule row itself). */
    async edit(id: string, actorId: string, patch: EditRuleInput): Promise<RuleRecord> {
        const row = await this.findRowForOwner(id,
            actorId)
        const nextFrequency = patch.frequency ?? (row.frequency as RuleFrequency)
        const nextN = patch.n !== undefined ? patch.n : row.n
        const nextDayOfMonth = patch.dayOfMonth !== undefined ? patch.dayOfMonth : row.dayOfMonth
        assertValidFrequencyShape(nextFrequency,
            nextN,
            nextDayOfMonth)

        row.frequency = nextFrequency
        row.n = nextN
        row.dayOfMonth = nextDayOfMonth
        row.timeZone = patch.timeZone ?? row.timeZone
        row.time = patch.time ?? row.time
        const saved = await this.entityManager.save(RuleEntity,
            row)
        return toRecord(saved)
    }

    /** fr.recur.end-rule / br.recur.ending.preserves-history: sets endedAt; never deletes the row, never
   * touches an occurrence directly (OccurrenceService.orphanEndedOccurrences does that half). */
    async end(id: string, actorId: string, endedAt: string): Promise<RuleRecord> {
        const row = await this.findRowForOwner(id,
            actorId)
        row.endedAt = endedAt
        const saved = await this.entityManager.save(RuleEntity,
            row)
        return toRecord(saved)
    }

    private async findRowForOwner(id: string, actorId: string): Promise<RuleEntity> {
        const row = await this.entityManager.findOneBy(RuleEntity,
            {
                id 
            })
        if (!row) {
            throw new RecurRuleNotFoundException({
                ruleId: id 
            })
        }
        if (row.owner !== actorId) {
            throw new RecurRuleForbiddenException({
                ruleId: id, actorId 
            })
        }
        return row
    }
}

function toRecord(row: RuleEntity): RuleRecord {
    return new RuleRecord(
        row.id,
        row.owner,
        row.title,
    row.frequency as RuleFrequency,
    row.n,
    row.dayOfMonth,
    row.timeZone,
    row.time,
    row.startDate,
    row.endedAt,
    )
}
