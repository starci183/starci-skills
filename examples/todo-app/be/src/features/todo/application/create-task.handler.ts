import { CommandHandler } from "@nestjs/cqrs"
import { TaskflowService } from "@modules/domain/taskflow"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { CreateTaskCommand } from "./create-task.command"
import type { CreateTaskResult } from "./create-task.contracts"

@CommandHandler(CreateTaskCommand)
/**
 * Creates a task for the caller unless the plan of the caller has no room for another active task; the row and the
 * audit message are written in one transaction, so the audit line exists exactly when the task does.
 */
export class CreateTaskHandler extends ICQRSHandler<CreateTaskCommand, CreateTaskResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly taskflow: TaskflowService,
    ) {
        super(logger)
    }

    protected override process(command: CreateTaskCommand): Promise<CreateTaskResult> {
        return this.taskflow.create({ ownerId: command.params.principal.id, title: command.params.request.title })
    }
}
