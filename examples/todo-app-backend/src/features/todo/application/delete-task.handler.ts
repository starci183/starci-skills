import { randomUUID } from "node:crypto"
import { CommandHandler } from "@nestjs/cqrs"
import { AuditAction, toAuditAppendMessage } from "@modules/domain/audit"
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
import { DeleteTaskCommand } from "./delete-task.command"
import type { DeleteTaskResult } from "./delete-task.contracts"

@CommandHandler(DeleteTaskCommand)
/** Deletes a task for its owner only: a collaborator, however trusted, never deletes. The audit message joins the delete transaction. */
export class DeleteTaskHandler extends ICQRSHandler<DeleteTaskCommand, DeleteTaskResult> {
    constructor(
        @InjectLogger() logger: Logger,
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        @InjectOutbox() private readonly outbox: Outbox,
        private readonly tasks: TaskService,
    ) {
        super(logger)
    }

    protected override async process(command: DeleteTaskCommand): Promise<DeleteTaskResult> {
        const { request, principal } = command.params
        const task = await this.tasks.find({ id: request.taskId })
        if (!task) return refused(TaskErrorCode.NotFound, { taskId: request.taskId })
        if (task.owner !== principal.id) return refused(TaskErrorCode.Forbidden, { taskId: task.id })
        const at = this.clock.now()
        await this.entityManager.transaction(async (manager) => {
            await this.tasks.remove({ manager, id: task.id })
            await this.outbox.enqueue(
                manager,
                toAuditAppendMessage({
                    eventId: randomUUID(),
                    actorId: principal.id,
                    action: AuditAction.TaskDeleted,
                    target: task.id,
                    at,
                }),
            )
        })
        return ok({ deleted: true })
    }
}
