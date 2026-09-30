import { randomUUID } from "node:crypto"
import { Injectable } from "@nestjs/common"
import { AuditAction, toAuditAppendMessage } from "@modules/domain/audit"
import { NOTIFY_CHANNEL_EMAIL, NOTIFY_KIND_TASK_COMPLETE, toNotifyAdmitMessage } from "@modules/domain/notify"
import { SubscriptionService } from "@modules/domain/plan"
import { AccessService } from "@modules/domain/share"
import { TaskErrorCode, TaskService } from "@modules/domain/task"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectOutbox } from "@modules/platform/outbox"
import type { Outbox } from "@modules/platform/outbox"
import { ok, refused } from "@modules/platform/primitives"
import type { EntityManager } from "typeorm"
import type {
    CompleteTaskflowParams,
    CompleteTaskflowResult,
    CreateTaskflowParams,
    CreateTaskflowResult,
    ReopenTaskflowParams,
    ReopenTaskflowResult,
} from "./taskflow.contracts"

@Injectable()
/**
 * The task scenarios that span capabilities: creating under the plan cap, and completing or reopening under the access
 * rule of the share capability. Each write and the audit and notification messages it causes share one transaction.
 */
export class TaskflowService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        @InjectOutbox() private readonly outbox: Outbox,
        private readonly tasks: TaskService,
        private readonly subscriptions: SubscriptionService,
        private readonly access: AccessService,
    ) {}

    /**
     * Creates a task for the person unless the plan of the person has no room for another active task; the row and the
     * audit message are written in one transaction, so the audit line exists exactly when the task does.
     */
    async create(params: CreateTaskflowParams): Promise<CreateTaskflowResult> {
        const at = this.clock.now()
        const owned = await this.tasks.listOwnedBy({ ownerId: params.ownerId })
        const verdict = await this.subscriptions.checkCap({
            personId: params.ownerId,
            activeTaskCount: owned.filter((task) => !task.complete).length,
        })
        if (!verdict.allowed) {
            return refused(TaskErrorCode.PlanCapExceeded, { cap: verdict.cap, upgradePath: verdict.upgradePath })
        }
        return this.entityManager.transaction(async (manager) => {
            const created = await this.tasks.create({ manager, ownerId: params.ownerId, title: params.title })
            if (created.kind === "refused") return created
            await this.outbox.enqueue(
                manager,
                toAuditAppendMessage({
                    eventId: randomUUID(),
                    actorId: params.ownerId,
                    action: AuditAction.TaskCreated,
                    target: created.value.id,
                    at,
                }),
            )
            return ok({ taskId: created.value.id, title: created.value.title })
        })
    }

    /**
     * Marks a task complete for the owner or an editor collaborator; completing a complete task changes nothing and is
     * not an error. The audit line and the notification for the owner are written with the change, in one transaction.
     */
    async complete(params: CompleteTaskflowParams): Promise<CompleteTaskflowResult> {
        const task = await this.tasks.find({ id: params.taskId })
        if (!task) return refused(TaskErrorCode.NotFound, { taskId: params.taskId })
        const mayComplete = await this.access.mayComplete({ actorId: params.actorId, taskId: task.id, ownerId: task.owner })
        if (!mayComplete) return refused(TaskErrorCode.Forbidden, { taskId: task.id })
        const at = this.clock.now()
        return this.entityManager.transaction(async (manager) => {
            const completed = await this.tasks.complete({ manager, task, at })
            await this.outbox.enqueue(
                manager,
                toAuditAppendMessage({
                    eventId: randomUUID(),
                    actorId: params.actorId,
                    action: AuditAction.TaskCompleted,
                    target: completed.id,
                    at,
                }),
            )
            await this.outbox.enqueue(
                manager,
                toNotifyAdmitMessage({
                    eventId: randomUUID(),
                    kind: NOTIFY_KIND_TASK_COMPLETE,
                    recipientId: completed.owner,
                    channel: NOTIFY_CHANNEL_EMAIL,
                    payload: { taskId: completed.id, completedAt: (completed.completedAt ?? at).toISOString() },
                    at,
                }),
            )
            return ok({ taskId: completed.id, complete: completed.complete })
        })
    }

    /** Reopens a task for the owner or an editor collaborator. */
    async reopen(params: ReopenTaskflowParams): Promise<ReopenTaskflowResult> {
        const task = await this.tasks.find({ id: params.taskId })
        if (!task) return refused(TaskErrorCode.NotFound, { taskId: params.taskId })
        const mayReopen = await this.access.mayComplete({ actorId: params.actorId, taskId: task.id, ownerId: task.owner })
        if (!mayReopen) return refused(TaskErrorCode.Forbidden, { taskId: task.id })
        const at = this.clock.now()
        const reopened = await this.entityManager.transaction((manager) => this.tasks.reopen({ manager, task, at }))
        return ok({ taskId: reopened.id, complete: reopened.complete })
    }
}
