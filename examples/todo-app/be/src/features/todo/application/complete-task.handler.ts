import { CommandHandler } from "@nestjs/cqrs"
import { TaskflowService } from "@modules/domain/taskflow"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
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
        private readonly taskflow: TaskflowService,
    ) {
        super(logger)
    }

    protected override process(command: CompleteTaskCommand): Promise<CompleteTaskResult> {
        return this.taskflow.complete({ actorId: command.params.principal.id, taskId: command.params.request.taskId })
    }
}
