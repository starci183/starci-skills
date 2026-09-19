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
    TaskCountsQuery, TaskCountsQueryResult 
} from "./task-counts.query"

/**
 * contract.task.list-for-dashboard: the provider half of the dashboard's read - `open` counts tasks
 * not yet complete, `complete` counts the rest, both over exactly the reader's own tasks because
 * TaskService.listOwnedBy is the only source (br.task.list.owned). Adding a third counter later is
 * additive, per the contract's own stability note; changing what open means would be breaking.
 */
@Injectable()
@QueryHandler(TaskCountsQuery)
/** Decorated CQRS query handler; the bus dispatches to it and process() does the work (the abstract base keeps execute() a template). */
export class TaskCountsHandler extends AbstractQueryHandler<TaskCountsQuery, TaskCountsQueryResult> {
    constructor(
    private readonly taskService: TaskService,
    ) {
        super()
    }

    protected override async process(query: TaskCountsQuery): Promise<TaskCountsQueryResult> {
        const records = await this.taskService.listOwnedBy(query.params.ownerId)
        const complete = records.filter(record => record.complete).length
        return {
            open: records.length - complete, complete 
        }
    }
}
