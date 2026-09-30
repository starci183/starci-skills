import { Injectable } from "@nestjs/common"
import { AuditAction, toAuditAppendMessage } from "@modules/domain/audit"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager, LIST_ROWS_MAX } from "@modules/platform/database"
import { InjectIds } from "@modules/platform/ids"
import type { Ids } from "@modules/platform/ids"
import { InjectOutbox } from "@modules/platform/outbox"
import type { Outbox } from "@modules/platform/outbox"
import { ok, refused } from "@modules/platform/primitives"
import type { Outcome } from "@modules/platform/primitives"
import type { EntityManager } from "typeorm"
import { TaskErrorCode } from "./errors/task.error"
import { TaskEntity } from "./persistence/entities/task.entity"
import { toTaskView } from "./persistence/task.rows"
import type {
    CreateTaskParams,
    DeleteOwnedTaskParams,
    DeleteOwnedTaskResult,
    DeleteTaskParams,
    FindTaskParams,
    ListTasksParams,
    TaskCounts,
    TaskList,
    TaskLookupResult,
    TaskView,
    TransitionTaskParams,
} from "./task.contracts"

@Injectable()
/**
 * The task rows and the rules on them: the owner is bound at creation, a blank title is refused, completedAt is set if
 * and only if complete is true. Who may act on a task is decided by the operation that orchestrates it: the owner alone
 * deletes, and the delete, list and count operations of the owner are orchestrated here.
 */
export class TaskService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        @InjectIds() private readonly ids: Ids,
        @InjectOutbox() private readonly outbox: Outbox,
    ) {}

    /** Creates a task for the owner, or refuses a blank title. */
    async create(params: CreateTaskParams): Promise<Outcome<TaskView, TaskErrorCode.TitleRequired>> {
        const title = params.title.trim()
        if (!title) return refused(TaskErrorCode.TitleRequired)
        const saved = await params.manager.save(TaskEntity, {
            id: this.ids.next(),
            owner: params.ownerId,
            title,
            complete: false,
            completedAt: null,
        })
        return ok(toTaskView(saved))
    }

    /** The task with this id, or null. */
    async find(params: FindTaskParams): Promise<TaskLookupResult> {
        const row = await this.entityManager.findOneBy(TaskEntity, { id: params.id })
        return row ? toTaskView(row) : null
    }

    /** The tasks of one owner, at most LIST_ROWS_MAX. */
    async listOwnedBy(params: ListTasksParams): Promise<Array<TaskView>> {
        const rows = await this.entityManager.find(TaskEntity, {
            where: { owner: params.ownerId },
            take: LIST_ROWS_MAX,
        })
        return rows.map(toTaskView)
    }

    /** Marks the task complete; completing a complete task changes nothing. */
    async complete(params: TransitionTaskParams): Promise<TaskView> {
        if (params.task.complete) return params.task
        const saved = await params.manager.save(TaskEntity, {
            id: params.task.id,
            owner: params.task.owner,
            title: params.task.title,
            complete: true,
            completedAt: params.at,
        })
        return toTaskView(saved)
    }

    /** Marks the task open again. */
    async reopen(params: TransitionTaskParams): Promise<TaskView> {
        const saved = await params.manager.save(TaskEntity, {
            id: params.task.id,
            owner: params.task.owner,
            title: params.task.title,
            complete: false,
            completedAt: null,
        })
        return toTaskView(saved)
    }

    /** Deletes the task row. */
    async remove(params: DeleteTaskParams): Promise<void> {
        await params.manager.delete(TaskEntity, params.id)
    }

    /**
     * Deletes a task for its owner only: a collaborator, however trusted, never deletes. The audit message joins the
     * delete transaction, so the audit line exists exactly when the delete commits.
     */
    async deleteOwned(params: DeleteOwnedTaskParams): Promise<DeleteOwnedTaskResult> {
        const task = await this.find({ id: params.taskId })
        if (!task) return refused(TaskErrorCode.NotFound, { taskId: params.taskId })
        if (task.owner !== params.ownerId) return refused(TaskErrorCode.Forbidden, { taskId: task.id })
        const at = this.clock.now()
        await this.entityManager.transaction(async (manager) => {
            await this.remove({ manager, id: task.id })
            await this.outbox.enqueue(
                manager,
                toAuditAppendMessage({
                    eventId: this.ids.next(),
                    actorId: params.ownerId,
                    action: AuditAction.TaskDeleted,
                    target: task.id,
                    at,
                }),
            )
        })
        return ok({ deleted: true })
    }

    /** The tasks the owner holds as list entries, at most LIST_ROWS_MAX. */
    async listSummaries(params: ListTasksParams): Promise<TaskList> {
        const owned = await this.listOwnedBy(params)
        return { tasks: owned.map((task) => ({ taskId: task.id, title: task.title, complete: task.complete })) }
    }

    /** How many of the owner's tasks are open and complete. */
    async countsOf(params: ListTasksParams): Promise<TaskCounts> {
        const owned = await this.listOwnedBy(params)
        const complete = owned.filter((task) => task.complete).length
        return { open: owned.length - complete, complete }
    }
}
