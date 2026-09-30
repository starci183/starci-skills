import { QueryHandler } from "@nestjs/cqrs"
import { TaskService } from "@modules/domain/task"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { ListTasksResult } from "./list-tasks.contracts"
import { ListTasksQuery } from "./list-tasks.query"

@QueryHandler(ListTasksQuery)
/** Lists exactly the tasks the caller owns. */
export class ListTasksHandler extends ICQRSHandler<ListTasksQuery, ListTasksResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly tasks: TaskService,
    ) {
        super(logger)
    }

    protected override async process(query: ListTasksQuery): Promise<ListTasksResult> {
        const owned = await this.tasks.listOwnedBy({ ownerId: query.params.principal.id })
        return { tasks: owned.map((task) => ({ taskId: task.id, title: task.title, complete: task.complete })) }
    }
}
