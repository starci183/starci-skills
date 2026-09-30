import { CommandHandler } from "@nestjs/cqrs"
import { AccessService } from "@modules/domain/share"
import { TaskErrorCode, TaskService } from "@modules/domain/task"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ok, refused } from "@modules/platform/primitives"
import type { EntityManager } from "typeorm"
import { ReopenTaskCommand } from "./reopen-task.command"
import type { ReopenTaskResult } from "./reopen-task.contracts"

@CommandHandler(ReopenTaskCommand)
/** Reopens a task for the owner or an editor collaborator. */
export class ReopenTaskHandler extends ICQRSHandler<ReopenTaskCommand, ReopenTaskResult> {
    constructor(
        @InjectLogger() logger: Logger,
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        private readonly tasks: TaskService,
        private readonly access: AccessService,
    ) {
        super(logger)
    }

    protected override async process(command: ReopenTaskCommand): Promise<ReopenTaskResult> {
        const { request, principal } = command.params
        const task = await this.tasks.find({ id: request.taskId })
        if (!task) return refused(TaskErrorCode.NotFound, { taskId: request.taskId })
        const mayReopen = await this.access.mayComplete({ actorId: principal.id, taskId: task.id, ownerId: task.owner })
        if (!mayReopen) return refused(TaskErrorCode.Forbidden, { taskId: task.id })
        const at = this.clock.now()
        const reopened = await this.entityManager.transaction((manager) => this.tasks.reopen({ manager, task, at }))
        return ok({ taskId: reopened.id, complete: reopened.complete })
    }
}
