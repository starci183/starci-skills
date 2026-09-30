import { randomUUID } from "node:crypto"
import { CommandHandler } from "@nestjs/cqrs"
import { AuditAction, toAuditAppendMessage } from "@modules/domain/audit"
import { NOTIFY_CHANNEL_EMAIL, NOTIFY_KIND_TASK_COMPLETE, toNotifyAdmitMessage } from "@modules/domain/notify"
import { AccessService } from "@modules/domain/share"
import { TaskErrorCode, TaskService } from "@modules/domain/task"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { InjectOutbox } from "@modules/platform/outbox"
import type { Outbox } from "@modules/platform/outbox"
import { ok, refused } from "@modules/platform/primitives"
import type { EntityManager } from "typeorm"
import { CompleteTaskCommand } from "./complete-task.command"
import type { CompleteTaskResult } from "./complete-task.contracts"

@CommandHandler(CompleteTaskCommand)
/**
 * Marks a task complete for the owner or an editor collaborator; completing a complete task changes nothing and is not
 * an error. The audit line and the notification for the owner are written with the change, in one transaction.
 */
export class CompleteTaskHandler extends ICQRSHandler<CompleteTaskCommand, CompleteTaskResult> {
    constructor(
        @InjectLogger() logger: Logger,
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        @InjectOutbox() private readonly outbox: Outbox,
        private readonly tasks: TaskService,
        private readonly access: AccessService,
    ) {
        super(logger)
    }

    protected override async process(command: CompleteTaskCommand): Promise<CompleteTaskResult> {
        const { request, principal } = command.params
        const task = await this.tasks.find({ id: request.taskId })
        if (!task) return refused(TaskErrorCode.NotFound, { taskId: request.taskId })
        const mayComplete = await this.access.mayComplete({ actorId: principal.id, taskId: task.id, ownerId: task.owner })
        if (!mayComplete) return refused(TaskErrorCode.Forbidden, { taskId: task.id })
        const at = this.clock.now()
        return this.entityManager.transaction(async (manager) => {
            const completed = await this.tasks.complete({ manager, task, at })
            await this.outbox.enqueue(
                manager,
                toAuditAppendMessage({
                    eventId: randomUUID(),
                    actorId: principal.id,
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
}
