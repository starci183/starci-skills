import { QueryHandler } from "@nestjs/cqrs"
import { TaskService } from "@modules/domain/task"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { TaskCountsResult } from "./task-counts.contracts"
import { TaskCountsQuery } from "./task-counts.query"

@QueryHandler(TaskCountsQuery)
/** Counts open and complete tasks over exactly the tasks the caller owns. */
export class TaskCountsHandler extends ICQRSHandler<TaskCountsQuery, TaskCountsResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly tasks: TaskService,
    ) {
        super(logger)
    }

    protected override async process(query: TaskCountsQuery): Promise<TaskCountsResult> {
        const owned = await this.tasks.listOwnedBy({ ownerId: query.params.principal.id })
        const complete = owned.filter((task) => task.complete).length
        return { open: owned.length - complete, complete }
    }
}
