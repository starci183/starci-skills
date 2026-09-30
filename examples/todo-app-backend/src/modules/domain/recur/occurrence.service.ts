import { Injectable } from "@nestjs/common"
import { TaskService } from "@modules/domain/task"
import type { TaskView } from "@modules/domain/task"
import { InjectPrimaryEntityManager, LIST_ROWS_MAX } from "@modules/platform/database"
import { ok, refused } from "@modules/platform/primitives"
import type { Outcome } from "@modules/platform/primitives"
import { In } from "typeorm"
import type { EntityManager } from "typeorm"
import { RecurErrorCode } from "./errors/recur.error"
import { OccurrenceEntity } from "./persistence/entities/occurrence.entity"
import { toAffectedCount, toOccurrenceView } from "./persistence/occurrence.rows"
import { ORPHAN_ENDED_OCCURRENCES } from "./persistence/occurrence.sql"
import type {
    ExistingWindowKeysParams,
    ListOccurrencesParams,
    MaterialiseParams,
    OccurrenceView,
    OrphanOccurrencesParams,
    TransitionOccurrenceParams,
} from "./recur.contracts"

@Injectable()
/**
 * The occurrence rows, joined by id to the task each one spawned. Only the owner of the task may complete or skip an
 * occurrence, and materialising the same window twice changes nothing.
 */
export class OccurrenceService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly tasks: TaskService,
    ) {}

    /** Writes the occurrence row of a window keyed by its window key; a window that already has a row is returned untouched. */
    async materialise(params: MaterialiseParams): Promise<OccurrenceView> {
        const existing = await params.manager.findOneBy(OccurrenceEntity, { windowKey: params.windowKey })
        if (existing) return toOccurrenceView(existing)
        const saved = await params.manager.save(OccurrenceEntity, {
            id: params.id,
            ruleId: params.ruleId,
            windowKey: params.windowKey,
            localDate: params.localDate,
            dueAtUtc: params.dueAtUtc,
            status: "materialised",
        })
        return toOccurrenceView(saved)
    }

    /** Which of the window keys already have an occurrence row; the keys are read in bounded chunks. */
    async existingWindowKeys(params: ExistingWindowKeysParams): Promise<Set<string>> {
        const found = new Set<string>()
        let from = 0
        while (from < params.windowKeys.length) {
            const rows = await this.entityManager.find(OccurrenceEntity, {
                where: { windowKey: In(params.windowKeys.slice(from, from + LIST_ROWS_MAX)) },
                take: LIST_ROWS_MAX,
            })
            for (const row of rows) found.add(row.windowKey)
            from += LIST_ROWS_MAX
        }
        return found
    }

    /** The occurrences of one rule, oldest local date first, at most LIST_ROWS_MAX. */
    async listByRule(params: ListOccurrencesParams): Promise<Array<OccurrenceView>> {
        const rows = await this.entityManager.find(OccurrenceEntity, {
            where: { ruleId: params.ruleId },
            order: { localDate: "ASC" },
            take: LIST_ROWS_MAX,
        })
        return rows.map(toOccurrenceView)
    }

    /** Completes the occurrence of the owner and the task it spawned; completing again changes nothing. */
    async complete(params: TransitionOccurrenceParams): Promise<Outcome<OccurrenceView, RecurErrorCode.OccurrenceNotFound | RecurErrorCode.OccurrenceForbidden>> {
        const found = await this.findForOwner(params)
        if (found.kind === "refused") return found
        const { row, task } = found.value
        if (row.status === "completed") return ok(toOccurrenceView(row))
        await this.tasks.complete({ manager: params.manager, task, at: params.at })
        const saved = await params.manager.save(OccurrenceEntity, { ...row, status: "completed" })
        return ok(toOccurrenceView(saved))
    }

    /** Skips the occurrence of the owner without completing its task; skipping again changes nothing. */
    async skip(params: TransitionOccurrenceParams): Promise<Outcome<OccurrenceView, RecurErrorCode.OccurrenceNotFound | RecurErrorCode.OccurrenceForbidden>> {
        const found = await this.findForOwner(params)
        if (found.kind === "refused") return found
        const { row } = found.value
        if (row.status === "skipped") return ok(toOccurrenceView(row))
        const saved = await params.manager.save(OccurrenceEntity, { ...row, status: "skipped" })
        return ok(toOccurrenceView(saved))
    }

    /** Orphans the occurrences of an ended rule dated on or after the end that are still materialised; returns how many. Nothing is deleted. */
    async orphanEnded(params: OrphanOccurrencesParams): Promise<number> {
        const result: unknown = await params.manager.query(ORPHAN_ENDED_OCCURRENCES, [params.ruleId, params.endedAt])
        return toAffectedCount(result)
    }

    private async findForOwner(
        params: TransitionOccurrenceParams,
    ): Promise<
        Outcome<
            { readonly row: OccurrenceEntity; readonly task: TaskView },
            RecurErrorCode.OccurrenceNotFound | RecurErrorCode.OccurrenceForbidden
        >
    > {
        const row = await params.manager.findOneBy(OccurrenceEntity, { id: params.id })
        if (!row) return refused(RecurErrorCode.OccurrenceNotFound)
        const task = await this.tasks.find({ id: params.id })
        if (!task) return refused(RecurErrorCode.OccurrenceNotFound)
        if (task.owner !== params.actorId) return refused(RecurErrorCode.OccurrenceForbidden)
        return ok({ row, task })
    }
}
