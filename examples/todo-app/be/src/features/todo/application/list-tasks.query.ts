import { Query } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ListTasksRequest, ListTasksResult } from "./list-tasks.contracts"

/** Asks for the tasks the caller owns. */
export class ListTasksQuery extends Query<ListTasksResult> {
    constructor(readonly params: ExecuteParams<ListTasksRequest>) {
        super()
    }
}
