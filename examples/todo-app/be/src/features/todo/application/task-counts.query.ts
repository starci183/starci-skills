import { Query } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { TaskCountsRequest, TaskCountsResult } from "./task-counts.contracts"

/** Asks how many tasks the caller has open and complete. */
export class TaskCountsQuery extends Query<TaskCountsResult> {
    constructor(readonly params: ExecuteParams<TaskCountsRequest>) {
        super()
    }
}
