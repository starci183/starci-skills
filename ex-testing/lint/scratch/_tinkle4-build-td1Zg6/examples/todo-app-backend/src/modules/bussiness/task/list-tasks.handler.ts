import {
    Injectable 
} from "@nestjs/common"
import {
    QueryHandler 
} from "@nestjs/cqrs"
import {
    AbstractQueryHandler 
} from "@modules/platform/cqrs/abstract-handler"
import {
    TaskService 
} from "./task.service"
import {
    ListTasksQuery, ListTasksQueryResult, TaskSummaryResult 
} from "./list-tasks.query"

/**
 * br.task.list.owned: a task list contains exactly the tasks owned by the person reading it. Ported
 * from the former `ListTasksUseCase` into a CQRS query handler - task's one read, following nivo's own
 * split of writes onto the CommandBus and reads onto the QueryBus.
 */
@Injectable()
@QueryHandler(ListTasksQuery)
/** Decorated CQRS query handler; the bus dispatches to it and process() does the work (the abstract base keeps execute() a template). */
export class ListTasksHandler extends AbstractQueryHandler<ListTasksQuery, ListTasksQueryResult> {
    constructor(
    private readonly taskService: TaskService,
    ) {
        super()
    }

    protected override async process(query: ListTasksQuery): Promise<ListTasksQueryResult> {
        const records = await this.taskService.listOwnedBy(query.params.ownerId)
        const tasks: Array<TaskSummaryResult> = records.map(record => ({
            taskId: record.id,
            title: record.title,
            complete: record.complete,
        }))
        return {
            tasks 
        }
    }
}
