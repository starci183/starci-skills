import { randomUUID } from "node:crypto"
import { Injectable } from "@nestjs/common"
import { InjectPrimaryEntityManager, LIST_ROWS_MAX } from "@modules/platform/database"
import { ok, refused } from "@modules/platform/primitives"
import type { Outcome } from "@modules/platform/primitives"
import type { EntityManager } from "typeorm"
import { TaskErrorCode } from "./errors/task.error"
import { TaskEntity } from "./persistence/entities/task.entity"
import { toTaskView } from "./persistence/task.rows"
import type {
    CreateTaskParams,
    DeleteTaskParams,
    FindTaskParams,
    ListTasksParams,
    TaskLookupResult,
    TaskView,
    TransitionTaskParams,
} from "./task.contracts"

@Injectable()
/**
 * The task rows and the rules on them: the owner is bound at creation, a blank title is refused, completedAt is set if
 * and only if complete is true. Who may act on a task is decided by the handler that orchestrates the operation.
 */
export class TaskService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** Creates a task for the owner, or refuses a blank title. */
    async create(params: CreateTaskParams): Promise<Outcome<TaskView, TaskErrorCode.TitleRequired>> {
        const title = params.title.trim()
        if (!title) return refused(TaskErrorCode.TitleRequired)
        const saved = await params.manager.save(TaskEntity, {
            id: randomUUID(),
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
}
