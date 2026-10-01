import { CommandHandler } from "@nestjs/cqrs"
import { TaskService } from "@modules/domain/task"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { DeleteTaskCommand } from "./delete-task.command"
import type { DeleteTaskResult } from "./delete-task.contracts"

@CommandHandler(DeleteTaskCommand)
/** Deletes a task for its owner only: a collaborator, however trusted, never deletes. The audit message joins the delete transaction. */
export class DeleteTaskHandler extends ICQRSHandler<DeleteTaskCommand, DeleteTaskResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly tasks: TaskService,
    ) {
        super(logger)
    }

    protected override process(command: DeleteTaskCommand): Promise<DeleteTaskResult> {
        return this.tasks.deleteOwned({
            ownerId: command.params.principal.id,
            taskId: command.params.request.taskId,
        })
    }
}
