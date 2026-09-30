import { Query } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ListTaskUploadsRequest, ListTaskUploadsResult } from "./list-task-uploads.contracts"

/** Asks for the uploads attached to a task of the caller. */
export class ListTaskUploadsQuery extends Query<ListTaskUploadsResult> {
    constructor(readonly params: ExecuteParams<ListTaskUploadsRequest>) {
        super()
    }
}
