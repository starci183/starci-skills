import { CommandHandler } from "@nestjs/cqrs"
import { TaskflowService } from "@modules/domain/taskflow"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ReopenTaskCommand } from "./reopen-task.command"
import type { ReopenTaskResult } from "./reopen-task.contracts"

@CommandHandler(ReopenTaskCommand)
/**
 * Reopens a task for the owner or an editor collaborator.
 */
export class ReopenTaskHandler extends ICQRSHandler<ReopenTaskCommand, ReopenTaskResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly taskflow: TaskflowService,
    ) {
        super(logger)
    }

    protected override process(command: ReopenTaskCommand): Promise<ReopenTaskResult> {
        return this.taskflow.reopen({ actorId: command.params.principal.id, taskId: command.params.request.taskId })
    }
}
